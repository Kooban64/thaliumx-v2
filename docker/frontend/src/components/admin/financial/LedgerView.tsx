'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs } from '@/components/navigation/Tabs';
import { Search, DollarSign, TrendingUp, TrendingDown, Filter } from 'lucide-react';

/**
 * LedgerView - Multi-tier ledger visualization
 */
export function LedgerView() {
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: DollarSign },
    { id: 'accounts', label: 'Accounts', icon: TrendingUp },
    { id: 'transactions', label: 'Transactions', icon: TrendingDown },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Multi-Tier Ledger</h1>
        <p className="text-muted-foreground">
          View and manage platform financial ledger
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts or transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select defaultValue="">
              <SelectTrigger aria-label="Filter by account type">
                <SelectValue placeholder="All Account Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Account Types</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
                <SelectItem value="liability">Liabilities</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs items={tabs} value={activeTab} onValueChange={setActiveTab} variant="pills" />

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">$0.00</div>
              <div className="text-sm text-muted-foreground mt-2">Current balance</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Liabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">$0.00</div>
              <div className="text-sm text-muted-foreground mt-2">Current balance</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Net Equity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">$0.00</div>
              <div className="text-sm text-muted-foreground mt-2">Assets - Liabilities</div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'accounts' && (
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>All ledger accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Account list will be displayed here</p>
              <p className="text-sm mt-2">Backend integration required</p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'transactions' && (
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>Ledger transaction history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Transaction history will be displayed here</p>
              <p className="text-sm mt-2">Backend integration required</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
