/**
 * Support API Client
 * 
 * Client functions for interacting with the support API endpoints.
 * Handles ticket creation, retrieval, chat sessions, and escalation.
 */

import { apiClient } from './client';

type AnyRecord = Record<string, unknown>;

const asRecord = (value: unknown): AnyRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

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
  metadata?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
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
  const response = await apiClient.post<Ticket | { ticket?: Ticket; data?: { ticket?: Ticket } }>('/api/support/tickets', request);
  const data = asRecord(response.data);
  const nested = asRecord(data.data);
  return (data.ticket as Ticket | undefined) || (nested.ticket as Ticket | undefined) || (response.data as Ticket);
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
  const response = await apiClient.get<{ tickets?: Ticket[]; data?: { tickets?: Ticket[] } }>(url);
  const data = asRecord(response.data);
  const nested = asRecord(data.data);
  return asArray<Ticket>(data.tickets) || asArray<Ticket>(nested.tickets);
}

/**
 * Get ticket by ID
 */
export async function getTicket(ticketId: string): Promise<Ticket> {
  const response = await apiClient.get<Ticket | { ticket?: Ticket; data?: { ticket?: Ticket } }>(`/api/support/tickets/${ticketId}`);
  const data = asRecord(response.data);
  const nested = asRecord(data.data);
  return (data.ticket as Ticket | undefined) || (nested.ticket as Ticket | undefined) || (response.data as Ticket);
}

/**
 * Create a chat session
 */
export async function createChatSession(): Promise<ChatSession> {
  const response = await apiClient.post<ChatSession | { session?: ChatSession; data?: { session?: ChatSession } }>('/api/support/chat/sessions', {});
  const data = asRecord(response.data);
  const nested = asRecord(data.data);
  return (data.session as ChatSession | undefined) || (nested.session as ChatSession | undefined) || (response.data as ChatSession);
}

/**
 * Get chat session by ID
 */
export async function getChatSession(sessionId: string): Promise<ChatSession> {
  const response = await apiClient.get(`/api/support/chat/sessions/${sessionId}`);
  const data = asRecord(response.data);
  const nested = asRecord(data.data);
  return {
    id: sessionId,
    sessionId,
    userId: (data.userId as string | undefined) || (nested.userId as string | undefined) || '',
    status: ((data.status as ChatSession['status'] | undefined) || (nested.status as ChatSession['status'] | undefined) || 'active'),
    messages: asArray<ChatMessage>(data.messages) || asArray<ChatMessage>(nested.messages),
    createdAt: (data.createdAt as string | undefined) || (nested.createdAt as string | undefined) || new Date().toISOString(),
    updatedAt: (data.updatedAt as string | undefined) || (nested.updatedAt as string | undefined) || new Date().toISOString(),
  };
}

/**
 * Escalate chat to ticket
 */
export async function escalateChat(request: EscalateChatRequest): Promise<Ticket> {
  const response = await apiClient.post<Ticket | { ticket?: Ticket; data?: { ticket?: Ticket } }>('/api/support/chat/escalate', request);
  const data = asRecord(response.data);
  const nested = asRecord(data.data);
  return (data.ticket as Ticket | undefined) || (nested.ticket as Ticket | undefined) || (response.data as Ticket);
}

/**
 * Get support metrics
 */
export async function getSupportMetrics(): Promise<SupportMetrics> {
  const response = await apiClient.get<{ metrics?: SupportMetrics; data?: { metrics?: SupportMetrics } }>('/api/support/metrics');
  const data = asRecord(response.data);
  const nested = asRecord(data.data);
  return (data.metrics as SupportMetrics | undefined) || (nested.metrics as SupportMetrics | undefined) || {
    totalTickets: 0,
    openTickets: 0,
    averageResponseTime: 0,
    averageResolutionTime: 0,
    ticketsByPriority: {},
    ticketsByStatus: {},
  };
}
