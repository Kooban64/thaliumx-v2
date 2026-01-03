/**
 * Support Dashboard Page
 * 
 * Main support page showing user's tickets and chat history.
 * Allows creating new tickets and viewing existing ones.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getTickets, createTicket, getSupportMetrics, type Ticket, type SupportMetrics } from '@/lib/api/support';
import { Plus, MessageSquare, AlertCircle, CheckCircle2, Clock, Search } from 'lucide-react';
import Link from 'next/link';

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [metrics, setMetrics] = useState<SupportMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    message: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'critical',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadTickets();
    loadMetrics();
  }, []);

  const loadTickets = async () => {
    try {
      setIsLoading(true);
      const data = await getTickets();
      setTickets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const data = await getSupportMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.subject || !newTicket.message) return;

    try {
      setIsSubmitting(true);
      await createTicket(newTicket);
      setNewTicket({ subject: '', message: '', priority: 'normal' });
      setShowCreateForm(false);
      await loadTickets();
      await loadMetrics();
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'open':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Support Center</h1>
        <p className="text-muted-foreground">Manage your support tickets and get help</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Metrics Summary */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalTickets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{metrics.openTickets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(metrics.averageResponseTime)}m</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(metrics.averageResolutionTime)}h</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 mb-6">
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Ticket
        </Button>
        <Link href="/support/chat">
          <Button variant="outline">
            <MessageSquare className="h-4 w-4 mr-2" />
            Open Chat
          </Button>
        </Link>
      </div>

      {/* Create Ticket Form */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Ticket</CardTitle>
            <CardDescription>Describe your issue and we&apos;ll help you resolve it</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Input
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  placeholder="Brief description of your issue"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Message</label>
                <textarea
                  value={newTicket.message}
                  onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                  placeholder="Detailed description of your issue..."
                  className="w-full min-h-[120px] p-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Ticket'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">Loading tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No tickets found</p>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(ticket.status)}
                      <CardTitle className="text-lg">
                        <Link href={`/support/tickets/${ticket.id}`} className="hover:underline">
                          {ticket.subject}
                        </Link>
                      </CardTitle>
                    </div>
                    <CardDescription className="line-clamp-2">{ticket.message}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
