/**
 * Support API Client
 * 
 * Client functions for interacting with the support API endpoints.
 * Handles ticket creation, retrieval, chat sessions, and escalation.
 */

import { apiClient } from './client';

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
  averageResponseTime: number;
  averageResolutionTime: number;
  ticketsByPriority: Record<string, number>;
  ticketsByStatus: Record<string, number>;
}

export interface CreateTicketRequest {
  subject: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  metadata?: {
    chatId?: string;
    issueType?: string;
    department?: string;
    tradingPair?: string;
    orderId?: string;
    transactionHash?: string;
    exchange?: string;
    workflowId?: string;
  };
}

export interface EscalateChatRequest {
  chatId: string;
  subject: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface ListTicketsFilters {
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  limit?: number;
  offset?: number;
}

/**
 * Create a support ticket
 */
export async function createTicket(request: CreateTicketRequest): Promise<Ticket> {
  const response = await apiClient.post('/api/support/tickets', request);
  const data = response.data as any;
  return data.ticket || data.data?.ticket || data;
}

/**
 * Get user's tickets
 */
export async function getTickets(filters?: ListTicketsFilters): Promise<Ticket[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.priority) params.append('priority', filters.priority);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const queryString = params.toString();
  const url = `/api/support/tickets${queryString ? `?${queryString}` : ''}`;
  const response = await apiClient.get(url);
  const data = response.data as any;
  return data.tickets || data.data?.tickets || [];
}

/**
 * Get ticket by ID
 */
export async function getTicket(ticketId: string): Promise<Ticket> {
  const response = await apiClient.get(`/api/support/tickets/${ticketId}`);
  const data = response.data as any;
  return data.ticket || data.data?.ticket || data;
}

/**
 * Create a chat session
 */
export async function createChatSession(): Promise<ChatSession> {
  const response = await apiClient.post('/api/support/chat/sessions', {});
  const data = response.data as any;
  return data.session || data.data?.session || data;
}

/**
 * Get chat session by ID
 */
export async function getChatSession(sessionId: string): Promise<ChatSession> {
  const response = await apiClient.get(`/api/support/chat/sessions/${sessionId}`);
  const data = response.data as any;
  return {
    id: sessionId,
    sessionId,
    userId: data.userId || data.data?.userId || '',
    status: data.status || data.data?.status || 'active',
    messages: data.messages || data.data?.messages || [],
    createdAt: data.createdAt || data.data?.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || data.data?.updatedAt || new Date().toISOString(),
  };
}

/**
 * Escalate chat to ticket
 */
export async function escalateChat(request: EscalateChatRequest): Promise<Ticket> {
  const response = await apiClient.post('/api/support/chat/escalate', request);
  const data = response.data as any;
  return data.ticket || data.data?.ticket || data;
}

/**
 * Get support metrics
 */
export async function getSupportMetrics(): Promise<SupportMetrics> {
  const response = await apiClient.get('/api/support/metrics');
  const data = response.data as any;
  return data.metrics || data.data?.metrics || {
    totalTickets: 0,
    openTickets: 0,
    averageResponseTime: 0,
    averageResolutionTime: 0,
    ticketsByPriority: {},
    ticketsByStatus: {},
  };
}
