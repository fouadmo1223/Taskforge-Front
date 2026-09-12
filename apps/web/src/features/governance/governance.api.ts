import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApprovalStrategy,
  ChangeRequestStatus,
  DecisionStatus,
  IssueStatus,
  RiskScale,
  RiskStatus,
  Severity,
} from '@flowdesk/types';
import { api } from '@/lib/api/client';

export interface RiskView {
  id: string;
  projectId: string;
  title: string;
  description: string;
  probability: RiskScale;
  impact: RiskScale;
  severity: Severity;
  status: RiskStatus;
  ownerUserId: string | null;
  mitigation: string;
  contingency: string;
  reviewDate: string | null;
  closedAt: string | null;
  createdAt: string;
}
export interface IssueView {
  id: string;
  projectId: string;
  title: string;
  description: string;
  severity: Severity;
  status: IssueStatus;
  ownerUserId: string | null;
  linkedRiskId: string | null;
  linkedTaskId: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  createdAt: string;
}
export interface DecisionView {
  id: string;
  projectId: string;
  title: string;
  context: string;
  decision: string;
  status: DecisionStatus;
  decidedByUserId: string | null;
  decidedAt: string | null;
  supersedesId: string | null;
  createdAt: string;
}
export interface RaidBundle {
  risks: RiskView[];
  issues: IssueView[];
  decisions: DecisionView[];
}

const raidKey = (w: string, p: string): unknown[] => ['raid', w, p];

export function useRaid(workspaceId: string, projectId: string) {
  return useQuery({
    queryKey: raidKey(workspaceId, projectId),
    queryFn: () => api.get<RaidBundle>(`/workspaces/${workspaceId}/projects/${projectId}/raid`),
  });
}

function useRaidMutation<T>(workspaceId: string, projectId: string, fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => void qc.invalidateQueries({ queryKey: raidKey(workspaceId, projectId) }) });
}

export function useCreateRisk(w: string, p: string) {
  return useRaidMutation<Partial<RiskView>>(w, p, (b) => api.post(`/workspaces/${w}/projects/${p}/risks`, b));
}
export function useUpdateRisk(w: string, p: string) {
  return useRaidMutation<Partial<RiskView> & { id: string }>(w, p, ({ id, ...b }) => api.patch(`/workspaces/${w}/risks/${id}`, b));
}
export function useDeleteRisk(w: string, p: string) {
  return useRaidMutation<string>(w, p, (id) => api.delete(`/workspaces/${w}/risks/${id}`));
}

export function useCreateIssue(w: string, p: string) {
  return useRaidMutation<Partial<IssueView>>(w, p, (b) => api.post(`/workspaces/${w}/projects/${p}/issues`, b));
}
export function useUpdateIssue(w: string, p: string) {
  return useRaidMutation<Partial<IssueView> & { id: string }>(w, p, ({ id, ...b }) => api.patch(`/workspaces/${w}/issues/${id}`, b));
}
export function useDeleteIssue(w: string, p: string) {
  return useRaidMutation<string>(w, p, (id) => api.delete(`/workspaces/${w}/issues/${id}`));
}

export function useCreateDecision(w: string, p: string) {
  return useRaidMutation<Partial<DecisionView>>(w, p, (b) => api.post(`/workspaces/${w}/projects/${p}/decisions`, b));
}
export function useUpdateDecision(w: string, p: string) {
  return useRaidMutation<Partial<DecisionView> & { id: string }>(w, p, ({ id, ...b }) => api.patch(`/workspaces/${w}/decisions/${id}`, b));
}
export function useDeleteDecision(w: string, p: string) {
  return useRaidMutation<string>(w, p, (id) => api.delete(`/workspaces/${w}/decisions/${id}`));
}

// ── change requests ────────────────────────────────────────────────────────

export interface ChangeRequestView {
  id: string;
  projectId: string;
  number: number;
  key: string;
  title: string;
  description: string;
  reason: string;
  status: ChangeRequestStatus;
  scopeImpact: string;
  scheduleImpactDays: number;
  costImpact: number;
  approvalId: string | null;
  requestedByUserId: string;
  decidedAt: string | null;
  implementedAt: string | null;
  createdAt: string;
}

const crKey = (w: string, p: string): unknown[] => ['change-requests', w, p];

export function useChangeRequests(workspaceId: string, projectId: string) {
  return useQuery({
    queryKey: crKey(workspaceId, projectId),
    queryFn: () => api.get<ChangeRequestView[]>(`/workspaces/${workspaceId}/change-requests`, { query: { projectId } }),
  });
}

function useCrMutation<T>(workspaceId: string, projectId: string, fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => void qc.invalidateQueries({ queryKey: crKey(workspaceId, projectId) }) });
}

export function useCreateChangeRequest(w: string, p: string) {
  return useCrMutation<Partial<ChangeRequestView>>(w, p, (b) => api.post(`/workspaces/${w}/projects/${p}/change-requests`, b));
}
export function useUpdateChangeRequest(w: string, p: string) {
  return useCrMutation<Partial<ChangeRequestView> & { id: string }>(w, p, ({ id, ...b }) => api.patch(`/workspaces/${w}/change-requests/${id}`, b));
}
export function useTransitionChangeRequest(w: string, p: string) {
  return useCrMutation<{ id: string; to: ChangeRequestStatus }>(w, p, ({ id, to }) =>
    api.post(`/workspaces/${w}/change-requests/${id}/transition`, { to }),
  );
}
export function useRequestCrApproval(w: string, p: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approverUserIds, strategy, requiredCount }: { id: string; approverUserIds: string[]; strategy: ApprovalStrategy; requiredCount?: number }) =>
      api.post(`/workspaces/${w}/change-requests/${id}/request-approval`, { approverUserIds, strategy, requiredCount }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crKey(w, p) });
      void qc.invalidateQueries({ queryKey: ['approvals', w] });
    },
  });
}
