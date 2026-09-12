import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useAuth } from '@/features/auth/auth.store';
import { useDeleteWorkspace, useUpdateWorkspace, useWorkspaceDetail } from '@/features/workspace/workspace.api';
import { ApiError } from '@/lib/api/client';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Button, Field, Input, Select, Skeleton, confirm, toast } from '@/components/ui';

interface FormValues {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  defaultLocale: 'en' | 'ar';
}

export function WorkspaceSettingsPage(): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId, isOwner } = useWorkspace();
  const userId = useAuth((s) => s.user?.id);
  const detail = useWorkspaceDetail(workspaceId);
  const update = useUpdateWorkspace(workspaceId);
  const remove = useDeleteWorkspace(workspaceId);

  const form = useForm<FormValues>({ values: buildValues() });

  function buildValues(): FormValues {
    const s = detail.data?.settings;
    const next: FormValues = {
      name: detail.data?.name ?? '',
      primaryColor: s?.primaryColor ?? '#4f46e5',
      secondaryColor: s?.secondaryColor ?? '#0ea5e9',
      defaultLocale: s?.defaultLocale ?? 'en',
    };
    return next;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        name: values.name,
        settings: {
          primaryColor: values.primaryColor,
          secondaryColor: values.secondaryColor,
          defaultLocale: values.defaultLocale,
        },
      });
      toast.success(t('workspace.settings'), t('common.save'));
    } catch (err) {
      toast.error(t('workspace.settings'), err instanceof ApiError ? err.message : t('errors.generic'));
    }
  });

  const onDelete = async (): Promise<void> => {
    const ok = await confirm({
      title: t('workspace.deleteWorkspace'),
      body: t('workspace.deleteConfirm'),
      tone: 'danger',
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    try {
      await remove.mutateAsync();
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(t('workspace.deleteWorkspace'), err instanceof ApiError ? err.message : t('errors.generic'));
    }
  };

  if (detail.isLoading) {
    return (
      <>
        <PageHeader title={t('workspace.settings')} />
        <PageBody className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/2" />
        </PageBody>
      </>
    );
  }

  const ownerControls = detail.data?.ownerUserId === userId || isOwner;

  return (
    <>
      <PageHeader title={t('workspace.settings')} />
      <PageBody className="space-y-8">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label={t('workspace.name')} error={form.formState.errors.name?.message}>
            <Input {...form.register('name', { required: true, minLength: 2 })} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('workspace.primaryColor')}>
              <Input type="color" className="h-9.5 p-1" {...form.register('primaryColor')} />
            </Field>
            <Field label={t('workspace.secondaryColor')}>
              <Input type="color" className="h-9.5 p-1" {...form.register('secondaryColor')} />
            </Field>
          </div>

          <Field label={t('workspace.defaultLanguage')}>
            <Controller
              control={form.control}
              name="defaultLocale"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 'en')}
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'ar', label: 'العربية' },
                  ]}
                />
              )}
            />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" loading={update.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>

        {ownerControls && (
          <div className="rounded-xl border border-danger/30 bg-danger-soft/40 p-4">
            <h2 className="text-sm font-semibold text-danger">{t('workspace.dangerZone')}</h2>
            <p className="mt-1 text-sm text-text-muted">{t('workspace.deleteConfirm')}</p>
            <Button variant="danger" className="mt-3" onClick={onDelete} loading={remove.isPending}>
              {t('workspace.deleteWorkspace')}
            </Button>
          </div>
        )}
      </PageBody>
    </>
  );
}
