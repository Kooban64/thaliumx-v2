const http = require('http');
const https = require('https');
const crypto = require('crypto');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');

const { makeExecutableSchema } = require('@graphql-tools/schema');
const depthLimit = require('graphql-depth-limit');
const { PubSub, withFilter } = require('graphql-subscriptions');
const { WebSocketServer } = require('ws');
// graphql-ws exports for CJS are under lib/*
const { useServer } = require('graphql-ws/lib/use/ws');

const { LRUCache } = require('lru-cache');
const axios = require('axios');
const { Kafka } = require('kafkajs');
const DataLoader = require('dataloader');

// Backend API configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';
const PORT = Number(process.env.PORT || 4000);

// Kafka configuration
const KAFKA_BROKER = process.env.KAFKA_BROKER || process.env.KAFKA_BROKERS || 'localhost:9094';
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'thaliumx-graphql';
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || 'graphql-workflow-subscriptions';

// Performance knobs
const MAX_CACHE_ITEMS = Number(process.env.GQL_CACHE_MAX_ITEMS || 10_000);
const MARKETDATA_CACHE_TTL_MS = Number(process.env.MARKETDATA_CACHE_TTL_MS || 500);
const MARKETDATA_POLL_INTERVAL_MS = Number(process.env.MARKETDATA_POLL_INTERVAL_MS || 1000);
const MARKETDATA_SYMBOLS = (process.env.MARKETDATA_SYMBOLS || 'BTCUSD,ETHUSD').split(',').map(s => s.trim()).filter(Boolean);
const MARKETDATA_PUBLISH_EPSILON = Number(process.env.MARKETDATA_PUBLISH_EPSILON || 0); // publish on any change by default

const CACHE = new LRUCache({
  max: MAX_CACHE_ITEMS,
  ttlAutopurge: true,
});

// DataLoader instances for batching queries
const workflowLoader = new DataLoader(async (workflowIds) => {
  // Batch fetch multiple workflows
  const workflows = await Promise.all(
    workflowIds.map(async (workflowId) => {
      try {
        const data = await makeBackendRequest('GET', `/api/workflows/${workflowId}/status`, null, { requestId: `batch-${workflowId}` });
        return data.workflow || data.data?.workflow || null;
      } catch (err) {
        console.error(`[GraphQL] Error loading workflow ${workflowId}:`, err.message);
        return null;
      }
    })
  );
  return workflows;
}, {
  cacheKeyFn: (key) => String(key),
  cache: true
});

const userLoader = new DataLoader(async (userIds) => {
  // Batch fetch multiple users
  const users = await Promise.all(
    userIds.map(async (userId) => {
      try {
        const data = await makeBackendRequest('GET', `/api/users/${userId}`, null, { requestId: `batch-${userId}` });
        return data.data || null;
      } catch (err) {
        console.error(`[GraphQL] Error loading user ${userId}:`, err.message);
        return null;
      }
    })
  );
  return users;
}, {
  cacheKeyFn: (key) => String(key),
  cache: true
});

// Create axios instance with keep-alive agents (reduces TCP churn and tail latency)
const backendClient = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10_000,
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 256, maxFreeSockets: 64 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 256, maxFreeSockets: 64 }),
  validateStatus: status => status >= 200 && status < 500,
});

function normalizeSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

function makeRequestId() {
  return crypto.randomBytes(12).toString('hex');
}

function extractBearerTokenFromHeader(authorizationHeader) {
  if (!authorizationHeader) return null;
  const value = String(authorizationHeader);
  if (!value.toLowerCase().startsWith('bearer ')) return null;
  return value.slice(7).trim() || null;
}

