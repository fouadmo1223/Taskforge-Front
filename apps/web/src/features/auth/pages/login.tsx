import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';

import { errorText } from '@/lib/api/errors';
import { useAuth } from '@/features/auth/auth.store';
import { consumePendingInviteToken } from '@/features/auth/pending-invite';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { Button, Field, Input, toast } from '@/components/ui';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type Values = z.infer<typeof schema>;

export function LoginPage(): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuth((s) => s.login);
  const [showPw, setShowPw] = useState(false);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login(values.email, values.password);
      const pendingInviteToken = consumePendingInviteToken();
      const from = (location.state as { from?: string } | null)?.from;
      navigate(pendingInviteToken ? `/invites/accept?token=${pendingInviteToken}` : (from ?? '/'), { replace: true });
    } catch (err) {
      const message = errorText(err, t);
      form.setError('password', { message });
      toast.error(t('auth.signIn'), message);
    }
  });

  return (
    <AuthLayout
      title={t('auth.signIn')}
      subtitle={t('auth.signInSubtitle')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            {t('auth.signUp')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t('auth.email')} error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus {...form.register('email')} />
        </Field>
        <Field label={t('auth.password')} error={form.formState.errors.password?.message}>
          <Input
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            trailing={
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="pointer-events-auto text-text-subtle hover:text-text"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
            {...form.register('password')}
          />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </div>
        <Button type="submit" block loading={form.formState.isSubmitting}>
          {t('auth.signIn')}
        </Button>
      </form>
    </AuthLayout>
  );
}
