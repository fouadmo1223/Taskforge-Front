import { Navigate } from 'react-router';
import { useAuth } from '@/features/auth/auth.store';
import { FullPageSpinner } from '@/components/layout/full-page-spinner';

/** Sends the user to their first internal workspace, or onboarding if they have none. */
export function HomeRedirect(): React.ReactElement {
  const status = useAuth((s) => s.status);
  const memberships = useAuth((s) => s.memberships);

  if (status === 'loading') return <FullPageSpinner />;

  const internal = memberships.filter((m) => !m.isClient);
  if (internal.length > 0) return <Navigate to={`/w/${internal[0]!.workspaceSlug}`} replace />;

  const clientMembership = memberships.find((m) => m.isClient);
  if (clientMembership) return <Navigate to={`/portal/${clientMembership.workspaceSlug}`} replace />;

  return <Navigate to="/onboarding" replace />;
}
