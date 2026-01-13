import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { useUserStore } from '@/stores/userStore';

/**
 * useUser - React Query hook for user profile operations
 */
export function useUser() {
  const { profile, setProfile, updateProfile } = useUserStore();
  const queryClient = useQueryClient();

  // Get user profile
  const { data: userProfile, isLoading, error } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: async () => {
      const response = await apiClient.get<{ user?: any; [key: string]: any }>('/api/auth/profile');
      if (response.success && response.data) {
        const user = (response.data as any).user || response.data;
        setProfile(user);
        return user;
      }
      throw new Error('Failed to fetch user profile');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update user profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<typeof profile>) => {
      const response = await apiClient.put('/api/user/profile', updates);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to update profile');
    },
    onSuccess: (data) => {
      updateProfile(data);
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
    },
  });

  return {
    profile: userProfile || profile,
    isLoading,
    error,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
  };
}
