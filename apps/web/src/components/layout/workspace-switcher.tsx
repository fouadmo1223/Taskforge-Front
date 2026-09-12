import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useAuth } from '@/features/auth/auth.store';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { Avatar } from '@/components/ui';
import { Scrollable } from '@/components/ui/scrollable';

export function WorkspaceSwitcher(): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const memberships = useAuth((s) => s.memberships);
  const { workspaceId, name, slug } = useWorkspace();
  const [open, setOpen] = useState(false);

  const internal = useMemo(() => memberships.filter((m) => !m.isClient), [memberships]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex w-full items-center gap-2.5 rounded-lg p-2 text-start hover:bg-surface-sunken">
        <Avatar name={name} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text">{name}</span>
          <span className="block truncate text-xs text-text-subtle">{slug}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-text-subtle" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-64 overflow-hidden rounded-xl border border-border bg-surface-elevated p-1.5 shadow-pop"
        >
          <Scrollable className="max-h-72">
            {internal.map((m) => (
              <button
                key={m.workspaceId}
                onClick={() => {
                  setOpen(false);
                  navigate(`/w/${m.workspaceSlug}`);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg p-2 text-start hover:bg-surface-sunken"
              >
                <Avatar name={m.workspaceName} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-text">{m.workspaceName}</span>
                {m.workspaceId === workspaceId && <Check className="size-4 text-primary" />}
              </button>
            ))}
          </Scrollable>
          <div className="my-1 h-px bg-border" />
          <button
            onClick={() => {
              setOpen(false);
              navigate('/onboarding');
            }}
            className="flex w-full items-center gap-2.5 rounded-lg p-2 text-start text-sm text-text-muted hover:bg-surface-sunken hover:text-text"
          >
            <span className="flex size-6 items-center justify-center rounded-md border border-dashed border-border">
              <Plus className="size-3.5" />
            </span>
            {t('workspace.create')}
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
