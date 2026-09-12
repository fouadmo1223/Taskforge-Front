import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '@/features/auth/auth.store';
import { ProfileDialog } from '@/features/auth/profile-dialog';
import { Avatar } from '@/components/ui';

export function UserMenu(): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <Dropdown.Root>
        <Dropdown.Trigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <Avatar name={user?.name ?? '?'} src={user?.avatar ?? null} size="sm" />
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content
            align="end"
            sideOffset={8}
            className="z-50 w-56 rounded-xl border border-border bg-surface-elevated p-1.5 shadow-pop"
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium text-text">{user?.name}</p>
              <p className="truncate text-xs text-text-subtle">{user?.email}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <Dropdown.Item
              onSelect={() => setProfileOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-sunken"
            >
              <UserCircle className="size-4 text-text-subtle" />
              {t('profile.myProfile')}
            </Dropdown.Item>
            <div className="my-1 h-px bg-border" />
            <Dropdown.Item
              onSelect={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-sunken"
            >
              <LogOut className="size-4 text-text-subtle" />
              {t('nav.signOut')}
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