// Helper function to make authenticated requests to backend
async function makeBackendRequest(method, url, data = null, context) {
  const requestId = context?.requestId || makeRequestId();

  console.log(`[GraphQL] Making backend request: ${method} ${url}, requestId: ${requestId}`);

  const headers = {
    'x-request-id': requestId,
  };

  // Forward authorization header from GraphQL context
  if (context?.authHeader) {
    headers.authorization = context.authHeader;
    console.log(`[GraphQL] Forwarding auth header for requestId: ${requestId}`);
  } else {
    console.warn(`[GraphQL] No auth header found for requestId: ${requestId}`);
  }

  const config = {
    method,
    url,
    headers,
    ...(data && { data }),
  };

  try {
    const response = await backendClient.request(config);
    console.log(`[GraphQL] Backend response: ${response.status} for ${method} ${url}, requestId: ${requestId}`);

    if (response.status >= 400) {
      const details = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      console.error(`[GraphQL] Backend error: ${response.status} for ${method} ${url}, details: ${details}, requestId: ${requestId}`);
      const err = new Error(`Backend responded ${response.status} for ${method} ${url}`);
      err.extensions = { code: 'BACKEND_ERROR', requestId, backendStatus: response.status, backendBody: details };
      throw err;
    }

    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`[GraphQL] Backend connection error: ${error.message}, status: ${error.response.status}, requestId: ${requestId}`);
    } else {
      console.error(`[GraphQL] Backend network error: ${error.message}, requestId: ${requestId}`);
    }
    throw error;
  }
}

// Define the GraphQL schema
const typeDefs = /* GraphQL */ `
  type Query {
    hello: String
    userPortfolio(userId: ID!): Portfolio
    marketData(symbol: String!): MarketData
    userProfile(userId: ID!): User
    tradingHistory(userId: ID!, limit: Int): [Trade]
    workflow(workflowId: ID!): Workflow
    userWorkflows(userId: ID!, status: WorkflowStatus, workflowType: String, limit: Int): [Workflow!]!
    workflowTypes: [String!]!
  }

  type Mutation {
    placeOrder(order: OrderInput!): Order
    updateUserProfile(userId: ID!, input: UserUpdateInput!): User
    retryWorkflow(workflowId: ID!, stepIndex: Int, stepName: String): Workflow
    cancelWorkflow(workflowId: ID!, reason: String): Workflow
  }

  type Subscription {
    # Real-time market data. The publisher will emit updates for configured symbols.
    priceUpdated(symbol: String!): MarketData!
    # Real-time workflow status updates. Subscribe to workflow events from Kafka.
    workflowStatusUpdated(workflowId: ID, userId: ID): Workflow!
  }

  type Workflow {
    workflowId: ID!
    workflowType: String!
    status: WorkflowStatus!
    currentStep: String
    stepIndex: Int
    data: JSON
    errorMessage: String
    retryCount: Int
    maxRetries: Int
    userId: ID
    tenantId: ID
    createdAt: String!
    updatedAt: String!
    completedAt: String
  }

  enum WorkflowStatus {
    PENDING
    RUNNING
    COMPLETED
    FAILED
    CANCELLED
    COMPENSATING
  }

  scalar JSON

  type User {
    id: ID!
    email: String
    firstName: String
    lastName: String
    kycStatus: String
    kycLevel: String
    createdAt: String
  }

  type Portfolio {
    id: ID!
    userId: ID!
    balance: Float
    holdings: [Holding]
  }

  type Holding {
    symbol: String!
    amount: Float!
    value: Float!
  }

  type MarketData {
    symbol: String!
    price: Float!
    change24h: Float
    volume24h: Float
    lastUpdated: String
  }

  type Trade {
    id: ID!
    userId: ID!
    symbol: String!
    side: String!
    amount: Float!
    price: Float!
    timestamp: String!
  }

  type Order {
    id: ID!
    userId: ID!
    symbol: String!
    side: String!
    amount: Float!
    price: Float
    status: String!
    createdAt: String!
  }

  input OrderInput {
    symbol: String!
    side: String!
    amount: Float!
    price: Float
  }

  input UserUpdateInput {
    firstName: String
    lastName: String
    phone: String
  }
`;

const pubsub = new PubSub();
const TOPIC_PRICE_UPDATED = 'PRICE_UPDATED';
const TOPIC_WORKFLOW_STATUS_UPDATED = 'WORKFLOW_STATUS_UPDATED';

// JSON scalar resolver
const JSON = {
  __parseValue(value) {
    return value;
  },
  __serialize(value) {
    return value;
  },
  __parseLiteral(ast) {
    return ast.value;
  }
};

