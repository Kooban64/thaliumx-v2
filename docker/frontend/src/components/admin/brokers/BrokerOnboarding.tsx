'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { Loader2, Building2, Check } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

/**
 * BrokerOnboarding - Multi-step broker onboarding wizard
 */
export function BrokerOnboarding() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contactPerson: '',
    phone: '',
    address: '',
    country: '',
    website: '',
  });

  const createBrokerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.post('/api/admin/brokers/onboard', data);
      if (!response.success) {
        throw new Error(response.error || 'Failed to onboard broker');
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'brokers'] });
      toast({
        type: 'success',
        title: 'Success',
        description: 'Broker onboarded successfully',
      });
      const brokerData = data as { id?: string; brokerId?: string };
      router.push(`/admin/brokers/${brokerData.id || brokerData.brokerId}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to onboard broker',
        type: 'error',
      });
    },
  });

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = () => {
    createBrokerMutation.mutate(formData);
  };

  const updateFormData = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Broker Onboarding</h1>
        <p className="text-muted-foreground">
          Create a new broker account and configure initial settings
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s ? <Check className="h-5 w-5" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`h-1 w-20 ${step > s ? 'bg-primary' : 'bg-muted'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Information */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Step 1: Basic Information
            </CardTitle>
            <CardDescription>
              Enter the broker's basic information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Broker Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                placeholder="Enter broker name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData('email', e.target.value)}
                placeholder="broker@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact Person *</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) => updateFormData('contactPerson', e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => updateFormData('phone', e.target.value)}
                placeholder="+1 234 567 8900"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Additional Details */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Additional Details</CardTitle>
            <CardDescription>
              Enter additional broker information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => updateFormData('address', e.target.value)}
                placeholder="123 Main St, City, State"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => updateFormData('country', e.target.value)}
                placeholder="United States"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => updateFormData('website', e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Review & Submit</CardTitle>
            <CardDescription>
              Review the information and submit to create the broker
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Broker Name</div>
              <div className="text-lg font-semibold">{formData.name}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Email</div>
              <div className="text-lg font-semibold">{formData.email}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Contact Person</div>
              <div className="text-lg font-semibold">{formData.contactPerson}</div>
            </div>
            {formData.phone && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Phone</div>
                <div className="text-lg font-semibold">{formData.phone}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={step === 1}>
          Back
        </Button>
        {step < 3 ? (
          <Button onClick={handleNext} disabled={!formData.name || !formData.email || !formData.contactPerson}>
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={createBrokerMutation.isPending}
          >
            {createBrokerMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Create Broker
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
