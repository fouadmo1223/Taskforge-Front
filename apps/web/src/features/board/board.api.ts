import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { SlaState, StatusCategory, TaskPriority } from '@flowdesk/types';
import { api } from '@/lib/api/client';

export interface ColumnView {
  id: string;
  boardId: string;
  name: string;
  statusCategory: StatusCategory;
  color: string | null;
  rank: string;
  wipLimit: number;
}

export interface ChecklistItemView {
  id: string;
  text: string;
  done: boolean;
  rank: string;
}
export interface ChecklistView {
  id: string;
  title: string;
  rank: string;
  items: ChecklistItemView[];
}

export interface TaskView {
  id: string;
  key: string;
  projectId: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  type: string;
  priority: TaskPriority;
  severity: string | null;
  assigneeUserIds: string[];
  reporterUserId: string;
  followerUserIds: string[];
  labelIds: string[];
  startDate: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  loggedHours: number;
  parentTaskId: string | null;
  depth: number;
  milestoneId: string | null;
  customFields: Record<string, unknown>;
  checklists: ChecklistView[];
  rank: string;
  clientVisible: boolean;
  slaState: SlaState;
  completedAt: string | null;
  commentCount: number;
  attachmentCount: number;
  subtaskCount: number;
  subtaskDoneCount: number;
  createdByUserId: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BoardBundle {
  board: { id: string; projectId: string; name: string; isDefault: boolean; rank: string; archived: boolean };
  columns: ColumnView[];
  tasks: TaskView[];
}

export const boardKey = (workspaceId: string, boardId: string) => ['board', workspaceId, boardId];

export function useBoard(workspaceId: string, boardId: string | undefined) {
  return useQuery({
    queryKey: boardKey(workspaceId, boardId ?? ''),
    queryFn: () => api.get<BoardBundle>(`/workspaces/${workspaceId}/boards/${boardId}/view`),
    enabled: Boolean(boardId),
    staleTime: 10_000,
  });
}

/** Apply a task patch into the cached board bundle (used by realtime + optimistic). */
export function patchBoardTask(
  qc: QueryClient,
  key: readonly unknown[],
  taskId: string,
  updater: (t: TaskView) => TaskView,
): void {
  qc.setQueryData<BoardBundle>(key, (prev) =>
    prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? updater(t) : t)) } : prev,
  );
}

export function upsertBoardTask(qc: QueryClient, key: readonly unknown[], task: TaskView): void {
  qc.setQueryData<BoardBundle>(key, (prev) => {
    if (!prev) return prev;
    if (task.parentTaskId) return prev; // subtasks are not board cards
    const exists = prev.tasks.some((t) => t.id === task.id);
    return { ...prev, tasks: exists ? prev.tasks.map((t) => (t.id === task.id ? task : t)) : [...prev.tasks, task] };
  });
}

export function removeBoardTask(qc: QueryClient, key: readonly unknown[], taskId: string): void {
  qc.setQueryData<BoardBundle>(key, (prev) =>
    prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) } : prev,
  );
}

// ── mutations ──────────────────────────────────────────────────────────────

export function useCreateTask(workspaceId: string, boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { projectId: string; columnId: string; title: string; priority?: TaskPriority; atTop?: boolean }) =>
      api.post<TaskView>(`/workspaces/${workspaceId}/tasks`, body),
    onSuccess: (task) => upsertBoardTask(qc, boardKey(workspaceId, boardId), task),
  });
}

export interface MoveArgs {
  taskId: string;
  columnId: string;
  beforeTaskId?: string | null;
  afterTaskId?: string | null;
  /** client-computed rank for the optimistic update */
  optimisticRank: string;
}

