import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { ApiError } from '@/lib/api/client';
import { useCreateWorkspace } from '@/features/workspace/workspace.api';
import { LanguageThemeControls } from '@/components/layout/language-theme-controls';
import { Button, Field, Input, toast } from '@/components/ui';

const schema = z.object({ name: z.string().min(2).max(80) });
type Values = z.infer<typeof schema>;

export function OnboardingPage(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateWorkspace();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const ws = await create.mutateAsync({
        name: values.name,
        defaultLocale: i18n.resolvedLanguage === 'ar' ? 'ar' : 'en',
      });
      navigate(`/w/${ws.slug}`, { replace: true });
    } catch (err) {
      toast.error(t('workspace.createTitle'), err instanceof ApiError ? err.message : t('errors.generic'));
    }
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex justify-end p-4">
        <LanguageThemeControls />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <h1 className="text-lg font-semibold text-text">{t('workspace.createTitle')}</h1>
          <p className="mt-1 text-sm text-text-muted">{t('workspace.noneBody')}</p>
          <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4" noValidate>
            <Field label={t('workspace.name')} error={form.formState.errors.name?.message}>
              <Input autoFocus placeholder="Acme Inc." {...form.register('name')} />
            </Field>
            <Button type="submit" block loading={form.formState.isSubmitting}>
              {t('workspace.create')}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
