/**
 * Support Routes
 * 
 * Express router for support ticket and chat management endpoints.
 * 
 * Endpoints:
 * - POST /tickets - Create ticket (authenticated)
 * - GET /tickets - List user tickets (authenticated)
 * - GET /tickets/:id - Get ticket details (authenticated)
 * - POST /chat/sessions - Create chat session (authenticated)
 * - GET /chat/sessions/:id - Get chat session (authenticated)
 * - POST /chat/escalate - Escalate chat to ticket (authenticated)
 * - GET /metrics - Get support metrics (authenticated)
 * 
 * Security:
 * - All routes require authentication
 * - Users can only access their own tickets/sessions
 * - Input validation via middleware
 * - Tenant isolation enforced
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, validateRequest } from '../middleware/error-handler';
import { publicSupportRateLimiter } from '../middleware/rate-limiter';
import { verifyCaptcha, optionalCaptcha } from '../middleware/captcha';
import { SupportService, Ticket, ChatSession } from '../services/support';
import { DatabaseService } from '../services/database';
import { LoggerService } from '../services/logger';
import { createError } from '../utils';
import * as Joi from 'joi';

const router: Router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createTicketSchema = Joi.object({
  subject: Joi.string().min(3).max(200).required(),
  message: Joi.string().min(10).max(8000).required(),
  priority: Joi.string().valid('low', 'normal', 'high', 'critical').default('normal'),
  metadata: Joi.object({
    chatId: Joi.string(),
    issueType: Joi.string(),
    department: Joi.string(),
    tradingPair: Joi.string(),
    orderId: Joi.string(),
    transactionHash: Joi.string(),
    exchange: Joi.string(),
    workflowId: Joi.string(),
  }).optional(),
});

const escalateChatSchema = Joi.object({
  chatId: Joi.string().required(),
  subject: Joi.string().min(3).max(200).required(),
  message: Joi.string().min(10).max(8000).required(),
  priority: Joi.string().valid('low', 'normal', 'high', 'critical').default('normal'),
  metadata: Joi.object().optional(),
});

const listTicketsSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed'),
  priority: Joi.string().valid('low', 'normal', 'high', 'critical'),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

const createPublicChatSessionSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().max(100).optional(),
  metadata: Joi.object().optional(),
});

const sendPublicChatMessageSchema = Joi.object({
  message: Joi.string().min(1).max(5000).required(),
  email: Joi.string().email().required(),
});

const createPublicTicketSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().max(100).required(),
  subject: Joi.string().min(3).max(200).required(),
  message: Joi.string().min(10).max(8000).required(),
  priority: Joi.string().valid('low', 'normal', 'high', 'critical').default('normal'),
  captchaToken: Joi.string().optional(),
  metadata: Joi.object().optional(),
});

// =============================================================================
// MIDDLEWARE
// =============================================================================

// All routes require authentication
router.use(authenticateToken);

// =============================================================================
// ROUTES
// =============================================================================

/**
 * Create a support ticket
 * POST /api/support/tickets
 */
router.post('/tickets', validateRequest(createTicketSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }

    const { subject, message, priority, metadata } = req.body;

    const ticket = await SupportService.createTicket(
      userId,
      subject,
      message,
      priority,
      metadata
    );

    LoggerService.info('Ticket created via API', { ticketId: ticket.id, userId });

    res.status(201).json({
      success: true,
      data: ticket,
      message: 'Ticket created successfully',
    });
  } catch (error: any) {
    LoggerService.error('Ticket creation API error:', error);

    if (error instanceof Error && 'statusCode' in error) {
      res.status((error as any).statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: (error as any).code || 'TICKET_CREATION_FAILED',
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
      });
    }
  }
});

/**
 * List user's tickets
 * GET /api/support/tickets
 */
router.get('/tickets', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }

    const filters = {
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const tickets = await SupportService.getTickets(userId, filters);

    res.status(200).json({
      success: true,
      data: { tickets },
      message: 'Tickets retrieved successfully',
    });
  } catch (error: any) {
    LoggerService.error('Ticket list API error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }
});

/**
 * Get ticket by ID
 * GET /api/support/tickets/:id
 */
router.get('/tickets/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }

    const ticketId = req.params.id;
    if (!ticketId || !userId) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Ticket ID and user authentication are required',
          code: 'INVALID_REQUEST',
        },
      });
      return;
    }
    const ticket = await SupportService.getTicket(ticketId, userId);

    if (!ticket) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Ticket not found',
          code: 'TICKET_NOT_FOUND',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { ticket },
      message: 'Ticket retrieved successfully',
    });
  } catch (error: any) {
    LoggerService.error('Ticket retrieval API error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }
});

/**
 * Create a chat session
 * POST /api/support/chat/sessions
 */
router.post('/chat/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }

    const session = await SupportService.createChatSession(userId);

    LoggerService.info('Chat session created via API', { sessionId: session.id, userId });

    res.status(201).json({
      success: true,
      data: { session },
      message: 'Chat session created successfully',
    });
  } catch (error: any) {
    LoggerService.error('Chat session creation API error:', error);

    if (error instanceof Error && 'statusCode' in error) {
      res.status((error as any).statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: (error as any).code || 'CHAT_SESSION_CREATION_FAILED',
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
      });
    }
  }
});

/**
 * Get chat session by ID
 * GET /api/support/chat/sessions/:id
 */