// Define resolvers
const resolvers = {
  JSON,
  Query: {
    hello: () => 'Hello from ThaliumX GraphQL API!',

    userPortfolio: async (_parent, args, context) => {
      const { userId } = args;
      const cacheKey = `userPortfolio:${userId}`;
      const cached = CACHE.get(cacheKey);
      if (cached) return cached;

      const data = await makeBackendRequest('GET', `/api/users/${userId}/portfolio`, null, context);
      const result = {
        id: `portfolio-${userId}`,
        userId,
        balance: data.balance || 0,
        holdings: data.holdings || [],
      };
      // Portfolio changes less frequently; cache briefly to collapse thundering herd.
      CACHE.set(cacheKey, result, { ttl: 1_000 });
      return result;
    },

    marketData: async (_parent, args, context) => {
      const symbol = normalizeSymbol(args.symbol);
      const cacheKey = `marketData:${symbol}`;
      const cached = CACHE.get(cacheKey);
      if (cached) return cached;

      const data = await makeBackendRequest('GET', `/api/market/prices/${symbol}`, null, context);
      const result = {
        symbol,
        price: data.data?.price || 0,
        change24h: data.data?.change24h || 0,
        volume24h: data.data?.volume24h || 0,
        lastUpdated: data.timestamp || new Date().toISOString(),
      };
      CACHE.set(cacheKey, result, { ttl: MARKETDATA_CACHE_TTL_MS });
      return result;
    },

    userProfile: async (_parent, args, context) => {
      const { userId } = args;
      // Use DataLoader for batching
      const userData = await userLoader.load(userId);
      if (!userData) return null;
      
      return {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        kycStatus: userData.kycStatus,
        kycLevel: userData.kycLevel,
        createdAt: userData.createdAt,
      };
    },

    tradingHistory: async (_parent, args, context) => {
      const { userId, limit = 10 } = args;
      const data = await makeBackendRequest('GET', `/api/trading/history?userId=${encodeURIComponent(userId)}&limit=${encodeURIComponent(limit)}`, null, context);
      return data.data?.trades || [];
    },

    workflow: async (_parent, args, context) => {
      const { workflowId } = args;
      // Use DataLoader for batching (if multiple workflows requested in same query)
      return workflowLoader.load(workflowId);
    },

    userWorkflows: async (_parent, args, context) => {
      const { userId, status, workflowType, limit = 10 } = args;
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (workflowType) params.append('workflowType', workflowType);
      if (limit) params.append('limit', limit.toString());

      const queryString = params.toString();
      const url = `/api/workflows/user/${userId}${queryString ? `?${queryString}` : ''}`;
      const data = await makeBackendRequest('GET', url, null, context);
      return data.workflows || data.data?.workflows || [];
    },

    workflowTypes: async (_parent, _args, context) => {
      const cacheKey = 'workflowTypes';
      const cached = CACHE.get(cacheKey);
      if (cached) return cached;

      const data = await makeBackendRequest('GET', '/api/workflows/types', null, context);
      const types = data.data?.types || data.types || [];
      // Cache workflow types for 5 minutes (they don't change often)
      CACHE.set(cacheKey, types, { ttl: 300_000 });
      return types;
    },
  },

  Mutation: {
    placeOrder: async (_parent, args, context) => {
      const orderData = args.order;
      const data = await makeBackendRequest('POST', '/api/trading/order', orderData, context);
      return {
        id: data.data?.id || 'order-1',
        userId: data.data?.userId || 'user-1',
        symbol: normalizeSymbol(orderData.symbol),
        side: orderData.side,
        amount: orderData.amount,
        price: orderData.price,
        status: data.data?.status || 'pending',
        createdAt: data.timestamp || new Date().toISOString(),
      };
    },

    updateUserProfile: async (_parent, args, context) => {
      const { userId, input } = args;
      const data = await makeBackendRequest('PUT', `/api/users/${userId}`, input, context);
      return {
        id: data.data.id,
        email: data.data.email,
        firstName: data.data.firstName,
        lastName: data.data.lastName,
        kycStatus: data.data.kycStatus,
        kycLevel: data.data.kycLevel,
        createdAt: data.data.createdAt,
      };
    },

    retryWorkflow: async (_parent, args, context) => {
      const { workflowId, stepIndex, stepName } = args;
      const requestBody = {};
      if (stepIndex !== undefined) requestBody.stepIndex = stepIndex;
      if (stepName) requestBody.stepName = stepName;

      // Clear cache for this workflow
      CACHE.delete(`workflow:${workflowId}`);

      const data = await makeBackendRequest('POST', `/api/workflows/${workflowId}/retry`, requestBody, context);
      
      // Fetch updated workflow status
      const workflowData = await makeBackendRequest('GET', `/api/workflows/${workflowId}/status`, null, context);
      return workflowData.workflow || workflowData.data?.workflow || null;
    },

    cancelWorkflow: async (_parent, args, context) => {
      const { workflowId, reason } = args;
      const requestBody = reason ? { reason } : {};

      // Clear cache for this workflow
      CACHE.delete(`workflow:${workflowId}`);

      const data = await makeBackendRequest('POST', `/api/workflows/${workflowId}/cancel`, requestBody, context);
      
      // Fetch updated workflow status
      const workflowData = await makeBackendRequest('GET', `/api/workflows/${workflowId}/status`, null, context);
      return workflowData.workflow || workflowData.data?.workflow || null;
    },
  },

  Subscription: {
    priceUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([TOPIC_PRICE_UPDATED]),
        (payload, variables) => {
          const want = normalizeSymbol(variables.symbol);
          return payload?.priceUpdated?.symbol === want;
        },
      ),
    },
    workflowStatusUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([TOPIC_WORKFLOW_STATUS_UPDATED]),
        (payload, variables) => {
          const workflow = payload?.workflowStatusUpdated;
          if (!workflow) return false;
          
          // Filter by workflowId if provided
          if (variables.workflowId && workflow.workflowId !== variables.workflowId) {
            return false;
          }
          
          // Filter by userId if provided
          if (variables.userId && workflow.userId !== variables.userId) {
            return false;
          }
          
          return true;
        },
      ),
    },
  },
};

