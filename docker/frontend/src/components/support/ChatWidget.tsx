/**
 * Chat Widget Component
 * 
 * Floating chat widget for Live Helper Chat integration.
 * Provides real-time chat support with agents.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MessageCircle, X, Send, Minimize2 } from 'lucide-react';
import { createChatSession, escalateChat, type ChatMessage, type ChatSession } from '@/lib/api/support';

interface ChatWidgetProps {
  userId?: string;
  className?: string;
  isPublic?: boolean; // If true, widget works in public/guest mode
}

// Get userId from auth context or API
async function getUserId(): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined;
  
  try {
    // Try to get from API profile endpoint
    const response = await fetch('/api/auth/profile', {
      credentials: 'include',
    });
    if (response.ok) {
      const data = await response.json();
      const user = data?.data?.user || data?.data;
      return user?.id || user?.userId;
    }
  } catch {
    // Ignore errors - will create session without userId
  }
  
  return undefined;
}

export function ChatWidget({ userId: propUserId, className, isPublic = false }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [emailError, setEmailError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get userId from prop or context
  const userId = propUserId;

  // Initialize chat session
  useEffect(() => {
    if (isOpen && !session) {
      if (isPublic) {
        // Public mode: require email before starting chat
        if (!guestEmail) {
          setShowEmailForm(true);
          return;
        }
        initializePublicChat();
      } else {
        // Authenticated mode: get userId if not provided
        if (!userId) {
          getUserId().then((id) => {
            if (id) {
              initializeChat();
            } else {
              // Fallback to guest mode if no auth
              setShowEmailForm(true);
            }
          });
        } else {
          initializeChat();
        }
      }
    }
  }, [isOpen, session, userId, isPublic, guestEmail]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailSubmit = async () => {
    if (!guestEmail.trim()) {
      setEmailError('Email is required');
      return;
    }
    if (!validateEmail(guestEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailError('');
    setShowEmailForm(false);
    await initializePublicChat();
  };

  const initializeChat = async () => {
    try {
      setIsLoading(true);
      const newSession = await createChatSession();
      setSession(newSession);
      setMessages(newSession.messages || []);
      setIsConnected(true);
      
      // Connect to WebSocket for real-time messages
      // Note: In production, this would connect to Live Helper Chat WebSocket
      // For now, we'll simulate with polling or direct API calls
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const initializePublicChat = async () => {
    try {
      setIsLoading(true);
      // Use public API endpoint
      const response = await fetch('/api/support/public/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: guestEmail,
          name: guestName || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create chat session');
      }

      const data = await response.json();
      const newSession = data.session || data.data?.session || data;
      setSession(newSession);
      setMessages(newSession.messages || []);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to initialize public chat:', error);
      setIsConnected(false);
      setEmailError('Failed to start chat. Please try again.');
      setShowEmailForm(true);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !session) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sessionId: session.sessionId,
      userId: session.userId || '',
      message: inputMessage,
      timestamp: new Date().toISOString(),
      type: 'user',
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage('');

    try {
      if (isPublic || guestEmail) {
        // Send via public API endpoint
        const response = await fetch(`/api/support/public/chat/sessions/${session.sessionId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: messageToSend,
            email: guestEmail,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data = await response.json();
        // Add agent response if available
        if (data.message) {
          const agentMessage: ChatMessage = {
            id: `msg-${Date.now()}-agent`,
            sessionId: session.sessionId,
            userId: session.userId || '',
            agentId: data.agentId || 'agent-1',
            message: data.message || 'Thank you for your message. An agent will respond shortly.',
            timestamp: new Date().toISOString(),
            type: 'agent',
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      } else {
        // Authenticated mode - simulate agent response
        setTimeout(() => {
          const agentMessage: ChatMessage = {
            id: `msg-${Date.now()}-agent`,
            sessionId: session.sessionId,
            userId: session.userId,
            agentId: 'agent-1',
            message: 'Thank you for your message. An agent will respond shortly.',
            timestamp: new Date().toISOString(),
            type: 'agent',
          };
          setMessages(prev => [...prev, agentMessage]);
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove the message from UI if send failed
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      setInputMessage(messageToSend); // Restore message
    }
  };

  const handleEscalate = async () => {
    if (!session || messages.length === 0) return;

    const chatHistory = messages.map(m => `${m.type}: ${m.message}`).join('\n');
    const subject = `Chat Support Request - ${new Date().toLocaleDateString()}`;

    try {
      await escalateChat({
        chatId: session.sessionId,
        subject,
        message: `Chat conversation escalated to ticket.\n\n${chatHistory}`,
        priority: 'normal',
      });
      alert('Chat has been escalated to a support ticket. You will receive updates via email.');
    } catch (error) {
      console.error('Failed to escalate chat:', error);
      alert('Failed to escalate chat. Please try again.');
    }
  };

  if (!isOpen) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 w-96 ${className}`}>
      <Card className="shadow-2xl flex flex-col h-[600px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Support Chat</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                setIsMinimized(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        {!isMinimized && (
          <CardContent className="flex-1 flex flex-col p-0">
            {showEmailForm ? (
              <div className="flex-1 flex flex-col p-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Start a Chat</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Please provide your email to start chatting with our support team.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Email *</label>
                    <Input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => {
                        setGuestEmail(e.target.value);
                        setEmailError('');
                      }}
                      placeholder="your.email@example.com"
                      className={emailError ? 'border-red-500' : ''}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleEmailSubmit();
                        }
                      }}
                    />
                    {emailError && (
                      <p className="text-xs text-red-500 mt-1">{emailError}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Name (optional)</label>
                    <Input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Your name"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleEmailSubmit();
                        }
                      }}
                    />
                  </div>
                  <Button onClick={handleEmailSubmit} className="w-full" disabled={!guestEmail.trim()}>
                    Start Chat
                  </Button>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-sm text-muted-foreground">Connecting...</div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Start a conversation with our support team</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-2 ${
                            message.type === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm">{message.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t p-4 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Type your message..."
                      disabled={!isConnected}
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!inputMessage.trim() || !isConnected}
                      size="icon"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  {session && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEscalate}
                      className="w-full"
                    >
                      Escalate to Ticket
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
