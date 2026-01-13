'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBrokerBranding, useUpdateBrokerBranding } from '@/lib/api/hooks/useBroker';
import { Loader2, Palette, Save, RefreshCw } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

/**
 * BrokerBranding - Branding management with full functionality
 */
export function BrokerBranding() {
  const { data, isLoading, error } = useBrokerBranding();
  const updateMutation = useUpdateBrokerBranding();
  const [branding, setBranding] = useState({
    logo: null as File | null,
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    customCSS: '',
  });
  const [logoPreview, setLogoPreview] = useState<string>('');

  useEffect(() => {
    if (data) {
      setBranding({
        logo: null,
        primaryColor: data.primaryColor || '#000000',
        secondaryColor: data.secondaryColor || '#ffffff',
        customCSS: data.customCSS || '',
      });
      if (data.logo) {
        setLogoPreview(data.logo);
      }
    }
  }, [data]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          type: 'error',
          title: 'File too large',
          description: 'Logo file must be less than 5MB',
        });
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast({
          type: 'error',
          title: 'Invalid file type',
          description: 'Please upload an image file',
        });
        return;
      }
      setBranding({ ...branding, logo: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      const brandingData: { logo?: File; primaryColor?: string; secondaryColor?: string; customCSS?: string } = {};
      if (branding.logo) brandingData.logo = branding.logo;
      if (branding.primaryColor) brandingData.primaryColor = branding.primaryColor;
      if (branding.secondaryColor) brandingData.secondaryColor = branding.secondaryColor;
      if (branding.customCSS) brandingData.customCSS = branding.customCSS;

      await updateMutation.mutateAsync(brandingData);
      toast({
        type: 'success',
        title: 'Branding updated',
        description: 'Branding settings have been saved successfully',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to update branding',
        description: err instanceof Error ? err.message : 'Failed to update branding',
      });
    }
  };

  const handleReset = () => {
    if (data) {
      setBranding({
        logo: null,
        primaryColor: data.primaryColor || '#000000',
        secondaryColor: data.secondaryColor || '#ffffff',
        customCSS: data.customCSS || '',
      });
      setLogoPreview(data.logo || '');
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
            <p className="text-destructive mb-4">Failed to load branding settings</p>
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
        <h1 className="text-3xl font-bold">Branding</h1>
        <p className="text-muted-foreground">Manage logo, colors, and customization</p>
      </div>

      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Logo
          </CardTitle>
          <CardDescription>
            Upload your broker logo (max 5MB, PNG/JPG/SVG)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoPreview && (
            <div className="flex items-center gap-4">
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-24 w-24 object-contain border rounded-lg p-2"
              />
              <div>
                <p className="text-sm font-medium">Current Logo</p>
                <p className="text-xs text-muted-foreground">Preview of your logo</p>
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="logo">Upload Logo</Label>
            <Input
              id="logo"
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Recommended: 200x200px, transparent background
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Color Scheme */}
      <Card>
        <CardHeader>
          <CardTitle>Color Scheme</CardTitle>
          <CardDescription>
            Customize your broker's color scheme
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="secondaryColor"
                  type="color"
                  value={branding.secondaryColor}
                  onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={branding.secondaryColor}
                  onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <div className="p-4 border rounded-lg bg-muted/50">
            <p className="text-sm font-medium mb-2">Preview</p>
            <div
              className="p-4 rounded-lg text-center"
              style={{
                backgroundColor: branding.primaryColor,
                color: branding.secondaryColor,
              }}
            >
              <p className="font-semibold">Sample Text</p>
              <p className="text-sm opacity-80">This is how your colors will look</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom CSS */}
      <Card>
        <CardHeader>
          <CardTitle>Custom CSS</CardTitle>
          <CardDescription>
            Add custom CSS to further customize your broker's appearance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={branding.customCSS}
            onChange={(e) => setBranding({ ...branding, customCSS: e.target.value })}
            placeholder="/* Add your custom CSS here */"
            className="font-mono text-sm"
            rows={10}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Note: Custom CSS will be applied to your broker's branded pages
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleReset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Branding
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