// Map Kafka workflow event types to GraphQL PubSub topics
function mapWorkflowEventToTopic(eventType) {
  return TOPIC_WORKFLOW_STATUS_UPDATED;
}

// Kafka client setup
let kafkaConsumer = null;
const kafka = new Kafka({
  clientId: KAFKA_CLIENT_ID,
  brokers: KAFKA_BROKER.split(',').map(b => b.trim()),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

// Start Kafka consumer for workflow events
async function startWorkflowEventConsumer() {
  try {
    const consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });
    kafkaConsumer = consumer;

    await consumer.connect();
    console.log('[GraphQL] Kafka consumer connected');

    // Subscribe to audit topic where workflow events are published
    await consumer.subscribe({ 
      topic: 'thaliumx.audit', 
      fromBeginning: false // Only consume new messages
    });

    console.log('[GraphQL] Subscribed to thaliumx.audit topic');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event = JSON.parse(message.value.toString());
          
          // Filter for workflow events
          if (event.metadata?.eventType?.startsWith('workflow.')) {
            const workflowId = event.payload?.workflowId;
            const eventType = event.metadata.eventType;
            
            if (!workflowId) {
              console.warn('[GraphQL] Workflow event missing workflowId', { eventType });
              return;
            }

            // Fetch current workflow state from backend
            try {
              const workflowData = await makeBackendRequest(
                'GET', 
                `/api/workflows/${workflowId}/status`, 
                null, 
                { requestId: `kafka-${workflowId}` }
              );
              
              const workflow = workflowData.workflow || workflowData.data?.workflow;
              
              if (workflow) {
                // Update cache
                CACHE.set(`workflow:${workflowId}`, workflow, { ttl: 1_000 });
                
                // Publish to GraphQL PubSub
                pubsub.publish(TOPIC_WORKFLOW_STATUS_UPDATED, {
                  workflowStatusUpdated: workflow
                });
                
                console.log(`[GraphQL] Published workflow event: ${eventType} for workflow ${workflowId}`);
              }
            } catch (err) {
              console.error(`[GraphQL] Failed to fetch workflow ${workflowId} for event ${eventType}:`, err.message);
              // Still publish event with payload data if available
              if (event.payload) {
                pubsub.publish(TOPIC_WORKFLOW_STATUS_UPDATED, {
                  workflowStatusUpdated: {
                    workflowId,
                    workflowType: event.payload.workflowType,
                    status: eventType.includes('completed') ? 'COMPLETED' : 
                            eventType.includes('failed') ? 'FAILED' : 
                            eventType.includes('started') ? 'RUNNING' : 'RUNNING',
                    ...event.payload
                  }
                });
              }
            }
          }
        } catch (err) {
          console.error('[GraphQL] Error processing Kafka message:', err.message);
          // Don't throw - continue processing other messages
        }
      },
    });

    console.log('[GraphQL] Kafka consumer started for workflow events');
  } catch (error) {
    console.error('[GraphQL] Failed to start Kafka consumer:', error.message);
    // Don't crash - GraphQL service can still work without Kafka
    // Frontend can fall back to polling if subscriptions aren't available
  }
}

