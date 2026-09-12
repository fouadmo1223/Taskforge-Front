import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeMessage } from '@flowdesk/types';
import { realtime } from '@/lib/realtime/ably';
import { useAuth } from '@/features/auth/auth.store';
import {
  boardKey,
  patchBoardTask,
  removeBoardTask,
  upsertBoardTask,
  type BoardBundle,
  type TaskView,
} from './board.api';

/** Keeps the cached board bundle in sync with realtime events from other users. */
export function useBoardRealtime(workspaceId: string, boardId: string): void {
  const qc = useQueryClient();
  const myId = useAuth((s) => s.user?.id ?? null);

  useEffect(() => {
    const key = boardKey(workspaceId, boardId);
    const mineOnly = (msg: RealtimeMessage): boolean => msg.actorId === myId;

    const offs = [
      realtime.on('task.created', (msg) => {
        if (mineOnly(msg)) return;
        const task = (msg.payload as { task?: TaskView }).task;
        if (task?.boardId === boardId) upsertBoardTask(qc, key, task);
      }),
      realtime.on('task.updated', (msg) => {
        if (mineOnly(msg)) return;
        const task = (msg.payload as { task?: TaskView }).task;
        if (task) {
          qc.setQueryData(['task', workspaceId, task.id], task);
          if (task.boardId === boardId) patchBoardTask(qc, key, task.id, () => task);
        }
      }),
      realtime.on('task.moved', (msg) => {
        if (mineOnly(msg)) return;
        const task = (msg.payload as { task?: TaskView }).task;
        if (task?.boardId === boardId) patchBoardTask(qc, key, task.id, () => task);
      }),
      realtime.on('task.deleted', (msg) => {
        if (mineOnly(msg)) return;
        const taskId = (msg.payload as { taskId?: string }).taskId;
        if (taskId) removeBoardTask(qc, key, taskId);
      }),
      realtime.on('column.created', (msg) => {
        if (mineOnly(msg)) return;
        void qc.invalidateQueries({ queryKey: key });
      }),
      realtime.on('column.updated', (msg) => {
        if (mineOnly(msg)) return;
        void qc.invalidateQueries({ queryKey: key });
      }),
      realtime.on('column.deleted', (msg) => {
        if (mineOnly(msg)) return;
        void qc.invalidateQueries({ queryKey: key });
      }),
      realtime.on('column.reordered', (msg) => {
        if (mineOnly(msg)) return;
        const { columnId, rank } = msg.payload as { columnId?: string; rank?: string };
        if (columnId && rank) {
          qc.setQueryData<BoardBundle>(key, (prev) =>
            prev ? { ...prev, columns: prev.columns.map((c) => (c.id === columnId ? { ...c, rank } : c)) } : prev,
          );
        }
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [qc, workspaceId, boardId, myId]);
}
