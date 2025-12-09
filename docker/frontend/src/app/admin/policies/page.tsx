'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PolicyParameters {
  version?: string;
  description?: string;
  last_updated?: string;
  updated_by?: string;
  [key: string]: unknown;
}

interface PolicyCategory {
  name: string;
  label: string;
  description: string;
}

interface Preset {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: string;
  action: string;
  userId: string;
  changes: unknown;
}

const POLICY_CATEGORIES: PolicyCategory[] = [
  { name: 'aml', label: 'AML/KYC', description: 'Anti-Money Laundering and Know Your Customer policies' },
  { name: 'security', label: 'Security', description: 'Authentication, session, and access security policies' },
  { name: 'trading', label: 'Trading', description: 'Order validation, limits, and risk management policies' },
  { name: 'rbac', label: 'RBAC', description: 'Role-Based Access Control policies' },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function PolicyManagement() {
  const [activeCategory, setActiveCategory] = useState<string>('aml');
  const [parameters, setParameters] = useState<PolicyParameters>({});
  const [editedParameters, setEditedParameters] = useState<PolicyParameters>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [opaStatus, setOpaStatus] = useState<{ healthy: boolean; version?: string } | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<unknown>(null);

  // Fetch parameters for active category
  const fetchParameters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/policies/parameters/${activeCategory}`);
      const data = await response.json();
      if (data.success) {
        setParameters(data.data);
        setEditedParameters(data.data);
      } else {
        setError(data.error || 'Failed to fetch parameters');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  // Fetch OPA status
  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/policies/health`);
      const data = await response.json();
      setOpaStatus({ healthy: data.healthy, version: data.version });
    } catch {
      setOpaStatus({ healthy: false });
    }
  };

  // Fetch presets
  const fetchPresets = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/policies/presets`);
      const data = await response.json();
      if (data.success) {
        setPresets(data.presets);
      }
    } catch {
      // Ignore preset fetch errors
    }
  };

  // Fetch audit log
  const fetchAuditLog = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/policies/audit?limit=50`);
      const data = await response.json();
      if (data.success) {
        setAuditLog(data.data);
      }
    } catch {
      // Ignore audit log fetch errors
    }
  };

  useEffect(() => {
    fetchParameters();
    fetchStatus();
    fetchPresets();
  }, [fetchParameters]);

  // Save parameters
  const saveParameters = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/admin/policies/parameters/${activeCategory}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedParameters),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Parameters saved successfully');
        setParameters(data.data);
        fetchAuditLog();
      } else {
        setError(data.error || 'Failed to save parameters');
      }
    } catch (err) {
      setError('Failed to save parameters');
    } finally {
      setSaving(false);
    }
  };

  // Apply preset
  const applyPreset = async (presetName: string) => {
    if (!confirm(`Apply "${presetName}" preset? This will overwrite current parameters.`)) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/admin/policies/presets/${presetName}/apply`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Preset "${presetName}" applied successfully`);
        fetchParameters();
        fetchAuditLog();
      } else {
        setError(data.error || 'Failed to apply preset');
      }
    } catch (err) {
      setError('Failed to apply preset');
    } finally {
      setSaving(false);
    }
  };

  // Test policy
  const testPolicy = async () => {
    setError(null);
    try {
      const input = JSON.parse(testInput);
      const policyPath = `thaliumx/${activeCategory}/allow`;
      const response = await fetch(`${API_BASE}/admin/policies/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: policyPath, input }),
      });
      const data = await response.json();
      if (data.success) {
        setTestResult(data.result);
      } else {
        setError(data.error || 'Policy evaluation failed');
      }
    } catch (err) {
      setError('Invalid JSON input or evaluation failed');
    }
  };

  // Update a specific parameter value
  const updateParameter = (path: string[], value: unknown) => {
    setEditedParameters(prev => {
      const updated = { ...prev };
      let current: Record<string, unknown> = updated;
      for (let i = 0; i < path.length - 1; i++) {
        if (typeof current[path[i]] !== 'object' || current[path[i]] === null) {
          current[path[i]] = {};
        }
        current = current[path[i]] as Record<string, unknown>;
      }
      current[path[path.length - 1]] = value;
      return updated;
    });
  };

  // Render parameter editor
  const renderParameterEditor = (params: Record<string, unknown>, path: string[] = []) => {
    return Object.entries(params).map(([key, value]) => {
      const currentPath = [...path, key];
      const pathKey = currentPath.join('.');

      // Skip metadata fields
      if (['version', 'description', 'last_updated', 'updated_by'].includes(key) && path.length === 0) {
        return null;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return (
          <div key={pathKey} className="border rounded-lg p-4 mb-4">
            <h4 className="font-semibold mb-3 text-sm uppercase text-muted-foreground">{key.replace(/_/g, ' ')}</h4>
            <div className="pl-2">
              {renderParameterEditor(value as Record<string, unknown>, currentPath)}
            </div>
          </div>
        );
      }

      if (Array.isArray(value)) {
        return (
          <div key={pathKey} className="mb-4">
            <Label className="text-sm">{key.replace(/_/g, ' ')}</Label>
            <textarea
              className="w-full mt-1 p-2 border rounded text-sm font-mono"
              rows={3}
              value={JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateParameter(currentPath, parsed);
                } catch {
                  // Invalid JSON, ignore
                }
              }}
            />
          </div>
        );
      }

      if (typeof value === 'boolean') {
        return (
          <div key={pathKey} className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id={pathKey}
              checked={value}
              onChange={(e) => updateParameter(currentPath, e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor={pathKey} className="text-sm">{key.replace(/_/g, ' ')}</Label>
          </div>
        );
      }

      if (typeof value === 'number') {
        return (
          <div key={pathKey} className="mb-4">
            <Label htmlFor={pathKey} className="text-sm">{key.replace(/_/g, ' ')}</Label>
            <Input
              id={pathKey}
              type="number"
              value={value}
              onChange={(e) => updateParameter(currentPath, parseFloat(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
        );
      }

      return (
        <div key={pathKey} className="mb-4">
          <Label htmlFor={pathKey} className="text-sm">{key.replace(/_/g, ' ')}</Label>
          <Input
            id={pathKey}
            type="text"
            value={String(value)}
            onChange={(e) => updateParameter(currentPath, e.target.value)}
            className="mt-1"
          />
        </div>
      );
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policy Management</h1>
          <p className="text-muted-foreground">Configure OPA policies and parameters</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            opaStatus?.healthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <span className={`w-2 h-2 rounded-full ${opaStatus?.healthy ? 'bg-green-500' : 'bg-red-500'}`} />
            OPA {opaStatus?.healthy ? 'Healthy' : 'Unhealthy'}
          </div>
          <Button variant="outline" asChild>
            <a href="/admin">Back to Admin</a>
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Categories */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Policy Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {POLICY_CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    activeCategory === cat.name
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="font-medium">{cat.label}</div>
                  <div className={`text-xs ${activeCategory === cat.name ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {cat.description}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Presets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Presets</CardTitle>
              <CardDescription>Apply predefined configurations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset.name)}
                  disabled={saving}
                  className="w-full text-left px-4 py-2 rounded-lg border hover:bg-muted transition-colors"
                >
                  <div className="font-medium capitalize">{preset.name}</div>
                  <div className="text-xs text-muted-foreground">{preset.description}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Audit Log Toggle */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setShowAuditLog(!showAuditLog);
              if (!showAuditLog) fetchAuditLog();
            }}
          >
            {showAuditLog ? 'Hide' : 'Show'} Audit Log
          </Button>
        </div>

        {/* Main Panel - Parameter Editor */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{POLICY_CATEGORIES.find(c => c.name === activeCategory)?.label} Parameters</CardTitle>
                  <CardDescription>
                    {parameters.version && `Version: ${parameters.version}`}
                    {parameters.last_updated && ` • Last updated: ${new Date(parameters.last_updated).toLocaleString()}`}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={fetchParameters}
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Refresh'}
                  </Button>
                  <Button
                    onClick={saveParameters}
                    disabled={saving || loading}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading parameters...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderParameterEditor(editedParameters)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Policy Tester */}
          <Card>
            <CardHeader>
              <CardTitle>Policy Tester</CardTitle>
              <CardDescription>Test policy evaluation with custom input</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Test Input (JSON)</Label>
                  <textarea
                    className="w-full mt-1 p-3 border rounded font-mono text-sm"
                    rows={10}
                    placeholder={`{
  "action": "transaction_review",
  "transaction": {
    "amount": 15000,
    "country": "US"
  },
  "user": {
    "id": "user123",
    "kyc_level": "level_1"
  }
}`}
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                  />
                  <Button onClick={testPolicy} className="mt-2">
                    Evaluate Policy
                  </Button>
                </div>
                <div>
                  <Label>Result</Label>
                  <pre className="w-full mt-1 p-3 border rounded bg-muted font-mono text-sm overflow-auto" style={{ minHeight: '250px' }}>
                    {testResult ? JSON.stringify(testResult, null, 2) : 'No result yet'}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Log */}
          {showAuditLog && (
            <Card>
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>Recent policy changes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-auto">
                  {auditLog.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">No audit entries</div>
                  ) : (
                    auditLog.map((entry) => (
                      <div key={entry.id} className="p-3 border rounded-lg text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium capitalize">{entry.category} - {entry.action}</span>
                          <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="text-muted-foreground">By: {entry.userId}</div>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-muted-foreground">View changes</summary>
                          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                            {JSON.stringify(entry.changes, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}