// Graceful shutdown
async function shutdownKafkaConsumer() {
  if (kafkaConsumer) {
    try {
      await kafkaConsumer.disconnect();
      console.log('[GraphQL] Kafka consumer disconnected');
    } catch (err) {
      console.error('[GraphQL] Error disconnecting Kafka consumer:', err.message);
    }
  }
}

process.on('SIGTERM', async () => {
  await shutdownKafkaConsumer();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownKafkaConsumer();
  process.exit(0);
});

const schema = makeExecutableSchema({ typeDefs, resolvers });

async function startMarketDataPublisher() {
  const last = new Map();
  if (!MARKETDATA_SYMBOLS.length) return;

  // Fetch + publish loop. Keeps one interval, fan-out per symbol.
  setInterval(async () => {
    await Promise.allSettled(
      MARKETDATA_SYMBOLS.map(async s => {
        const symbol = normalizeSymbol(s);
        try {
          // Use a dedicated requestId for the poller.
          const data = await makeBackendRequest('GET', `/api/market/prices/${symbol}`, null, { requestId: `md-${symbol}` });
          const current = {
            symbol,
            price: data.data?.price || 0,
            change24h: data.data?.change24h || 0,
            volume24h: data.data?.volume24h || 0,
            lastUpdated: data.timestamp || new Date().toISOString(),
          };

          const prev = last.get(symbol);
          const delta = prev ? Math.abs((current.price || 0) - (prev.price || 0)) : Infinity;
          last.set(symbol, current);
          CACHE.set(`marketData:${symbol}`, current, { ttl: MARKETDATA_CACHE_TTL_MS });

          if (!prev || delta > MARKETDATA_PUBLISH_EPSILON) {
            pubsub.publish(TOPIC_PRICE_UPDATED, { priceUpdated: current });
          }
        } catch (_err) {
          // Poller must be resilient and never crash the process.
        }
      }),
    );
  }, MARKETDATA_POLL_INTERVAL_MS).unref();
}

async function main() {
  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    schema,
    introspection: process.env.NODE_ENV !== 'production',
    validationRules: [depthLimit(Number(process.env.GQL_MAX_DEPTH || 12))],
    formatError: formattedError => {
      // Avoid leaking backend bodies / internal stack traces.
      const safe = {
        message: formattedError.message,
        locations: formattedError.locations,
        path: formattedError.path,
        extensions: {
          code: formattedError.extensions?.code,
          requestId: formattedError.extensions?.requestId,
        },
      };
      return safe;
    },
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.disable('x-powered-by');
  app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

  app.use(
    '/graphql',
    cors({ origin: true, credentials: true }),
    bodyParser.json({ limit: '1mb' }),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const authHeader = req.headers.authorization;
        const requestId = req.headers['x-request-id'] || makeRequestId();
        return {
          requestId,
          authHeader,
          token: extractBearerTokenFromHeader(authHeader),
        };
      },
    }),
  );

  // GraphQL subscriptions over WebSocket (/graphql)
  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
  useServer(
    {
      schema,
      context: async ctx => {
        const authHeader = ctx.connectionParams?.authorization;
        const requestId = ctx.connectionParams?.['x-request-id'] || makeRequestId();
        return {
          requestId,
          authHeader,
          token: extractBearerTokenFromHeader(authHeader),
        };
      },
      onConnect: async ctx => {
        // Require auth in production for subscription connections.
        if (process.env.NODE_ENV === 'production') {
          const auth = ctx.connectionParams?.authorization;
          if (!extractBearerTokenFromHeader(auth)) throw new Error('Unauthorized');
        }
      },
    },
    wsServer,
  );

  await startMarketDataPublisher();
  await startWorkflowEventConsumer();

  httpServer.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`GraphQL HTTP+WS ready on http://0.0.0.0:${PORT}/graphql (subscriptions on ws://0.0.0.0:${PORT}/graphql)`);
  });
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('Fatal GraphQL startup error:', err);
  process.exit(1);
});
