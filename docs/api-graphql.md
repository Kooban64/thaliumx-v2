# ThaliumX GraphQL API Documentation

## Overview

The GraphQL API serves as a flexible data layer for the ThaliumX trading platform, providing efficient querying of user portfolios, market data, trading history, and real-time price updates.

## Endpoint

- **URL**: `https://api.thaliumx.com/graphql`
- **Method**: POST
- **Authentication**: Bearer token (Zitadel OIDC)

## Schema

### Queries

#### hello
Simple health check query.

```graphql
query {
  hello
}
```

**Response:**
```json
{
  "data": {
    "hello": "Hello from ThaliumX GraphQL API!"
  }
}
```

#### userPortfolio
Get user portfolio information.

```graphql
query {
  userPortfolio(userId: "user-123") {
    id
    userId
    balance
    holdings {
      symbol
      amount
      value
    }
  }
}
```

#### marketData
Get current market data for a symbol.

```graphql
query {
  marketData(symbol: "BTCUSD") {
    symbol
    price
    change24h
    volume24h
    lastUpdated
  }
}
```

#### userProfile
Get user profile information.

```graphql
query {
  userProfile(userId: "user-123") {
    id
    email
    firstName
    lastName
    kycStatus
    kycLevel
    createdAt
  }
}
```

#### tradingHistory
Get user trading history.

```graphql
query {
  tradingHistory(userId: "user-123", limit: 10) {
    id
    userId
    symbol
    side
    amount
    price
    timestamp
  }
}
```

### Mutations

#### placeOrder
Place a new trading order.

```graphql
mutation {
  placeOrder(order: {
    symbol: "BTCUSD"
    side: "BUY"
    amount: 0.1
    price: 45000.00
  }) {
    id
    userId
    symbol
    side
    amount
    price
    status
    createdAt
  }
}
```

#### updateUserProfile
Update user profile information.

```graphql
mutation {
  updateUserProfile(userId: "user-123", input: {
    firstName: "John"
    lastName: "Doe"
    phone: "+1234567890"
  }) {
    id
    email
    firstName
    lastName
    kycStatus
    kycLevel
    createdAt
  }
}
```

### Subscriptions

#### priceUpdated
Real-time price updates for market data.

```graphql
subscription {
  priceUpdated(symbol: "BTCUSD") {
    symbol
    price
    change24h
    volume24h
    lastUpdated
  }
}
```

## Authentication

All requests must include an Authorization header:

```
Authorization: Bearer <zitadel-access-token>
```

## Rate Limiting

- **Queries**: 100 requests per minute per user
- **Mutations**: 10 requests per minute per user
- **Subscriptions**: 5 concurrent connections per user

## Error Handling

Errors are returned in the standard GraphQL format:

```json
{
  "errors": [
    {
      "message": "Backend responded 404 for GET /api/users/user-123/portfolio",
      "locations": [{"line": 3, "column": 5}],
      "path": ["userPortfolio"],
      "extensions": {
        "code": "BACKEND_ERROR",
        "requestId": "abc-123-def",
        "backendStatus": 404
      }
    }
  ]
}
```

## Performance

- **Average Response Time**: <50ms for cached queries
- **P95 Response Time**: <100ms for all queries
- **Concurrent Users**: Supports 10,000+ concurrent connections
- **Caching**: Redis-backed with 500ms TTL for market data

## Security

- All data transmission over HTTPS
- Input validation and sanitization
- Depth limiting (max depth: 12)
- Query complexity analysis
- PII masking in logs

## Monitoring

- Health endpoint: `GET /health`
- Metrics endpoint: `GET /metrics` (Prometheus format)
- Request tracing with `x-request-id` headers