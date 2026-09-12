import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '@/lib/api/client';
import { errorText } from '@/lib/api/errors';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { Button, Field, Input, toast } from '@/components/ui';

const schema = z
  .object({
    password: z
      .string()
      .min(10, 'At least 10 characters')
      .regex(/[a-z]/, 'Add a lowercase letter')
      .regex(/[A-Z]/, 'Add an uppercase letter')
      .regex(/\d/, 'Add a digit'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type Values = z.infer<typeof schema>;

export function ResetPasswordPage(): React.ReactElement {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [invalid, setInvalid] = useState(!token);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await api.post('/auth/reset-password', { token, password: values.password }, { anonymous: true });
      toast.success(t('auth.resetPassword'), t('auth.verifyEmailOk'));
      navigate('/login', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'validation_error') setInvalid(true);
      else toast.error(t('auth.resetPassword'), errorText(err, t));
    }
  });

  if (invalid) {
    return (
      <AuthLayout title={t('auth.resetPassword')}>
        <p className="text-sm text-danger">{t('auth.verifyEmailFail')}</p>
        <Link to="/forgot-password" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          {t('auth.sendResetLink')}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.resetPassword')} subtitle={t('auth.resetPasswordSubtitle')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t('auth.password')} error={form.formState.errors.password?.message}>
          <Input type="password" autoComplete="new-password" autoFocus {...form.register('password')} />
        </Field>
        <Field label={t('common.confirm')} error={form.formState.errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...form.register('confirm')} />
        </Field>
        <Button type="submit" block loading={form.formState.isSubmitting}>
          {t('auth.resetPassword')}
        </Button>
      </form>
    </AuthLayout>
  );
}
