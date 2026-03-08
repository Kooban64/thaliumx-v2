'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { Settings, Save, Loader2 } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

/**
 * BrokerSettings - Configure broker settings and feature toggles
 */
export function BrokerSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({
    featureTrading: true,
    featureStaking: true,
    featureNFT: true,
    featurePresale: true,
    maintenanceMode: false,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: typeof settings) => {
      const response = await apiClient.put('/api/admin/brokers/settings', newSettings);
      if (!response.success) {
        throw new Error(response.error || 'Failed to update broker settings');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'brokers'] });
      toast({
        type: 'success',
        title: 'Settings updated',
        description: 'Broker settings have been saved successfully.',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update broker settings',
        type: 'error',
      });
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Broker Settings</h1>
        <p className="text-muted-foreground">
          Configure broker feature toggles and limits
        </p>
      </div>

      {/* Feature Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Feature Toggles
          </CardTitle>
          <CardDescription>
            Enable or disable features for this broker
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="featureTrading">Trading</Label>
              <p className="text-sm text-muted-foreground">
                Enable trading features
              </p>
            </div>
            <Switch
              id="featureTrading"
              checked={settings.featureTrading}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, featureTrading: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="featureStaking">Staking</Label>
              <p className="text-sm text-muted-foreground">
                Enable staking features
              </p>
            </div>
            <Switch
              id="featureStaking"
              checked={settings.featureStaking}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, featureStaking: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="featureNFT">NFT Marketplace</Label>
              <p className="text-sm text-muted-foreground">
                Enable NFT marketplace
              </p>
            </div>
            <Switch
              id="featureNFT"
              checked={settings.featureNFT}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, featureNFT: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="featurePresale">Presale & Token Sales</Label>
              <p className="text-sm text-muted-foreground">
                Enable presale features
              </p>
            </div>
            <Switch
              id="featurePresale"
              checked={settings.featurePresale}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, featurePresale: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* System Settings */}
      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="maintenanceMode">Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">
                Put broker in maintenance mode
              </p>
            </div>
            <Switch
              id="maintenanceMode"
              checked={settings.maintenanceMode}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, maintenanceMode: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateSettingsMutation.isPending}
        >
          {updateSettingsMutation.isPending ? (
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
