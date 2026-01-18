'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import apiClient from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Coins, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Settings,
  ExternalLink,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PresaleStatus {
  status: string;
  totalRaised: number;
  totalTokensSold: number;
  participants: number;
  startDate?: string;
  endDate?: string;
  tokenPrice: number;
}

interface InvestmentStats {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  totalAmount: number;
}

export default function TokenPlatformManagement() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [presaleStatus, setPresaleStatus] = useState<PresaleStatus | null>(null);
  const [investmentStats, setInvestmentStats] = useState<InvestmentStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          router.push('/login?next=/admin/token-platform');
          return;
        }

        const res = await apiClient.get<any>('/api/auth/profile');
        const userProfile = (res.data as any)?.user || res.data || null;
        
        if (userProfile && userProfile.role !== 'admin' && userProfile.role !== 'super_admin') {
          router.push('/dashboard');
          return;
        }
        
        await loadPresaleData();
        await loadInvestmentStats();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const loadPresaleData = async () => {
    try {
      const response = await apiClient.get<any>('/api/presale/status');
      if (response.success && response.data) {
        setPresaleStatus(response.data);
      }
    } catch (err) {
      console.error('Failed to load presale data:', err);
    }
  };

  const loadInvestmentStats = async () => {
    try {
      const response = await apiClient.get<any>('/api/presale/investments');
      if (response.success && Array.isArray(response.data)) {
        const investments = response.data;
        const stats: InvestmentStats = {
          total: investments.length,
          completed: investments.filter((inv: any) => inv.status === 'completed' || inv.status === 'confirmed').length,
          pending: investments.filter((inv: any) => inv.status === 'pending').length,
          failed: investments.filter((inv: any) => inv.status === 'failed' || inv.status === 'cancelled').length,
          totalAmount: investments.reduce((sum: number, inv: any) => sum + (parseFloat(inv.amount) || 0), 0)
        };
        setInvestmentStats(stats);
      }
    } catch (err) {
      console.error('Failed to load investment stats:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6" />
            Token Platform Management
          </h1>
          <p className="text-muted-foreground">
            Manage THAL token presale, investments, and platform settings
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/admin')}>
          Back to Admin
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Presale Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presale Status</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {presaleStatus?.status ? (
                <Badge variant={presaleStatus.status === 'active' ? 'default' : 'secondary'}>
                  {presaleStatus.status.toUpperCase()}
                </Badge>
              ) : (
                '—'
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Current presale phase status
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Raised</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${presaleStatus?.totalRaised?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Total USD raised
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Sold</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {presaleStatus?.totalTokensSold?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              THAL tokens sold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {presaleStatus?.participants || investmentStats?.total || '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Total investors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Investment Statistics */}
      {investmentStats && (
        <Card>
          <CardHeader>
            <CardTitle>Investment Statistics</CardTitle>
            <CardDescription>
              Overview of all presale investments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{investmentStats.total}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{investmentStats.completed}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{investmentStats.pending}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{investmentStats.failed}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">
                  ${investmentStats.totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Manage token platform settings and view details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              onClick={() => window.open('/token-presale', '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Presale Page
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/admin/financial/ledger')}
            >
              <DollarSign className="mr-2 h-4 w-4" />
              View Financial Ledger
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/admin/compliance')}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Compliance Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/admin/system/settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Platform Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Presale Details */}
      {presaleStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Presale Details</CardTitle>
            <CardDescription>
              Current presale configuration and timeline
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Token Price</p>
                <p className="text-lg font-semibold">
                  ${presaleStatus.tokenPrice?.toFixed(4) || '0.0000'} USDT
                </p>
              </div>
              {presaleStatus.startDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="text-lg font-semibold">
                    {new Date(presaleStatus.startDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {presaleStatus.endDate && (
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="text-lg font-semibold">
                    {new Date(presaleStatus.endDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
