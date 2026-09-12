import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CommentVisibility, CursorPage } from '@flowdesk/types';
import { api } from '@/lib/api/client';
import type { TaskView } from '@/features/board/board.api';
import { boardKey, patchBoardTask } from '@/features/board/board.api';

export interface CommentView {
  id: string;
  taskId: string;
  authorUserId: string;
  bodyHtml: string;
  visibility: CommentVisibility;
  mentionUserIds: string[];
  edited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentView {
  id: string;
  name: string;
  url: string;
  resourceType: string;
  format: string;
  bytes: number;
  width: number | null;
  height: number | null;
  uploaderUserId: string;
  clientVisible: boolean;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  verb: string;
  entityType: string;
  entityId: string | null;
  entityTitle: string | null;
  actor: { id: string; name: string } | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

const taskKey = (w: string, id: string) => ['task', w, id];

export function useTask(workspaceId: string, taskId: string | null) {
  return useQuery({
    queryKey: taskKey(workspaceId, taskId ?? ''),
    queryFn: () => api.get<TaskView>(`/workspaces/${workspaceId}/tasks/${taskId}`),
    enabled: Boolean(taskId),
  });
}

export function useSubtree(workspaceId: string, taskId: string | null) {
  return useQuery({
    queryKey: ['subtree', workspaceId, taskId],
    queryFn: () => api.get<TaskView[]>(`/workspaces/${workspaceId}/tasks/${taskId}/subtree`),
    enabled: Boolean(taskId),
  });
}

export function useTaskComments(workspaceId: string, taskId: string | null) {
  return useQuery({
    queryKey: ['comments', workspaceId, taskId],
    queryFn: () => api.get<CommentView[]>(`/workspaces/${workspaceId}/tasks/${taskId}/comments`),
    enabled: Boolean(taskId),
  });
}

export function useTaskAttachments(workspaceId: string, taskId: string | null) {
  return useQuery({
    queryKey: ['attachments', workspaceId, taskId],
    queryFn: () => api.get<AttachmentView[]>(`/workspaces/${workspaceId}/tasks/${taskId}/attachments`),
    enabled: Boolean(taskId),
  });
}

export function useTaskActivity(workspaceId: string, taskId: string | null) {
  return useQuery({
    queryKey: ['task-activity', workspaceId, taskId],
    queryFn: () => api.get<CursorPage<ActivityItem>>(`/workspaces/${workspaceId}/tasks/${taskId}/activity`),
    enabled: Boolean(taskId),
  });
}

// ── mutations ──────────────────────────────────────────────────────────────

export function usePatchTask(workspaceId: string, boardId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, ...body }: { taskId: string } & Record<string, unknown>) =>
      api.patch<TaskView>(`/workspaces/${workspaceId}/tasks/${taskId}`, body),
    // Reflect the change immediately, roll back if the request fails.
    onMutate: async ({ taskId, ...body }) => {
      const k = taskKey(workspaceId, taskId);
      await qc.cancelQueries({ queryKey: k });
      const snapshot = qc.getQueryData<TaskView>(k);
      qc.setQueryData<TaskView>(k, (old) => (old ? { ...old, ...body } : old));
      if (boardId) patchBoardTask(qc, boardKey(workspaceId, boardId), taskId, (t) => ({ ...t, ...body }));
      return { snapshot, k };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.k && ctx.snapshot) {
        qc.setQueryData(ctx.k, ctx.snapshot);
        if (boardId) patchBoardTask(qc, boardKey(workspaceId, boardId), ctx.snapshot.id, () => ctx.snapshot!);
      }
    },
    onSuccess: (task) => {
      qc.setQueryData(taskKey(workspaceId, task.id), task);
      if (boardId) patchBoardTask(qc, boardKey(workspaceId, boardId), task.id, () => task);
    },
  });
}

export function useCreateSubtask(workspaceId: string, parentTaskId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      api.post<TaskView>(`/workspaces/${workspaceId}/tasks`, { projectId, parentTaskId, title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subtree', workspaceId, parentTaskId] }),
  });
}

