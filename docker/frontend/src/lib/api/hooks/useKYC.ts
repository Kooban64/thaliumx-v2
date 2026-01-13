import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { useKYCStore } from '@/stores/kycStore';
import type { KYCLevel } from '@/stores/kycStore';

/**
 * useKYC - React Query hook for KYC operations
 */
export function useKYC() {
  const { level, status, limits, setLevel, setStatus, setLimits } = useKYCStore();
  const queryClient = useQueryClient();

  interface KYCStatusResponse {
    level: KYCLevel | null;
    status: 'pending' | 'approved' | 'rejected' | 'in_review' | null;
    limits: any;
  }

  // Get KYC status
  const { data: kycStatus, isLoading } = useQuery<KYCStatusResponse>({
    queryKey: ['kyc', 'status'],
    queryFn: async (): Promise<KYCStatusResponse> => {
      const response = await apiClient.get('/api/kyc/status');
      if (response.success && response.data) {
        const data = response.data as KYCStatusResponse;
        setLevel(data.level);
        setStatus(data.status);
        setLimits(data.limits);
        return data;
      }
      throw new Error('Failed to fetch KYC status');
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Request KYC upgrade mutation
  const upgradeMutation = useMutation({
    mutationFn: async (targetLevel: KYCLevel) => {
      const response = await apiClient.post('/api/kyc/upgrade', { level: targetLevel });
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to request KYC upgrade');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
    },
  });

  // Submit KYC documents mutation
  const submitDocumentsMutation = useMutation({
    mutationFn: async (documents: FormData) => {
      // FormData sets Content-Type automatically, don't override it
      const response = await apiClient.post('/api/kyc/submit', documents);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to submit documents');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
    },
  });

  return {
    level: (kycStatus?.level ?? null) || level,
    status: (kycStatus?.status ?? null) || status,
    limits: kycStatus?.limits || limits,
    isLoading,
    upgrade: upgradeMutation.mutate,
    submitDocuments: submitDocumentsMutation.mutate,
    isUpgrading: upgradeMutation.isPending,
    isSubmitting: submitDocumentsMutation.isPending,
  };
}
