import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Mail, Trash2, User } from 'lucide-react';
import { useAuth } from './auth.store';
import { useRemoveAvatar, useUpdateProfile, useUploadAvatar } from './profile.api';
import { feedback } from '@/lib/api/mutation-feedback';
import { Avatar, Button, Dialog, Field, Input, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }): React.ReactElement {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const update = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? '');
  useEffect(() => {
    if (open) setName(user?.name ?? '');
  }, [open, user?.name]);

  const busy = uploadAvatar.isPending || removeAvatar.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('profile.title')} size="sm">
      <div className="-mx-5 -mt-1 flex flex-col items-center gap-3 bg-gradient-to-b from-primary-soft/70 to-transparent px-5 pb-5 pt-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAvatar.mutate(file, feedback(t, { success: t('profile.photoUpdated') }));
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="group relative rounded-full ring-4 ring-surface-elevated transition-transform hover:scale-[1.03] disabled:pointer-events-none"
          aria-label={t('profile.changePhoto')}
        >
          <Avatar name={user?.name ?? '?'} src={user?.avatar ?? null} size="lg" className="size-24 text-2xl shadow-md" />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity',
              'group-hover:opacity-100',
              busy && 'opacity-100',
            )}
          >
            {busy ? <Spinner className="size-5" /> : <Camera className="size-5" />}
          </span>
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-text">{user?.name}</p>
          <p className="text-xs text-text-subtle">{user?.email}</p>
        </div>
        {user?.avatar && (
          <Button
            size="sm"
            variant="ghost"
            className="-mt-1 text-danger hover:bg-danger-soft"
            onClick={() => removeAvatar.mutate(undefined, feedback(t, { success: t('profile.photoRemoved') }))}
            disabled={busy}
          >
            <Trash2 className="size-3.5" />
            {t('profile.removePhoto')}
          </Button>
        )}
      </div>

      <div className="space-y-3 pt-1">
        <Field label={t('profile.displayName')}>
          <Input
            leading={<User className="size-4" />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== user?.name) {
                update.mutate({ name: name.trim() }, feedback(t, { success: t('common.saved') }));
              }
            }}
          />
        </Field>
        <Field label={t('profile.email')} hint={t('profile.emailHint')}>
          <Input leading={<Mail className="size-4" />} value={user?.email ?? ''} disabled />
        </Field>
      </div>
    </Dialog>
  );
}
