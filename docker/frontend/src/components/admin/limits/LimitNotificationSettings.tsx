'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bell, Save, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { toast } from '@/components/shared/Toast';
import { logRuntimeError } from '@/lib/services/errorLogger';

interface NotificationSettings {
  notifyOnKYCChange: boolean;
  notifyOnRoleChange: boolean;
  notifyOnUserOverride: boolean;
  notifyAffectedUsers: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
}

/**
 * LimitNotificationSettings - Configure limit change notifications
 */
export function LimitNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>({
    notifyOnKYCChange: true,
    notifyOnRoleChange: true,
    notifyOnUserOverride: true,
    notifyAffectedUsers: true,
    emailNotifications: true,
    inAppNotifications: true,
  });
  const saveMutation = useMutation({
    mutationFn: async (settings: NotificationSettings) => {
      const response = await apiClient.put('/api/admin/limits/notifications', settings);
      if (!response.success) {
        throw new Error(response.error || 'Failed to save notification settings');
      }
      return response.data;
    },
    onSuccess: () => {
      toast({
        type: 'success',
        title: 'Settings saved',
        description: 'Notification settings have been saved successfully',
      });
    },
    onError: (error: any) => {
      logRuntimeError(error, 'LimitNotificationSettings', { action: 'saveSettings' });
      toast({
        type: 'error',
        title: 'Failed to save settings',
        description: error.message || 'Failed to save notification settings',
      });
    },
  });

  const handleSave = async () => {
    await saveMutation.mutateAsync(settings);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Configure when and how to receive limit change notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notification Triggers */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Notification Triggers</Label>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>KYC Limit Changes</Label>
              <p className="text-sm text-muted-foreground">
                Notify when KYC level limits are updated
              </p>
            </div>
            <Switch
              checked={settings.notifyOnKYCChange}
              onCheckedChange={(checked: boolean) =>
                setSettings((prev) => ({ ...prev, notifyOnKYCChange: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Role Limit Changes</Label>
              <p className="text-sm text-muted-foreground">
                Notify when role-based limits are updated
              </p>
            </div>
            <Switch
              checked={settings.notifyOnRoleChange}
              onCheckedChange={(checked: boolean) =>
                setSettings((prev) => ({ ...prev, notifyOnRoleChange: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>User Override Changes</Label>
              <p className="text-sm text-muted-foreground">
                Notify when user-specific overrides are created or deleted
              </p>
            </div>
            <Switch
              checked={settings.notifyOnUserOverride}
              onCheckedChange={(checked: boolean) =>
                setSettings((prev) => ({ ...prev, notifyOnUserOverride: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notify Affected Users</Label>
              <p className="text-sm text-muted-foreground">
                Send notifications to users affected by limit changes
              </p>
            </div>
            <Switch
              checked={settings.notifyAffectedUsers}
              onCheckedChange={(checked: boolean) =>
                setSettings((prev) => ({ ...prev, notifyAffectedUsers: checked }))
              }
            />
          </div>
        </div>

        {/* Notification Channels */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Notification Channels</Label>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              checked={settings.emailNotifications}
              onCheckedChange={(checked: boolean) =>
                setSettings((prev) => ({ ...prev, emailNotifications: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>In-App Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show notifications in the application
              </p>
            </div>
            <Switch
              checked={settings.inAppNotifications}
              onCheckedChange={(checked: boolean) =>
                setSettings((prev) => ({ ...prev, inAppNotifications: checked }))
              }
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
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
      </CardContent>
    </Card>
  );
}