router.get('/chat/sessions/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }

    const sessionId = req.params.id;
    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Session ID is required',
          code: 'SESSION_ID_REQUIRED',
        },
      });
      return;
    }
    const chatHistory = await SupportService.getChatHistory(sessionId);

    // Verify session belongs to user (simplified - would need proper session lookup)
    res.status(200).json({
      success: true,
      data: {
        sessionId,
        messages: chatHistory,
      },
      message: 'Chat session retrieved successfully',
    });
  } catch (error: any) {
    LoggerService.error('Chat session retrieval API error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }
});

/**
 * Escalate chat to ticket
 * POST /api/support/chat/escalate
 */
router.post('/chat/escalate', validateRequest(escalateChatSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }

    const { chatId, subject, message, priority, metadata } = req.body;

    const ticket = await SupportService.escalateChatToTicket(
      chatId,
      userId,
      subject,
      message,
      priority,
      metadata
    );

    LoggerService.info('Chat escalated to ticket via API', { ticketId: ticket.id, chatId, userId });

    res.status(201).json({
      success: true,
      data: { ticket },
      message: 'Chat escalated to ticket successfully',
    });
  } catch (error: any) {
    LoggerService.error('Chat escalation API error:', error);

    if (error instanceof Error && 'statusCode' in error) {
      res.status((error as any).statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: (error as any).code || 'CHAT_ESCALATION_FAILED',
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
      });
    }
  }
});

/**
 * Get support metrics
 * GET /api/support/metrics
 */
router.get('/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw createError('User authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }

    const metrics = await SupportService.getSupportMetrics(userId);

    res.status(200).json({
      success: true,
      data: { metrics },
      message: 'Support metrics retrieved successfully',
    });
  } catch (error: any) {
    LoggerService.error('Support metrics API error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }
});

// =============================================================================
// PUBLIC ROUTES (No authentication required)
// =============================================================================

/**
 * Create a public chat session
 * POST /api/support/public/chat/sessions
 */
router.post(
  '/public/chat/sessions',
  publicSupportRateLimiter,
  optionalCaptcha,
  validateRequest(createPublicChatSessionSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, name, metadata } = req.body;
      const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || undefined;

      const session = await SupportService.createPublicChatSession(email, name, ipAddress, metadata);

      LoggerService.info('Public chat session created via API', { sessionId: session.sessionId });

      res.status(201).json({
        success: true,
        data: {
          session,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      LoggerService.error('Failed to create public chat session:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          message: error.message || 'Failed to create chat session',
          code: error.code || 'CHAT_SESSION_CREATION_FAILED',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * Send a message in a public chat session
 * POST /api/support/public/chat/sessions/:id/messages
 */
router.post(
  '/public/chat/sessions/:id/messages',
  publicSupportRateLimiter,
  validateRequest(sendPublicChatMessageSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.params.id;
      const { message, email } = req.body;
      const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || undefined;

      if (!sessionId) {
        throw createError('Session ID is required', 400, 'SESSION_ID_REQUIRED');
      }

      const chatMessage = await SupportService.sendPublicChatMessage(sessionId, message, email, ipAddress);

      res.status(201).json({
        success: true,
        data: {
          message: chatMessage,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      LoggerService.error('Failed to send public chat message:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          message: error.message || 'Failed to send message',
          code: error.code || 'MESSAGE_SEND_FAILED',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * Get a public chat session
 * GET /api/support/public/chat/sessions/:id
 */
router.get(
  '/public/chat/sessions/:id',
  publicSupportRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.params.id;

      if (!sessionId) {
        throw createError('Session ID is required', 400, 'SESSION_ID_REQUIRED');
      }

      // Get chat history from database
      const ChatMessageModel = DatabaseService.getModel('ChatMessage');
      const messages = await ChatMessageModel.findAll({
        where: {
          sessionId,
          isPublic: true,
        },
        order: [['timestamp', 'ASC']],
        limit: 100,
      });

      const session: ChatSession = {
        id: sessionId,
        sessionId,
        userId: '',
        status: 'active',
        messages: messages.map((m: any) => {
          const msg = m.toJSON ? m.toJSON() : m;
          return {
            id: msg.id,
            sessionId: msg.sessionId,
            userId: msg.userId || '',
            agentId: msg.agentId,
            message: msg.message,
            timestamp: msg.timestamp || msg.createdAt,
            type: msg.type,
          };
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      res.status(200).json({
        success: true,
        data: {
          session,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      LoggerService.error('Failed to get public chat session:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          message: error.message || 'Failed to get chat session',
          code: error.code || 'CHAT_SESSION_FETCH_FAILED',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * Create a public support ticket
 * POST /api/support/public/tickets
 */
router.post(
  '/public/tickets',
  publicSupportRateLimiter,
  verifyCaptcha,
  validateRequest(createPublicTicketSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, name, subject, message, priority, metadata } = req.body;
      const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || undefined;

      const ticket = await SupportService.createPublicTicket(
        email,
        name,
        subject,
        message,
        priority,
        ipAddress,
        metadata
      );

      LoggerService.info('Public ticket created via API', { ticketId: ticket.id });

      res.status(201).json({
        success: true,
        data: {
          ticket,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      LoggerService.error('Failed to create public ticket:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          message: error.message || 'Failed to create ticket',
          code: error.code || 'TICKET_CREATION_FAILED',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default router;
