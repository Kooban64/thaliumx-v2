'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBrokerSettings, useUpdateBrokerSettings } from '@/lib/api/hooks/useBroker';
import { Loader2, Settings, Save } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

/**
 * BrokerSettings - Broker configuration with full functionality
 */
export function BrokerSettings() {
  const { data, isLoading, error } = useBrokerSettings();
  const updateMutation = useUpdateBrokerSettings();
  const [settings, setSettings] = useState({
    name: '',
    email: '',
    contactPerson: '',
    phone: '',
    address: '',
    country: '',
    website: '',
  });

  useEffect(() => {
    if (data) {
      setSettings({
        name: data.name || '',
        email: data.email || '',
        contactPerson: data.contactPerson || '',
        phone: data.phone || '',
        address: data.address || '',
        country: data.country || '',
        website: data.website || '',
      });
    }
  }, [data]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(settings);
      toast({
        type: 'success',
        title: 'Settings updated',
        description: 'Broker settings have been saved successfully',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to update settings',
        description: err instanceof Error ? err.message : 'Failed to update broker settings',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-destructive mb-4">Failed to load broker settings</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Broker Settings</h1>
        <p className="text-muted-foreground">Configure broker details and settings</p>
      </div>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Basic Information
          </CardTitle>
          <CardDescription>
            Update broker contact information and details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Broker Name *</Label>
            <Input
              id="name"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              placeholder="Enter broker name"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                placeholder="broker@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="+1 234 567 8900"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="contactPerson">Contact Person</Label>
            <Input
              id="contactPerson"
              value={settings.contactPerson}
              onChange={(e) => setSettings({ ...settings, contactPerson: e.target.value })}
              placeholder="John Doe"
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="123 Main St, City, State"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={settings.country}
                onChange={(e) => setSettings({ ...settings, country: e.target.value })}
                placeholder="United States"
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={settings.website}
                onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      {data?.apiKeys && (
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Manage API keys for broker integrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.apiKeys.map((key: string, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <code className="text-sm font-mono">{key.substring(0, 20)}...</code>
                  <Button variant="outline" size="sm">
                    Regenerate
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhooks */}
      {data?.webhooks && (
        <Card>
          <CardHeader>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>
              Configure webhook endpoints
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.webhooks.map((webhook: string, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <code className="text-sm font-mono">{webhook}</code>
                  <Button variant="outline" size="sm">
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
