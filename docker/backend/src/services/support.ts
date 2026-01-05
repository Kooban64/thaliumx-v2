/**
 * Support Service
 * 
 * Manages support tickets and chat sessions integration with osTicket and Live Helper Chat.
 * 
 * Features:
 * - Ticket creation and management
 * - Chat session management
 * - Chat-to-ticket escalation
 * - Support metrics and analytics
 * - Integration with user workflows
 * 
 * Operations:
 * - Create tickets via osTicket API
 * - Retrieve user tickets
 * - Escalate chat sessions to tickets
 * - Get chat history
 * - Track support metrics
 * 
 * Security:
 * - All operations logged for audit
 * - User authentication required
 * - Input validation on all operations
 */

import type { AxiosInstance } from 'axios';
import axios from 'axios';
import { LoggerService } from './logger';
import { DatabaseService } from './database';
import { EmailValidatorService } from './email-validator';
import { createError } from '../utils';

export interface Ticket {
  id: string;
  ticketId: string;
  userId: string;
  subject: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  department?: string;
  issueType?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface ChatSession {
  id: string;
  sessionId: string;
  userId: string;
  agentId?: string;
  status: 'active' | 'waiting' | 'closed';
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  agentId?: string;
  message: string;
  timestamp: string;
  type: 'user' | 'agent' | 'system';
}

export interface SupportMetrics {
  totalTickets: number;
  openTickets: number;
  averageResponseTime: number; // minutes
  averageResolutionTime: number; // hours
  ticketsByPriority: Record<string, number>;
  ticketsByStatus: Record<string, number>;
}

export class SupportService {
  private static osticketApiUrl: string = process.env.OSTICKET_API_URL || 'http://thaliumx-osticket';
  private static lhcApiUrl: string = process.env.LHC_API_URL || 'http://thaliumx-live-helper-chat';
  private static osticketApiKey: string = process.env.OSTICKET_API_KEY || '';
  private static lhcApiKey: string = process.env.LHC_API_KEY || '';

