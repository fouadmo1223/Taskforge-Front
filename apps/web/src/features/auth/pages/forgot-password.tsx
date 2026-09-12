import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { Button, Field, Input } from '@/components/ui';

const schema = z.object({ email: z.string().email() });
type Values = z.infer<typeof schema>;

export function ForgotPasswordPage(): React.ReactElement {
  const { t } = useTranslation();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    // Always succeeds from the UI's perspective — server does not reveal account existence.
    await api.post('/auth/forgot-password', values, { anonymous: true }).catch(() => undefined);
    setSentTo(values.email);
  });

  if (sentTo) {
    return (
      <AuthLayout title={t('auth.checkEmailTitle')}>
        <p className="text-sm text-text-muted">{t('auth.checkEmailBody', { email: sentTo })}</p>
        <Link to="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          {t('auth.signIn')}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.resetPassword')}
      subtitle={t('auth.resetPasswordSubtitle')}
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('auth.signIn')}
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t('auth.email')} error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus {...form.register('email')} />
        </Field>
        <Button type="submit" block loading={form.formState.isSubmitting}>
          {t('auth.sendResetLink')}
        </Button>
      </form>
    </AuthLayout>
  );
}
