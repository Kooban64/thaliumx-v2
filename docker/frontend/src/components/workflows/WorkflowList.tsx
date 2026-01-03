/**
 * Workflow List Component
 * 
 * Display list of workflows with filtering and pagination
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkflowStatusCard } from './WorkflowStatusCard';
import { useUserWorkflows } from '@/lib/api/hooks/workflows';
import { WorkflowState, WorkflowStatus, WorkflowType, WorkflowFilters } from '@/lib/api/types/workflows';
import { Loader2, Search, Filter, X } from 'lucide-react';

interface WorkflowListProps {
  userId: string;
  initialFilters?: WorkflowFilters;
  onWorkflowClick?: (workflow: WorkflowState) => void;
  className?: string;
}

export function WorkflowList({
  userId,
  initialFilters,
  onWorkflowClick,
  className
}: WorkflowListProps) {
  const [filters, setFilters] = useState<WorkflowFilters>(initialFilters || {});
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, loading, error, refetch } = useUserWorkflows(userId, filters);

  const workflows = data?.workflows || [];

  // Filter workflows by search query
  const filteredWorkflows = workflows.filter(workflow => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      workflow.workflowType.toLowerCase().includes(query) ||
      workflow.workflowId.toLowerCase().includes(query) ||
      workflow.currentStep?.toLowerCase().includes(query)
    );
  });

  const handleStatusFilter = (status: WorkflowStatus | 'all') => {
    setFilters(prev => ({
      ...prev,
      status: status === 'all' ? undefined : status
    }));
  };

  const handleTypeFilter = (type: WorkflowType | 'all') => {
    setFilters(prev => ({
      ...prev,
      workflowType: type === 'all' ? undefined : type
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  if (loading && !data) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-12">
          <div className="text-center text-red-600">
            <p>Error loading workflows: {error}</p>
            <Button onClick={() => refetch()} variant="outline" className="mt-4">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Workflows</CardTitle>
              <CardDescription>
                {filteredWorkflows.length} workflow{filteredWorkflows.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filters</h4>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {(['all', ...Object.values(WorkflowStatus)] as const).map((status) => (
                      <Button
                        key={status}
                        variant={filters.status === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleStatusFilter(status)}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Type</label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={!filters.workflowType ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleTypeFilter('all')}
                    >
                      All
                    </Button>
                    {Object.values(WorkflowType).slice(0, 5).map((type) => (
                      <Button
                        key={type}
                        variant={filters.workflowType === type ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleTypeFilter(type)}
                        className="text-xs"
                      >
                        {type.split('_')[0]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Workflow list */}
          {filteredWorkflows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No workflows found</p>
              {searchQuery && (
                <Button variant="outline" onClick={clearFilters} className="mt-4">
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredWorkflows.map((workflow) => (
                <WorkflowStatusCard
                  key={workflow.workflowId}
                  workflow={workflow}
                  onViewDetails={() => onWorkflowClick?.(workflow)}
                />
              ))}
            </div>
          )}

          {/* Load more */}
          {data && data.count > filteredWorkflows.length && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => setFilters(prev => ({ ...prev, limit: (prev.limit || 10) + 10 }))}
              >
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
