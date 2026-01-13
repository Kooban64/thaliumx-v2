'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Download, Calendar, Settings } from 'lucide-react';

/**
 * ReportBuilder - Custom report builder
 */
export function ReportBuilder() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Report Builder</h1>
        <p className="text-muted-foreground">
          Create custom reports and schedule automated reports
        </p>
      </div>

      {/* Report Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Custom Report
          </CardTitle>
          <CardDescription>Configure report parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Report Name</label>
            <Input placeholder="Enter report name..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Input type="date" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Input type="date" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Report Type</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Select report type...</option>
              <option value="users">User Report</option>
              <option value="transactions">Transaction Report</option>
              <option value="financial">Financial Report</option>
              <option value="compliance">Compliance Report</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Schedule Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Reports</CardTitle>
          <CardDescription>Automated report schedules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No scheduled reports</p>
            <p className="text-sm mt-2">Backend integration required</p>
          </div>
        </CardContent>
      </Card>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle>Report History</CardTitle>
          <CardDescription>Previously generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No reports generated yet</p>
            <p className="text-sm mt-2">Backend integration required</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
