import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './auth.store';
import { FullPageSpinner } from '@/components/layout/full-page-spinner';

/** Gate for authenticated areas. */
export function RequireAuth({ children }: { children: ReactNode }): React.ReactElement {
  const status = useAuth((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/** Redirect already-authenticated users away from auth screens. */
export function RedirectIfAuthed({ children }: { children: ReactNode }): React.ReactElement {
  const status = useAuth((s) => s.status);
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <>{children}</>;
}
