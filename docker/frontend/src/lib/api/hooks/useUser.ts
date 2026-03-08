import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { useUserStore } from '@/stores/userStore';
import type { UserProfile } from '@/stores/userStore';

interface UserProfilePayload {
  user?: UserProfile;
  data?: UserProfile;
}

/**
 * useUser - React Query hook for user profile operations
 */
export function useUser() {
  const { profile, setProfile, updateProfile } = useUserStore();
  const queryClient = useQueryClient();

  // Get user profile
  const { data: userProfile, isLoading, error } = useQuery<UserProfile>({
    queryKey: ['user', 'profile'],
    queryFn: async () => {
      const response = await apiClient.get<UserProfilePayload>('/api/auth/profile');
      if (response.success && response.data) {
        const user = response.data.user || response.data.data;
        if (!user) {
          throw new Error('Invalid user profile payload');
        }
        setProfile(user);
        return user;
      }
      throw new Error('Failed to fetch user profile');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update user profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const response = await apiClient.put<UserProfilePayload>('/api/user/profile', updates);
      if (response.success && response.data) {
        return response.data.user || response.data.data || (updates as UserProfile);
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
