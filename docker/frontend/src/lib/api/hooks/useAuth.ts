import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { checkAuth, getCurrentUser, login, logout } from '@/lib/auth/backend-auth';
import { useAuthStore } from '@/stores/authStore';
import { useUserStore } from '@/stores/userStore';

/**
 * useAuth - React Query hook for authentication
 */
export function useAuth() {
  const { setUser, setAuthenticated, logout: clearAuth } = useAuthStore();
  const { setProfile } = useUserStore();
  const queryClient = useQueryClient();

  // Check authentication status
  const { data: isAuthenticated, isLoading } = useQuery({
    queryKey: ['auth', 'status'],
    queryFn: checkAuth,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Get current user
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: getCurrentUser,
    enabled: !!isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update stores when user data changes
  useEffect(() => {
    if (user) {
      setUser(user);
      setProfile(user);
    }
  }, [user, setUser, setProfile]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['auth'] });
        setAuthenticated(true);
      }
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearAuth();
      setProfile(null);
      queryClient.clear();
    },
  });

  return {
    isAuthenticated: isAuthenticated ?? false,
    user,
    isLoading: isLoading || isLoadingUser,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
