import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { MailCheck } from 'lucide-react';
import { api } from '@/lib/api/client';
import { errorText } from '@/lib/api/errors';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { Button, Field, Input, toast } from '@/components/ui';

const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z
    .string()
    .min(10, 'At least 10 characters')
    .regex(/[a-z]/, 'Add a lowercase letter')
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/\d/, 'Add a digit'),
});
type Values = z.infer<typeof schema>;

export function RegisterPage(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const [done, setDone] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', password: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await api.post('/auth/register', { ...values, locale: i18n.resolvedLanguage }, { anonymous: true });
      setDone(values.email);
    } catch (err) {
      const message = errorText(err, t);
      form.setError('email', { message });
      toast.error(t('auth.signUp'), message);
    }
  });

  if (done) {
    return (
      <AuthLayout title={t('auth.registeredTitle')}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-success-soft text-success">
            <MailCheck className="size-6" />
          </div>
          <p className="text-sm text-text-muted">{t('auth.registeredBody', { email: done })}</p>
          <Link to="/login" className="mt-2 text-sm font-medium text-primary hover:underline">
            {t('auth.signIn')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.signUp')}
      subtitle={t('auth.signUpSubtitle')}
      footer={
        <>
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('auth.signIn')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t('auth.name')} error={form.formState.errors.name?.message}>
          <Input autoComplete="name" autoFocus {...form.register('name')} />
        </Field>
        <Field label={t('auth.email')} error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register('email')} />
        </Field>
        <Field label={t('auth.password')} error={form.formState.errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Button type="submit" block loading={form.formState.isSubmitting}>
          {t('auth.signUp')}
        </Button>
      </form>
    </AuthLayout>
  );
}
