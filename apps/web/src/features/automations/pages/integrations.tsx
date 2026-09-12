import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WEBHOOK_EVENTS, PERMISSIONS, type WebhookEvent } from '@flowdesk/types';
import { Copy, KeyRound, Plus, Trash2, Webhook as WebhookIcon, X } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { errorText } from '@/lib/api/errors';
import { PageBody, PageHeader } from '@/components/layout/page';
import { Badge, Button, Dialog, EmptyState, Field, Input, MultiSelect, Skeleton, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  useApiTokens,
  useCreateApiToken,
  useCreateWebhook,
  useDeleteWebhook,
  useRevokeApiToken,
  useTestWebhook,
  useUpdateWebhook,
  useWebhooks,
} from '@/features/automations/automations.api';

export function IntegrationsPage(): React.ReactElement {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'webhooks' | 'tokens'>('webhooks');

  return (
    <>
      <PageHeader title={t('integrations.title')} description={t('integrations.description')} />
      <PageBody className="space-y-4">
        <div className="flex gap-1 border-b border-border">
          {(['webhooks', 'tokens'] as const).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-medium',
                tab === tb ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text',
              )}
            >
              {t(`integrations.${tb}`)}
            </button>
          ))}
        </div>
        {tab === 'webhooks' ? <WebhooksTab /> : <TokensTab />}
      </PageBody>
    </>
  );
}

function WebhooksTab(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const webhooks = useWebhooks(workspaceId);
  const create = useCreateWebhook(workspaceId);
  const update = useUpdateWebhook(workspaceId);
  const del = useDeleteWebhook(workspaceId);
  const test = useTestWebhook(workspaceId);
  const err = (e: unknown): void => {
    toast.error(errorText(e, t));
  };

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ url: '', events: [] as WebhookEvent[] });

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          {t('integrations.newWebhook')}
        </Button>
      </div>
      {webhooks.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (webhooks.data?.length ?? 0) === 0 ? (
        <EmptyState title={t('integrations.noWebhooks')} icon={<WebhookIcon className="size-5" />} />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {webhooks.data!.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-4 py-3 text-sm">
              {!h.active && <Badge tone="neutral">{t('sla.inactive')}</Badge>}
              <code className="text-text">{h.url}</code>
              <span className="text-xs text-text-subtle">{h.events.length} {t('integrations.events')}</span>
              {h.lastStatus !== null && (
                <span className={cn('text-xs', h.failureCount > 0 ? 'text-danger' : 'text-success')}>
                  {h.lastStatus}
                </span>
              )}
              <div className="ms-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  loading={test.isPending}
                  onClick={() =>
                    test.mutate(h.id, {
                      onSuccess: (r) => (r.ok ? toast.success(t('integrations.testOk')) : toast.error(`${r.status ?? ''} ${r.error}`)),
                      onError: err,
                    })
                  }
                >
                  {t('integrations.test')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: h.id, active: !h.active }, { onError: err })}>
                  {h.active ? t('sla.deactivate') : t('sla.activate')}
                </Button>
                <button onClick={() => del.mutate(h.id, { onError: err })} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken hover:text-danger">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('integrations.newWebhook')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>{t('common.cancel')}</Button>
            <Button
              loading={create.isPending}
              disabled={!draft.url.trim() || draft.events.length === 0}
              onClick={() =>
                create.mutate(
                  { url: draft.url.trim(), events: draft.events },
                  {
                    onSuccess: () => {
                      setCreating(false);
                      setDraft({ url: '', events: [] });
                    },
                    onError: err,
                  },
                )
              }
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          <Field label={t('integrations.payloadUrl')}>
            <Input autoFocus placeholder="https://…" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          </Field>
          <Field label={t('integrations.events')}>
            <MultiSelect
              value={draft.events}
              onChange={(v) => setDraft({ ...draft, events: v })}
              options={WEBHOOK_EVENTS.map((e) => ({ value: e, label: e }))}
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

function TokensTab(): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, isOwner, membership } = useWorkspace();
  const tokens = useApiTokens(workspaceId);
  const create = useCreateApiToken(workspaceId);
  const revoke = useRevokeApiToken(workspaceId);
  const err = (e: unknown): void => {
    toast.error(errorText(e, t));
  };

  const grantable = isOwner ? [...PERMISSIONS] : membership.permissions;
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', scopes: [] as string[] });
  const [revealed, setRevealed] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          {t('integrations.newToken')}
        </Button>
      </div>

      {revealed && (
        <div className="flex items-center gap-2 rounded-lg border border-primary bg-primary-soft/40 px-3 py-2 text-sm">
          <KeyRound className="size-4 text-primary" />
          <code className="min-w-0 flex-1 truncate">{revealed}</code>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(revealed);
              toast.success(t('external.forms.linkCopied'));
            }}
            className="rounded-lg p-1.5 hover:bg-surface-sunken"
          >
            <Copy className="size-3.5" />
          </button>
          <button onClick={() => setRevealed(null)} className="rounded-lg p-1.5 hover:bg-surface-sunken">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {tokens.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (tokens.data?.length ?? 0) === 0 ? (
        <EmptyState title={t('integrations.noTokens')} icon={<KeyRound className="size-5" />} />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {tokens.data!.map((tk) => (
            <div key={tk.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-4 py-3 text-sm">
              {tk.revoked && <Badge tone="danger">{t('integrations.revoked')}</Badge>}
              <span className="font-medium text-text">{tk.name}</span>
              <code className="text-xs text-text-subtle">{tk.prefix}…</code>
              <span className="text-xs text-text-subtle">{tk.scopes.length} {t('integrations.scopes')}</span>
              {tk.lastUsedAt && <span className="text-xs text-text-subtle">{t('integrations.lastUsed')}</span>}
              {!tk.revoked && (
                <button onClick={() => revoke.mutate(tk.id, { onError: err })} className="ms-auto rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken hover:text-danger">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('integrations.newToken')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>{t('common.cancel')}</Button>
            <Button
              loading={create.isPending}
              disabled={!draft.name.trim() || draft.scopes.length === 0}
              onClick={() =>
                create.mutate(
                  { name: draft.name.trim(), scopes: draft.scopes },
                  {
                    onSuccess: (res) => {
                      setRevealed(res.token);
                      setCreating(false);
                      setDraft({ name: '', scopes: [] });
                    },
                    onError: err,
                  },
                )
              }
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          <Field label={t('integrations.tokenName')}>
            <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label={t('integrations.scopes')} hint={t('integrations.scopesHint')}>
            <MultiSelect
              value={draft.scopes}
              onChange={(v) => setDraft({ ...draft, scopes: v })}
              options={[...grantable].map((p) => ({ value: p, label: p }))}
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
