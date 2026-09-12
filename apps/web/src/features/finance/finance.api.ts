import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExpenseStatus } from '@flowdesk/types';
import { api } from '@/lib/api/client';

export interface BudgetView {
  projectId: string;
  currency: string;
  amount: number;
  categories: { name: string; amount: number }[];
  notes: string;
  updatedAt: string | null;
}

export interface ExpenseView {
  id: string;
  projectId: string;
  taskId: string | null;
  description: string;
  amount: number;
  currency: string;
  category: string;
  spentAt: string;
  billable: boolean;
  status: ExpenseStatus;
  receiptUrl: string | null;
  submittedByUserId: string;
  reviewedByUserId: string | null;
  reviewNote: string;
  createdAt: string;
}

export interface FinanceSummary {
  projectId: string;
  currency: string;
  budget: number;
  committed: number;
  spent: number;
  billable: number;
  remaining: number;
  byCategory: { name: string; budget: number; spent: number }[];
}

export function useBudget(workspaceId: string, projectId: string) {
  return useQuery({
    queryKey: ['budget', workspaceId, projectId],
    queryFn: () => api.get<BudgetView>(`/workspaces/${workspaceId}/projects/${projectId}/budget`),
  });
}

export function useSetBudget(workspaceId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Omit<BudgetView, 'projectId' | 'updatedAt'>>) =>
      api.put<BudgetView>(`/workspaces/${workspaceId}/projects/${projectId}/budget`, body),
    onSuccess: (data) => {
      qc.setQueryData(['budget', workspaceId, projectId], data);
      void qc.invalidateQueries({ queryKey: ['finance-summary', workspaceId, projectId] });
    },
  });
}

export function useFinanceSummary(workspaceId: string, projectId: string) {
  return useQuery({
    queryKey: ['finance-summary', workspaceId, projectId],
    queryFn: () => api.get<FinanceSummary>(`/workspaces/${workspaceId}/projects/${projectId}/finance-summary`),
  });
}

export function useExpenses(workspaceId: string, projectId: string) {
  return useQuery({
    queryKey: ['expenses', workspaceId, projectId],
    queryFn: () => api.get<ExpenseView[]>(`/workspaces/${workspaceId}/expenses`, { query: { projectId } }),
  });
}

function bust(qc: ReturnType<typeof useQueryClient>, workspaceId: string, projectId: string): void {
  void qc.invalidateQueries({ queryKey: ['expenses', workspaceId, projectId] });
  void qc.invalidateQueries({ queryKey: ['finance-summary', workspaceId, projectId] });
}

export function useCreateExpense(workspaceId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { description: string; amount: number; category?: string; spentAt: string; billable?: boolean }) =>
      api.post<ExpenseView>(`/workspaces/${workspaceId}/expenses`, { projectId, ...body }),
    onSuccess: () => bust(qc, workspaceId, projectId),
  });
}

export function useUpdateExpense(workspaceId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ExpenseView> & { id: string }) =>
      api.patch<ExpenseView>(`/workspaces/${workspaceId}/expenses/${id}`, body),
    onSuccess: () => bust(qc, workspaceId, projectId),
  });
}

export function useExpenseAction(workspaceId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, decision, note }: { id: string; action: 'submit' | 'review'; decision?: 'approve' | 'reject' | 'reimburse'; note?: string }) =>
      action === 'submit'
        ? api.post<ExpenseView>(`/workspaces/${workspaceId}/expenses/${id}/submit`)
        : api.post<ExpenseView>(`/workspaces/${workspaceId}/expenses/${id}/review`, { decision, note }),
    onSuccess: () => bust(qc, workspaceId, projectId),
  });
}

export function useDeleteExpense(workspaceId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/expenses/${id}`),
    onSuccess: () => bust(qc, workspaceId, projectId),
  });
}