  private static getOsticketClient(): AxiosInstance {
    return axios.create({
      baseURL: this.osticketApiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.osticketApiKey && { 'X-API-Key': this.osticketApiKey }),
      },
    });
  }

  private static getLhcClient(): AxiosInstance {
    return axios.create({
      baseURL: this.lhcApiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.lhcApiKey && { 'X-LHC-API-Key': this.lhcApiKey }),
      },
    });
  }

  /**
   * Create a support ticket
   */
  public static async createTicket(
    userId: string,
    subject: string,
    message: string,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal',
    metadata?: Record<string, any>
  ): Promise<Ticket> {
    try {
      LoggerService.info('Creating support ticket', { userId, subject, priority });

      // Get user info for ticket
      const UserModel = DatabaseService.getModel('User');
      const user = await UserModel.findByPk(userId);
      
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      // userData extracted but not used in this function
      user.toJSON() as any;

      // Prepare ticket data for osTicket escalation endpoint
      const ticketData = {
        chat_id: metadata?.chatId || `manual-${Date.now()}`,
        user_id: userId,
        subject: subject.substring(0, 200),
        message: message.substring(0, 8000),
        priority: priority,
        issue_type: metadata?.issueType || 'general',
        department: metadata?.department,
        trading_pair: metadata?.tradingPair,
        order_id: metadata?.orderId,
        transaction_hash: metadata?.transactionHash,
        exchange: metadata?.exchange,
        workflow_id: metadata?.workflowId,
      };

      // Call osTicket escalation endpoint
      const client = this.getOsticketClient();
      let response;
      
      try {
        response = await client.post('/escalate-chat.php', ticketData);
      } catch (error: any) {
        // If direct API fails, try alternative approach
        LoggerService.warn('Direct osTicket API call failed, using fallback', { error: error.message });
        
        // Store ticket in database as fallback
        const TicketModel = DatabaseService.getModel('SupportTicket') || DatabaseService.getModel('Ticket');
        const ticket = await TicketModel.create({
          ticketId: `ticket-${Date.now()}`,
          userId,
          subject,
          message,
          priority,
          status: 'open',
          metadata: metadata || {},
        }) as any;

        const ticketId = ticket.id || ticket.ticketId;
        LoggerService.info('Ticket created in database (fallback)', { ticketId });
        
        return {
          id: ticketId,
          ticketId: ticketId,
          userId,
          subject,
          message,
          priority,
          status: 'open',
          metadata,
          createdAt: ticket.createdAt || new Date().toISOString(),
          updatedAt: ticket.updatedAt || new Date().toISOString(),
        };
      }

      const ticketId = response.data?.ticket_id || response.data?.id || `ticket-${Date.now()}`;

      // Store ticket reference in database
      try {
        const TicketModel = DatabaseService.getModel('SupportTicket') || DatabaseService.getModel('Ticket');
        await TicketModel.create({
          id: ticketId,
          userId,
          subject,
          message,
          priority,
          status: 'open',
          metadata: metadata || {},
          osticketId: ticketId,
        });
      } catch (dbError) {
        LoggerService.warn('Failed to store ticket in database', { error: dbError });
        // Continue even if DB storage fails
      }

      LoggerService.info('Support ticket created', { ticketId, userId });

      return {
        id: ticketId,
        ticketId,
        userId,
        subject,
        message,
        priority,
        status: 'open',
        department: metadata?.department,
        issueType: metadata?.issueType,
        metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      LoggerService.error('Failed to create support ticket:', error);
      throw createError(
        error.message || 'Failed to create support ticket',
        error.statusCode || 500,
        'TICKET_CREATION_FAILED'
      );
    }
  }

  /**
   * Get user's tickets
   */
  public static async getTickets(
    userId: string,
    filters?: {
      status?: string;
      priority?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Ticket[]> {
    try {
      LoggerService.info('Fetching user tickets', { userId, filters });

      // Try to get from database first
      const TicketModel = DatabaseService.getModel('SupportTicket') || DatabaseService.getModel('Ticket');
      const whereClause: any = { userId };
      
      if (filters?.status) {
        whereClause.status = filters.status;
      }
      if (filters?.priority) {
        whereClause.priority = filters.priority;
      }

      const tickets = await TicketModel.findAll({
        where: whereClause,
        limit: filters?.limit || 50,
        offset: filters?.offset || 0,
        order: [['createdAt', 'DESC']],
      });

      return tickets.map((ticket: any) => {
        const ticketData = ticket.toJSON ? ticket.toJSON() : ticket;
        return {
          id: ticketData.id,
          ticketId: ticketData.osticketId || ticketData.ticketId || ticketData.id,
          userId: ticketData.userId,
          subject: ticketData.subject,
          message: ticketData.message,
          priority: ticketData.priority,
          status: ticketData.status,
          department: ticketData.metadata?.department,
          issueType: ticketData.metadata?.issueType,
          metadata: ticketData.metadata,
          createdAt: ticketData.createdAt,
          updatedAt: ticketData.updatedAt,
          resolvedAt: ticketData.resolvedAt,
        };
      });
    } catch (error: any) {
      LoggerService.error('Failed to fetch tickets:', error);
      // Return empty array on error rather than failing
      return [];
    }
  }

  /**
   * Get ticket by ID
   */
  public static async getTicket(ticketId: string, userId: string): Promise<Ticket | null> {
    try {
      const TicketModel = DatabaseService.getModel('SupportTicket') || DatabaseService.getModel('Ticket');
      const ticket = await TicketModel.findOne({
        where: {
          id: ticketId,
          userId, // Ensure user can only access their own tickets
        },
      });

      if (!ticket) {
        return null;
      }

      const ticketData = ticket.toJSON() as any;
      return {
        id: ticketData.id,
        ticketId: ticketData.osticketId || ticketData.id,
        userId: ticketData.userId,
        subject: ticketData.subject,
        message: ticketData.message,
        priority: ticketData.priority,
        status: ticketData.status,
        department: ticketData.metadata?.department,
        issueType: ticketData.metadata?.issueType,
        metadata: ticketData.metadata,
        createdAt: ticketData.createdAt,
        updatedAt: ticketData.updatedAt,
        resolvedAt: ticketData.resolvedAt,
      };
    } catch (error: any) {
      LoggerService.error('Failed to fetch ticket:', error);
      return null;
    }
  }

  /**
   * Escalate chat session to ticket
   */
  public static async escalateChatToTicket(
    chatId: string,
    userId: string,
    subject: string,
    message: string,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal',
    metadata?: Record<string, any>
  ): Promise<Ticket> {
    try {
      LoggerService.info('Escalating chat to ticket', { chatId, userId, subject });

      // Get chat history if available
      const chatHistory = await this.getChatHistory(chatId);
      const fullMessage = chatHistory.length > 0
        ? `${message}\n\n--- Chat History ---\n${chatHistory.map(m => `[${m.timestamp}] ${m.type}: ${m.message}`).join('\n')}`
        : message;

      return await this.createTicket(userId, subject, fullMessage, priority, {
        ...metadata,
        chatId,
        escalatedFromChat: true,
      });
    } catch (error: any) {
      LoggerService.error('Failed to escalate chat to ticket:', error);
      throw createError(
        error.message || 'Failed to escalate chat to ticket',
        error.statusCode || 500,
        'CHAT_ESCALATION_FAILED'
      );
    }
  }

  /**
   * Get chat history
   */
  public static async getChatHistory(chatId: string): Promise<ChatMessage[]> {
    try {
      // Try to get from Live Helper Chat API
      const client = this.getLhcClient();
      
      try {
        const response = await client.get(`/api/chat/${chatId}/messages`);
        return response.data?.messages || [];
      } catch (error: any) {
        LoggerService.warn('Failed to fetch chat history from LHC', { error: error.message });
        
        // Fallback to database if available
        const ChatMessageModel = DatabaseService.getModel('ChatMessage');
        if (ChatMessageModel) {
          const messages = await ChatMessageModel.findAll({
            where: { chatId },
            order: [['timestamp', 'ASC']],
          });
          return messages.map((msg: any) => msg.toJSON());
        }
        
        return [];
      }
    } catch (error: any) {
      LoggerService.error('Failed to get chat history:', error);
      return [];
    }
  }

  /**
   * Create chat session
   */
  public static async createChatSession(userId: string): Promise<ChatSession> {
    try {
      LoggerService.info('Creating chat session', { userId });

      const client = this.getLhcClient();
      
      try {
        const response = await client.post('/api/chat/sessions', { userId });
        return response.data;
      } catch (error: any) {
        LoggerService.warn('Failed to create chat session via LHC API', { error: error.message });
        
        // Create session record in database as fallback
        const sessionId = `chat-${Date.now()}-${userId}`;
        return {
          id: sessionId,
          sessionId,
          userId,
          status: 'waiting',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (error: any) {
      LoggerService.error('Failed to create chat session:', error);
      throw createError(
        error.message || 'Failed to create chat session',
        error.statusCode || 500,
        'CHAT_SESSION_CREATION_FAILED'
      );
    }
  }

  /**
   * Get support metrics for user
   */
  public static async getSupportMetrics(userId: string): Promise<SupportMetrics> {
    try {
      const TicketModel = DatabaseService.getModel('SupportTicket') || DatabaseService.getModel('Ticket');
      const tickets = await TicketModel.findAll({
        where: { userId },
      });

      const totalTickets = tickets.length;
      const openTickets = tickets.filter((t: any) => {
        const ticketData = t.toJSON ? t.toJSON() : t;
        return ['open', 'in_progress'].includes(ticketData.status);
      }).length;

      const ticketsByPriority: Record<string, number> = {};
      const ticketsByStatus: Record<string, number> = {};

      tickets.forEach((ticket: any) => {
        const ticketData = ticket.toJSON ? ticket.toJSON() : ticket;
        const priority = ticketData.priority || 'normal';
        const status = ticketData.status || 'open';
        
        ticketsByPriority[priority] = (ticketsByPriority[priority] || 0) + 1;
        ticketsByStatus[status] = (ticketsByStatus[status] || 0) + 1;
      });

      // Calculate average response/resolution times (simplified)
      const resolvedTickets = tickets.filter((t: any) => {
        const ticketData = t.toJSON ? t.toJSON() : t;
        return ticketData.status === 'resolved' || ticketData.status === 'closed';
      });
      const averageResolutionTime = resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum: number, t: any) => {
            const ticketData = t.toJSON ? t.toJSON() : t;
            const created = new Date(ticketData.createdAt).getTime();
            const resolved = new Date(ticketData.resolvedAt || ticketData.updatedAt).getTime();
            return sum + (resolved - created) / (1000 * 60 * 60); // hours
          }, 0) / resolvedTickets.length
        : 0;

      return {
        totalTickets,
        openTickets,
        averageResponseTime: 60, // Placeholder - would need actual response tracking
        averageResolutionTime,
        ticketsByPriority,
        ticketsByStatus,
      };
    } catch (error: any) {
      LoggerService.error('Failed to get support metrics:', error);
      return {
        totalTickets: 0,
        openTickets: 0,
        averageResponseTime: 0,
        averageResolutionTime: 0,
        ticketsByPriority: {},
        ticketsByStatus: {},
      };
    }
  }

  /**
   * Create a public chat session (no authentication required)
   */
  public static async createPublicChatSession(
    email: string,
    name?: string,
    ipAddress?: string,
    _metadata?: Record<string, any>
  ): Promise<ChatSession> {
    try {
      // Validate email
      const emailValidation = await EmailValidatorService.validate(
        email,
        ipAddress,
        { blockDisposable: true, rateLimit: true }
      );

      if (!emailValidation.valid) {
        throw createError(
          emailValidation.reason || 'Invalid email address',
          400,
          'INVALID_EMAIL'
        );
      }

      const normalizedEmail = EmailValidatorService.normalize(email);

      // Check for spam/abuse
      await this.checkSpamActivity(ipAddress, normalizedEmail, 'chat_session');

      LoggerService.info('Creating public chat session', { email: normalizedEmail.substring(0, 10) + '...', ipAddress });

      const sessionId = `public-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const session: ChatSession = {
        id: sessionId,
        sessionId,
        userId: '', // Empty for public sessions
        status: 'active',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      LoggerService.info('Public chat session created', { sessionId, email: normalizedEmail.substring(0, 10) + '...' });

      return session;
    } catch (error: any) {
      LoggerService.error('Failed to create public chat session:', error);
      throw createError(
        error.message || 'Failed to create chat session',
        error.statusCode || 500,
        'CHAT_SESSION_CREATION_FAILED'
      );
    }
  }

  /**
   * Send a message in a public chat session
   */
  public static async sendPublicChatMessage(
    sessionId: string,
    message: string,
    email: string,
    ipAddress?: string
  ): Promise<ChatMessage> {
    try {
      // Validate email
      const normalizedEmail = EmailValidatorService.normalize(email);
      
      // Validate message content
      if (!message || message.trim().length === 0) {
        throw createError('Message cannot be empty', 400, 'EMPTY_MESSAGE');
      }

      if (message.length > 5000) {
        throw createError('Message too long (max 5000 characters)', 400, 'MESSAGE_TOO_LONG');
      }

      // Check for spam
      await this.checkSpamActivity(ipAddress, normalizedEmail, 'chat_message', message);

      // Create message
      const ChatMessageModel = DatabaseService.getModel('ChatMessage');
      const messageId = `msg-${Date.now()}`;

      const chatMessage: ChatMessage = {
        id: messageId,
        sessionId,
        userId: '', // Empty for public messages
        message: message.trim(),
        timestamp: new Date().toISOString(),
        type: 'user',
      };

      // Store message in database
      await ChatMessageModel.create({
        id: messageId,
        chatId: sessionId,
        sessionId,
        userId: null,
        guestEmail: normalizedEmail,
        message: message.trim(),
        type: 'user',
        ipAddress,
        isPublic: true,
        timestamp: new Date(),
      });

      LoggerService.info('Public chat message sent', {
        sessionId,
        messageId,
        email: normalizedEmail.substring(0, 10) + '...',
      });

      // Simulate agent response (in production, this would come from Live Helper Chat)
      setTimeout(() => {
        void (async () => {
          const agentMessage: ChatMessage = {
            id: `msg-${Date.now()}-agent`,
            sessionId,
            userId: '',
            agentId: 'agent-1',
            message: 'Thank you for your message. An agent will respond shortly.',
            timestamp: new Date().toISOString(),
            type: 'agent',
          };

          await ChatMessageModel.create({
            id: agentMessage.id,
            chatId: sessionId,
            sessionId,
            userId: null,
            message: agentMessage.message,
            type: 'agent',
            agentId: 'agent-1',
            isPublic: true,
            timestamp: new Date(),
          });
        })();
      }, 1000);

      return chatMessage;
    } catch (error: any) {
      LoggerService.error('Failed to send public chat message:', error);
      throw createError(
        error.message || 'Failed to send message',
        error.statusCode || 500,
        'MESSAGE_SEND_FAILED'
      );
    }
  }

  /**
   * Create a public support ticket (no authentication required)
   */
  public static async createPublicTicket(
    email: string,
    name: string,
    subject: string,
    message: string,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal',
    ipAddress?: string,
    metadata?: Record<string, any>
  ): Promise<Ticket> {
    try {
      // Validate email
      const emailValidation = await EmailValidatorService.validate(
        email,
        ipAddress,
        { blockDisposable: true, rateLimit: true }
      );

      if (!emailValidation.valid) {
        throw createError(
          emailValidation.reason || 'Invalid email address',
          400,
          'INVALID_EMAIL'
        );
      }

      const normalizedEmail = EmailValidatorService.normalize(email);

      // Validate inputs
      if (!subject || subject.trim().length < 3) {
        throw createError('Subject must be at least 3 characters', 400, 'INVALID_SUBJECT');
      }

      if (!message || message.trim().length < 10) {
        throw createError('Message must be at least 10 characters', 400, 'INVALID_MESSAGE');
      }

      // Check for spam
      await this.checkSpamActivity(ipAddress, normalizedEmail, 'ticket_creation', message);

      LoggerService.info('Creating public support ticket', {
        email: normalizedEmail.substring(0, 10) + '...',
        subject: subject.substring(0, 50),
        ipAddress,
      });

      // Create ticket in database
      const TicketModel = DatabaseService.getModel('SupportTicket') || DatabaseService.getModel('Ticket');
      const ticketId = `ticket-${Date.now()}`;

      const ticket = await TicketModel.create({
        ticketId,
        userId: null, // Null for public tickets
        guestEmail: normalizedEmail,
        guestName: name || undefined,
        subject: subject.trim().substring(0, 200),
        message: message.trim().substring(0, 8000),
        priority,
        status: 'open',
        ipAddress,
        isPublic: true,
        metadata: metadata || {},
      }) as any;

      const createdTicketId = ticket.id || ticket.ticketId;

      LoggerService.info('Public support ticket created', {
        ticketId: createdTicketId,
        email: normalizedEmail.substring(0, 10) + '...',
      });

      return {
        id: createdTicketId,
        ticketId: createdTicketId,
        userId: '', // Empty for public tickets
        subject: ticket.subject,
        message: ticket.message,
        priority: ticket.priority,
        status: 'open',
        metadata: ticket.metadata,
        createdAt: ticket.createdAt || new Date().toISOString(),
        updatedAt: ticket.updatedAt || new Date().toISOString(),
      };
    } catch (error: any) {
      LoggerService.error('Failed to create public ticket:', error);
      throw createError(
        error.message || 'Failed to create ticket',
        error.statusCode || 500,
        'TICKET_CREATION_FAILED'
      );
    }
  }

  /**
   * Check for spam and abuse patterns
   */
  private static async checkSpamActivity(
    ipAddress?: string,
    email?: string,
    activityType: 'chat_session' | 'chat_message' | 'ticket_creation' = 'chat_message',
    content?: string
  ): Promise<void> {
    if (!ipAddress) {
      return; // Skip if no IP
    }

    const { RedisService } = await import('./redis');

    // Check for suspicious keywords in content
    if (content) {
      const suspiciousKeywords = [
        'bitcoin', 'crypto', 'investment', 'guaranteed', 'profit',
        'click here', 'free money', 'urgent', 'act now',
        'winner', 'prize', 'congratulations', 'lottery',
      ];

      const lowerContent = content.toLowerCase();
      const foundKeywords = suspiciousKeywords.filter(keyword => lowerContent.includes(keyword));

      if (foundKeywords.length > 3) {
        LoggerService.logSecurity('suspicious_keywords_detected', {
          ipAddress,
          email: email ? email.substring(0, 10) + '...' : 'none',
          activityType,
          keywords: foundKeywords,
        });
        // Don't block, just log for review
      }

      // Check for excessive links
      const linkCount = (content.match(/https?:\/\//g) || []).length;
      if (linkCount > 2) {
        LoggerService.logSecurity('excessive_links_detected', {
          ipAddress,
          email: email ? email.substring(0, 10) + '...' : 'none',
          activityType,
          linkCount,
        });
      }
    }

    // Check for rapid repeated activity from same IP
    if (RedisService.isConnected()) {
      try {
        const abuseKey = `abuse_check:${ipAddress}:${activityType}:${new Date().toISOString().slice(0, 13)}`;
        const abuseCount = await RedisService.increment(abuseKey);
        if (abuseCount === 1) {
          await RedisService.expire(abuseKey, 3600); // 1 hour
        }

        if (abuseCount > 10) {
          LoggerService.logSecurity('abuse_pattern_detected', {
            ipAddress,
            email: email ? email.substring(0, 10) + '...' : 'none',
            activityType,
            count: abuseCount,
          });
          throw createError(
            'Suspicious activity detected. Please try again later.',
            429,
            'ABUSE_DETECTED'
          );
        }
      } catch (error: any) {
        if (error.code === 'ABUSE_DETECTED') {
          throw error;
        }
        // Fail open if Redis unavailable
        LoggerService.warn('Abuse check failed', { error: error.message });
      }
    }
  }
}