export function useMoveTask(workspaceId: string, boardId: string) {
  const qc = useQueryClient();
  const key = boardKey(workspaceId, boardId);
  return useMutation({
    mutationFn: (args: MoveArgs) =>
      api.patch<TaskView>(`/workspaces/${workspaceId}/tasks/${args.taskId}/move`, {
        columnId: args.columnId,
        beforeTaskId: args.beforeTaskId ?? null,
        afterTaskId: args.afterTaskId ?? null,
      }),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<BoardBundle>(key);
      const taskKey = ['task', workspaceId, args.taskId];
      const taskSnapshot = qc.getQueryData<TaskView>(taskKey);
      patchBoardTask(qc, key, args.taskId, (t) => ({ ...t, columnId: args.columnId, rank: args.optimisticRank }));
      qc.setQueryData<TaskView>(taskKey, (old) => (old ? { ...old, columnId: args.columnId } : old));
      return { snapshot, taskSnapshot, taskKey };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(key, ctx.snapshot);
      if (ctx?.taskKey && ctx.taskSnapshot) qc.setQueryData(ctx.taskKey, ctx.taskSnapshot);
    },
    onSuccess: (task) => {
      patchBoardTask(qc, key, task.id, () => task);
      qc.setQueryData(['task', workspaceId, task.id], task);
    },
  });
}

export function useUpdateTask(workspaceId: string, boardId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, ...body }: { taskId: string } & Partial<Record<string, unknown>>) =>
      api.patch<TaskView>(`/workspaces/${workspaceId}/tasks/${taskId}`, body),
    onSuccess: (task) => {
      qc.setQueryData(['task', workspaceId, task.id], task);
      if (boardId) patchBoardTask(qc, boardKey(workspaceId, boardId), task.id, () => task);
    },
  });
}

export function useDeleteTask(workspaceId: string, boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api.delete(`/workspaces/${workspaceId}/tasks/${taskId}`),
    onSuccess: (_res, taskId) => removeBoardTask(qc, boardKey(workspaceId, boardId), taskId),
  });
}

export function useReorderColumn(workspaceId: string, boardId: string) {
  const qc = useQueryClient();
  const key = boardKey(workspaceId, boardId);
  return useMutation({
    mutationFn: (v: { columnId: string; beforeColumnId: string | null; afterColumnId: string | null; optimisticRank: string }) =>
      api.patch<ColumnView>(`/workspaces/${workspaceId}/columns/${v.columnId}/reorder`, {
        beforeColumnId: v.beforeColumnId,
        afterColumnId: v.afterColumnId,
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<BoardBundle>(key);
      qc.setQueryData<BoardBundle>(key, (prev) =>
        prev
          ? { ...prev, columns: prev.columns.map((c) => (c.id === v.columnId ? { ...c, rank: v.optimisticRank } : c)) }
          : prev,
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => ctx?.snapshot && qc.setQueryData(key, ctx.snapshot),
    onSuccess: (col) =>
      qc.setQueryData<BoardBundle>(key, (prev) =>
        prev ? { ...prev, columns: prev.columns.map((c) => (c.id === col.id ? col : c)) } : prev,
      ),
  });
}

export function useCreateColumn(workspaceId: string, boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; projectId: string }) =>
      api.post<ColumnView>(`/workspaces/${workspaceId}/boards/${boardId}/columns`, body),
    onSuccess: (col) =>
      qc.setQueryData<BoardBundle>(boardKey(workspaceId, boardId), (prev) =>
        prev ? { ...prev, columns: [...prev.columns, col] } : prev,
      ),
  });
}

export function useUpdateColumn(workspaceId: string, boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, ...body }: { columnId: string; name?: string; wipLimit?: number; statusCategory?: StatusCategory; color?: string | null }) =>
      api.patch<ColumnView>(`/workspaces/${workspaceId}/columns/${columnId}`, body),
    onSuccess: (col) =>
      qc.setQueryData<BoardBundle>(boardKey(workspaceId, boardId), (prev) =>
        prev ? { ...prev, columns: prev.columns.map((c) => (c.id === col.id ? col : c)) } : prev,
      ),
  });
}

export function useDeleteColumn(workspaceId: string, boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { columnId: string; moveToColumnId?: string }) =>
      api.delete(`/workspaces/${workspaceId}/columns/${v.columnId}`, {
        query: v.moveToColumnId ? { moveToColumnId: v.moveToColumnId } : {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKey(workspaceId, boardId) }),
  });
}
