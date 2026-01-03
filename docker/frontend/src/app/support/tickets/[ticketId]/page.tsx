/**
 * Ticket Details Page
 * 
 * Detailed view of a support ticket with full conversation history.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getTicket, type Ticket } from '@/lib/api/support';
import { ArrowLeft, AlertCircle, CheckCircle2, Clock, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function TicketDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.ticketId as string;
  
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ticketId) {
      loadTicket();
    }
  }, [ticketId]);

  const loadTicket = async () => {
    try {
      setIsLoading(true);
      const data = await getTicket(ticketId);
      setTicket(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load ticket');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'open':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">Loading ticket...</div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Ticket not found'}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/support')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Support
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Link href="/support">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Support
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2">Ticket Details</h1>
      </div>

      {/* Ticket Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {getStatusIcon(ticket.status)}
                <CardTitle className="text-2xl">{ticket.subject}</CardTitle>
              </div>
              <CardDescription>
                Created {new Date(ticket.createdAt).toLocaleString()}
                {ticket.updatedAt !== ticket.createdAt && (
                  <> • Updated {new Date(ticket.updatedAt).toLocaleString()}</>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <span className={`px-3 py-1 rounded-md text-sm font-medium border ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority.toUpperCase()}
              </span>
              <span className="text-sm text-muted-foreground capitalize">
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Ticket Metadata */}
      {ticket.metadata && Object.keys(ticket.metadata).length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {ticket.department && (
                <div>
                  <span className="font-medium">Department:</span> {ticket.department}
                </div>
              )}
              {ticket.issueType && (
                <div>
                  <span className="font-medium">Issue Type:</span> {ticket.issueType}
                </div>
              )}
              {ticket.metadata.workflowId && (
                <div>
                  <span className="font-medium">Workflow ID:</span>{' '}
                  <Link href={`/workflows/${ticket.metadata.workflowId}`} className="text-primary hover:underline">
                    {ticket.metadata.workflowId}
                  </Link>
                </div>
              )}
              {ticket.metadata.orderId && (
                <div>
                  <span className="font-medium">Order ID:</span> {ticket.metadata.orderId}
                </div>
              )}
              {ticket.metadata.tradingPair && (
                <div>
                  <span className="font-medium">Trading Pair:</span> {ticket.metadata.tradingPair}
                </div>
              )}
              {ticket.metadata.transactionHash && (
                <div className="col-span-2">
                  <span className="font-medium">Transaction Hash:</span>{' '}
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {ticket.metadata.transactionHash}
                  </code>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ticket Message */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Initial Message
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none whitespace-pre-wrap">{ticket.message}</div>
        </CardContent>
      </Card>

      {/* Resolution Info */}
      {ticket.resolvedAt && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            This ticket was resolved on {new Date(ticket.resolvedAt).toLocaleString()}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
