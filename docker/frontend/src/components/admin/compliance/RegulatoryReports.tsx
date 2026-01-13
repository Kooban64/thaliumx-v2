'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { FileText, Download, AlertTriangle, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

interface Report {
  id: string;
  type: string;
  status: 'generating' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  error?: string;
}

/**
 * RegulatoryReports - Generate regulatory and compliance reports with full functionality
 */
export function RegulatoryReports() {
  const queryClient = useQueryClient();
  const [selectedReportType, setSelectedReportType] = useState<string>('');

  const reportTypes = [
    {
      id: 'sar',
      name: 'Suspicious Activity Report (SAR)',
      description: 'File SAR reports for suspicious transactions',
      icon: AlertTriangle,
    },
    {
      id: 'transaction',
      name: 'Transaction Report',
      description: 'Generate transaction reports for regulatory compliance',
      icon: FileText,
    },
    {
      id: 'kyc',
      name: 'KYC Status Report',
      description: 'Report on KYC compliance status across the platform',
      icon: FileText,
    },
    {
      id: 'risk',
      name: 'Risk Assessment Report',
      description: 'Generate risk assessment and analysis reports',
      icon: FileText,
    },
  ];

  const { data: reports, isLoading: isLoadingReports } = useQuery<Report[]>({
    queryKey: ['admin', 'compliance', 'reports'],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/compliance/reports') as any;
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    },
    staleTime: 60 * 1000, // 1 minute
  });

  const generateMutation = useMutation({
    mutationFn: async (reportType: string) => {
      const response = await apiClient.post('/api/admin/compliance/reports/generate', {
        type: reportType,
      });
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to generate report');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'compliance', 'reports'] });
      toast({
        type: 'success',
        title: 'Report generation started',
        description: 'Your report is being generated. You will be notified when it is ready.',
      });
    },
    onError: (error: any) => {
      toast({
        type: 'error',
        title: 'Failed to generate report',
        description: error.message || 'Failed to generate report',
      });
    },
  });

  const handleGenerateReport = async (reportId: string) => {
    setSelectedReportType(reportId);
    await generateMutation.mutateAsync(reportId);
  };

  const handleDownloadReport = async (reportId: string) => {
    try {
      const report = reports?.find((r) => r.id === reportId);
      if (!report?.downloadUrl) {
        toast({
          type: 'error',
          title: 'Download unavailable',
          description: 'Report download URL is not available',
        });
        return;
      }

      const response = await fetch(report.downloadUrl);
      if (!response.ok) {
        throw new Error('Failed to download report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `regulatory-report-${report.type}-${report.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        type: 'success',
        title: 'Report downloaded',
        description: 'Regulatory report has been downloaded',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Failed to download report',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      generating: { variant: 'outline', icon: Clock },
      completed: { variant: 'default', icon: CheckCircle2 },
      failed: { variant: 'destructive', icon: XCircle },
    };

    const config = variants[status] || variants.generating!;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Regulatory Reports</h1>
        <p className="text-muted-foreground">
          Generate compliance and regulatory reports
        </p>
      </div>

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          const isGenerating = generateMutation.isPending && selectedReportType === report.id;
          return (
            <Card key={report.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {report.name}
                </CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleGenerateReport(report.id)}
                  className="w-full"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle>Report History</CardTitle>
          <CardDescription>
            Previously generated reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingReports ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No reports generated yet</p>
              <p className="text-sm mt-2">Generate a report to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      {getStatusBadge(report.status)}
                    </div>
                    <div>
                      <div className="font-medium">
                        {reportTypes.find((t) => t.id === report.type)?.name || report.type}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Created: {formatDateTime(report.createdAt)}
                      </div>
                      {report.error && (
                        <div className="text-sm text-destructive mt-1">
                          Error: {report.error}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {report.status === 'completed' && report.downloadUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadReport(report.id)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    )}
                    {report.status === 'generating' && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
