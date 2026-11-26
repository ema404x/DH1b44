import { useCurrentUser } from '@/hooks/useCurrentUser';

// true si el sector del usuario es 'bapro' (mismo criterio que Assets.jsx).
export default function useEsBapro() {
  const { currentUser, employeeSector } = useCurrentUser();
  return (currentUser?.data?.sector_id || currentUser?.sector_id || employeeSector) === 'bapro';
}