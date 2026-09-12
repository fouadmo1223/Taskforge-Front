import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AutomationTrigger, WebhookEvent } from '@flowdesk/types';
import { api } from '@/lib/api/client';

export interface AutomationView {
  id: string;
  name: string;
  active: boolean;
  projectId: string | null;
  trigger: { type: AutomationTrigger; config: Record<string, unknown> };
  conditions: { field: string; op: string; value: unknown }[];
  actions: { id: string; type: string; config: Record<string, unknown> }[];
  runCount: number;
  lastRunAt: string | null;
  lastError: string;
  createdAt: string;
}

export interface AutomationRunView {
  id: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  trigger: string;
  actionsRun: string[];
  error: string;
  createdAt: string;
}

export interface AutomationInput {
  name: string;
  projectId?: string | null;
  trigger: { type: AutomationTrigger; config?: Record<string, unknown> };
  conditions?: { field: string; op: string; value?: unknown }[];
  actions: { type: string; config?: Record<string, unknown> }[];
  active?: boolean;
}

const key = (w: string): unknown[] => ['automations', w];

export function useAutomations(workspaceId: string) {
  return useQuery({ queryKey: key(workspaceId), queryFn: () => api.get<AutomationView[]>(`/workspaces/${workspaceId}/automations`) });
}
export function useAutomationRuns(workspaceId: string, id: string | null) {
  return useQuery({
    queryKey: ['automation-runs', workspaceId, id],
    queryFn: () => api.get<AutomationRunView[]>(`/workspaces/${workspaceId}/automations/${id}/runs`),
    enabled: Boolean(id),
  });
}
export function useCreateAutomation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AutomationInput) => api.post<AutomationView>(`/workspaces/${workspaceId}/automations`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
export function useUpdateAutomation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<AutomationInput> & { id: string }) =>
      api.patch<AutomationView>(`/workspaces/${workspaceId}/automations/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
export function useDeleteAutomation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/automations/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
export function useRunAutomations(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ automations: number; executed: number }>(`/workspaces/${workspaceId}/automations/run`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}
/** Run one automation once against a sample/empty context — works for any trigger type. */
export function useTestAutomation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ status: string; actionsRun: string[]; error: string }>(`/workspaces/${workspaceId}/automations/${id}/test`, {
        context: {},
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(workspaceId) }),
  });
}

// ── webhooks ───────────────────────────────────────────────────────────────

export interface WebhookView {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  lastStatus: number | null;
  lastDeliveryAt: string | null;
  failureCount: number;
  createdAt: string;
}

const whKey = (w: string): unknown[] => ['webhooks', w];

export function useWebhooks(workspaceId: string) {
  return useQuery({ queryKey: whKey(workspaceId), queryFn: () => api.get<WebhookView[]>(`/workspaces/${workspaceId}/webhooks`) });
}
export function useCreateWebhook(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { url: string; events: WebhookEvent[] }) => api.post<WebhookView>(`/workspaces/${workspaceId}/webhooks`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: whKey(workspaceId) }),
  });
}
export function useUpdateWebhook(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; url?: string; events?: WebhookEvent[]; active?: boolean }) =>
      api.patch<WebhookView>(`/workspaces/${workspaceId}/webhooks/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: whKey(workspaceId) }),
  });
}
export function useDeleteWebhook(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/webhooks/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: whKey(workspaceId) }),
  });
}
export function useTestWebhook(workspaceId: string) {
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: boolean; status: number | null; error: string }>(`/workspaces/${workspaceId}/webhooks/${id}/test`),
  });
}

// ── API tokens ─────────────────────────────────────────────────────────────

export interface ApiTokenView {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
}

const atKey = (w: string): unknown[] => ['api-tokens', w];

export function useApiTokens(workspaceId: string) {
  return useQuery({ queryKey: atKey(workspaceId), queryFn: () => api.get<ApiTokenView[]>(`/workspaces/${workspaceId}/api-tokens`) });
}
export function useCreateApiToken(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; scopes: string[]; expiresInDays?: number }) =>
      api.post<ApiTokenView & { token: string }>(`/workspaces/${workspaceId}/api-tokens`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: atKey(workspaceId) }),
  });
}
export function useRevokeApiToken(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/api-tokens/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: atKey(workspaceId) }),
  });
}
