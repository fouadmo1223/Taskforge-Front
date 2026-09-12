import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router';
import type { Permission, WorkspaceMembershipView } from '@flowdesk/types';
import { useAuth } from '@/features/auth/auth.store';
import { useRoom } from '@/lib/realtime/hooks';
import { channels } from '@flowdesk/types';

interface WorkspaceContextValue {
  workspaceId: string;
  slug: string;
  name: string;
  membership: WorkspaceMembershipView;
  can: (permission: Permission) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
  isOwner: boolean;
}

const Ctx = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkspace must be used inside a WorkspaceProvider');
  return ctx;
}

/** Resolves `:workspaceSlug` against the user's memberships and exposes permissions. */
export function WorkspaceProvider({ children }: { children: ReactNode }): React.ReactElement {
  const { workspaceSlug } = useParams();
  const memberships = useAuth((s) => s.memberships);
  const status = useAuth((s) => s.status);

  const membership = useMemo(
    () => memberships.find((m) => m.workspaceSlug === workspaceSlug && !m.isClient),
    [memberships, workspaceSlug],
  );

  useRoom(membership ? channels.workspace(membership.workspaceId) : null);

  const value = useMemo<WorkspaceContextValue | null>(() => {
    if (!membership) return null;
    const permSet = new Set(membership.permissions);
    const isOwner = membership.roleKey === 'owner';
    return {
      workspaceId: membership.workspaceId,
      slug: membership.workspaceSlug,
      name: membership.workspaceName,
      membership,
      isOwner,
      can: (p) => isOwner || permSet.has(p),
      canAny: (...ps) => isOwner || ps.some((p) => permSet.has(p)),
    };
  }, [membership]);

  if (status === 'authenticated' && !membership) {
    return <Navigate to="/" replace />;
  }
  if (!value) return <></>;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