/** Toggle a task's completion; optimistically flips `completedAt` in the parent's subtree cache. */
export function useSetTaskComplete(workspaceId: string, parentTaskId: string, boardId?: string) {
  const qc = useQueryClient();
  const subtreeKey = ['subtree', workspaceId, parentTaskId];
  return useMutation({
    mutationFn: (v: { taskId: string; completed: boolean }) =>
      api.patch<TaskView>(`/workspaces/${workspaceId}/tasks/${v.taskId}/complete`, { completed: v.completed }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: subtreeKey });
      const snapshot = qc.getQueryData<TaskView[]>(subtreeKey);
      qc.setQueryData<TaskView[]>(subtreeKey, (prev) =>
        prev?.map((t) =>
          t.id === v.taskId ? { ...t, completedAt: v.completed ? (t.completedAt ?? new Date().toISOString()) : null } : t,
        ),
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => ctx?.snapshot && qc.setQueryData(subtreeKey, ctx.snapshot),
    onSuccess: (task) => {
      qc.setQueryData<TaskView[]>(subtreeKey, (prev) => prev?.map((t) => (t.id === task.id ? task : t)));
      qc.setQueryData(taskKey(workspaceId, task.id), task);
      if (boardId) patchBoardTask(qc, boardKey(workspaceId, boardId), task.id, () => task);
    },
  });
}

export function useAddComment(workspaceId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { bodyHtml: string; visibility: CommentVisibility; mentionUserIds?: string[] }) =>
      api.post<CommentView>(`/workspaces/${workspaceId}/tasks/${taskId}/comments`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', workspaceId, taskId] }),
  });
}

export function useEditComment(workspaceId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, bodyHtml }: { commentId: string; bodyHtml: string }) =>
      api.patch<CommentView>(`/workspaces/${workspaceId}/tasks/${taskId}/comments/${commentId}`, { bodyHtml }),
    onSuccess: (comment) =>
      qc.setQueryData<CommentView[]>(['comments', workspaceId, taskId], (prev) =>
        prev ? prev.map((c) => (c.id === comment.id ? comment : c)) : prev,
      ),
  });
}

export function useDeleteComment(workspaceId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api.delete(`/workspaces/${workspaceId}/tasks/${taskId}/comments/${commentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', workspaceId, taskId] }),
  });
}

export function useChecklistOps(workspaceId: string, taskId: string, boardId?: string) {
  const qc = useQueryClient();
  const sync = (task: TaskView): void => {
    qc.setQueryData(taskKey(workspaceId, taskId), task);
    if (boardId) patchBoardTask(qc, boardKey(workspaceId, boardId), taskId, () => task);
  };
  const base = `/workspaces/${workspaceId}/tasks/${taskId}/checklists`;
  return {
    addChecklist: useMutation({ mutationFn: (title: string) => api.post<TaskView>(base, { title }), onSuccess: sync }),
    removeChecklist: useMutation({ mutationFn: (id: string) => api.delete<TaskView>(`${base}/${id}`), onSuccess: sync }),
    addItem: useMutation({
      mutationFn: (v: { checklistId: string; text: string }) => api.post<TaskView>(`${base}/${v.checklistId}/items`, { text: v.text }),
      onSuccess: sync,
    }),
    toggleItem: useMutation({
      mutationFn: (v: { checklistId: string; itemId: string; done: boolean }) =>
        api.patch<TaskView>(`${base}/${v.checklistId}/items/${v.itemId}`, { done: v.done }),
      onSuccess: sync,
    }),
    removeItem: useMutation({
      mutationFn: (v: { checklistId: string; itemId: string }) => api.delete<TaskView>(`${base}/${v.checklistId}/items/${v.itemId}`),
      onSuccess: sync,
    }),
  };
}

export function useUploadAttachment(workspaceId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post<AttachmentView>(`/workspaces/${workspaceId}/tasks/${taskId}/attachments`, fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', workspaceId, taskId] }),
  });
}

export function useDeleteAttachment(workspaceId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      api.delete(`/workspaces/${workspaceId}/tasks/${taskId}/attachments/${attachmentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', workspaceId, taskId] }),
  });
}
