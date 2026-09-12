import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GoalStatus, GoalType } from '@flowdesk/types';
import { api } from '@/lib/api/client';

// ── portfolios ─────────────────────────────────────────────────────────────

export interface PortfolioView {
  id: string;
  name: string;
  description: string;
  color: string;
  projectIds: string[];
  ownerUserId: string | null;
  archived: boolean;
  createdAt: string;
}

export interface PortfolioRollup extends PortfolioView {
  projects: Array<{ id: string; key: string; name: string; status: string; openTasks: number; totalTasks: number; doneRatio: number }>;
  totals: { projects: number; openTasks: number; totalTasks: number; doneRatio: number };
}

const pfKey = (w: string): unknown[] => ['portfolios', w];

export function usePortfolios(workspaceId: string) {
  return useQuery({ queryKey: pfKey(workspaceId), queryFn: () => api.get<PortfolioView[]>(`/workspaces/${workspaceId}/portfolios`) });
}
export function usePortfolioRollup(workspaceId: string, id: string | null) {
  return useQuery({
    queryKey: ['portfolio-rollup', workspaceId, id],
    queryFn: () => api.get<PortfolioRollup>(`/workspaces/${workspaceId}/portfolios/${id}/rollup`),
    enabled: Boolean(id),
  });
}
export function useCreatePortfolio(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PortfolioView> & { name: string }) => api.post<PortfolioView>(`/workspaces/${workspaceId}/portfolios`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pfKey(workspaceId) }),
  });
}
export function useUpdatePortfolio(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<PortfolioView> & { id: string }) =>
      api.patch<PortfolioView>(`/workspaces/${workspaceId}/portfolios/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pfKey(workspaceId) });
      void qc.invalidateQueries({ queryKey: ['portfolio-rollup', workspaceId] });
    },
  });
}
export function useDeletePortfolio(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/portfolios/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: pfKey(workspaceId) }),
  });
}

// ── goals ──────────────────────────────────────────────────────────────────

export interface KeyResultView {
  id: string;
  title: string;
  start: number;
  target: number;
  current: number;
  unit: string;
  progress: number;
}
export interface GoalView {
  id: string;
  title: string;
  description: string;
  type: GoalType;
  start: number;
  target: number;
  current: number;
  unit: string;
  status: GoalStatus;
  progress: number;
  ownerUserId: string | null;
  portfolioId: string | null;
  projectId: string | null;
  parentGoalId: string | null;
  keyResults: KeyResultView[];
  dueDate: string | null;
  createdAt: string;
}

const goalKey = (w: string): unknown[] => ['goals', w];

export function useGoals(workspaceId: string, opts: { portfolioId?: string; projectId?: string } = {}) {
  return useQuery({
    queryKey: [...goalKey(workspaceId), opts.portfolioId ?? null, opts.projectId ?? null],
    queryFn: () => api.get<GoalView[]>(`/workspaces/${workspaceId}/goals`, { query: opts }),
  });
}
export function useCreateGoal(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<GoalView> & { title: string }) => api.post<GoalView>(`/workspaces/${workspaceId}/goals`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: goalKey(workspaceId) }),
  });
}
export function useUpdateGoal(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<GoalView> & { id: string }) => api.patch<GoalView>(`/workspaces/${workspaceId}/goals/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: goalKey(workspaceId) }),
  });
}
export function useSetKeyResults(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, keyResults }: { id: string; keyResults: Array<{ title: string; current?: number; target?: number; unit?: string }> }) =>
      api.put<GoalView>(`/workspaces/${workspaceId}/goals/${id}/key-results`, { keyResults }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: goalKey(workspaceId) }),
  });
}
export function useDeleteGoal(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/goals/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: goalKey(workspaceId) }),
  });
}
