import { useRouter } from 'next/navigation';

/**
 * Hook for navigation utilities
 */
export function useNavigation() {
  const router = useRouter();

  const navigate = (path: string) => {
    router.push(path);
  };

  const navigateBack = () => {
    router.back();
  };

  const navigateForward = () => {
    router.forward();
  };

  return {
    navigate,
    navigateBack,
    navigateForward,
    router,
  };
}
