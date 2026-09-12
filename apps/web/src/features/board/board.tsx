import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { rankBetween } from '@flowdesk/utils';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useWorkspaceUsers } from '@/features/workspace/use-workspace-users';
import { useLabels, type LabelView } from '@/features/labels/labels.api';
import { useRoom } from '@/lib/realtime/hooks';
import { channels } from '@flowdesk/types';
import { toast } from '@/components/ui';
import { Scrollable } from '@/components/ui/scrollable';
import { ErrorState, Skeleton } from '@/components/ui/misc';
import {
  useBoard,
  useCreateTask,
  useMoveTask,
  useReorderColumn,
  useCreateColumn,
  useUpdateColumn,
  useDeleteColumn,
  type TaskView,
} from './board.api';
import { BoardColumn } from './board-column';
import { TaskCard } from './task-card';
import { useBoardRealtime } from './use-board-realtime';

interface BoardProps {
  boardId: string;
  projectId: string;
  onOpenTask: (taskId: string) => void;
}

function bySortRank<T extends { rank: string }>(a: T, b: T): number {
  return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0;
}

export function Board({ boardId, projectId, onOpenTask }: BoardProps): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const board = useBoard(workspaceId, boardId);
  const { byId: usersById } = useWorkspaceUsers(workspaceId);
  const labelsQ = useLabels(workspaceId);
  const labelsById = useMemo(
    () => new Map((labelsQ.data ?? []).map((l) => [l.id, l] as const)),
    [labelsQ.data],
  );

  useRoom(channels.workspace(workspaceId));
  useBoardRealtime(workspaceId, boardId);

  const move = useMoveTask(workspaceId, boardId);
  const reorderColumn = useReorderColumn(workspaceId, boardId);
  const createTask = useCreateTask(workspaceId, boardId);
  const createColumn = useCreateColumn(workspaceId, boardId);
  const updateColumn = useUpdateColumn(workspaceId, boardId);
  const deleteColumn = useDeleteColumn(workspaceId, boardId);

  const [activeCard, setActiveCard] = useState<TaskView | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columns = useMemo(() => [...(board.data?.columns ?? [])].sort(bySortRank), [board.data?.columns]);
  const tasksByColumn = useMemo(() => {
    const map = new Map<string, TaskView[]>();
    for (const col of columns) map.set(col.id, []);
    for (const task of board.data?.tasks ?? []) {
      if (!map.has(task.columnId)) map.set(task.columnId, []);
      map.get(task.columnId)!.push(task);
    }
    for (const list of map.values()) list.sort(bySortRank);
    return map;
  }, [board.data?.tasks, columns]);

  const onDragStart = useCallback(
    (e: DragStartEvent) => {
      if (e.active.data.current?.type === 'card') setActiveCard(e.active.data.current.task as TaskView);
    },
    [],
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveCard(null);
      const { active, over } = e;
      if (!over || !board.data) return;
      const activeType = active.data.current?.type;

      if (activeType === 'column') {
        if (active.id === over.id) return;
        const ordered = [...columns];
        const fromIdx = ordered.findIndex((c) => c.id === active.id);
        const overId = String(over.id).replace('col-drop-', '');
        const toIdx = ordered.findIndex((c) => c.id === overId);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
        ordered.splice(toIdx, 0, ordered.splice(fromIdx, 1)[0]!);
        const pos = ordered.findIndex((c) => c.id === active.id);
        const beforeRank = ordered[pos - 1]?.rank ?? null;
        const afterRank = ordered[pos + 1]?.rank ?? null;
        reorderColumn.mutate({
          columnId: String(active.id),
          beforeColumnId: ordered[pos - 1]?.id ?? null,
          afterColumnId: ordered[pos + 1]?.id ?? null,
          optimisticRank: rankBetween(beforeRank, afterRank),
        });
        return;
      }

      // card move
      const task = active.data.current?.task as TaskView | undefined;
      if (!task) return;

      const overData = over.data.current;
      let targetColumnId: string;
      let targetList: TaskView[];
      let insertIndex: number;

      if (overData?.type === 'column') {
        targetColumnId = overData.columnId as string;
        targetList = (tasksByColumn.get(targetColumnId) ?? []).filter((tk) => tk.id !== task.id);
        insertIndex = targetList.length;
      } else {
        const overTask = overData?.task as TaskView | undefined;
        if (!overTask) return;
        targetColumnId = overTask.columnId;
        targetList = (tasksByColumn.get(targetColumnId) ?? []).filter((tk) => tk.id !== task.id);
        const overIdx = targetList.findIndex((tk) => tk.id === overTask.id);
        insertIndex = overIdx < 0 ? targetList.length : overIdx;
      }

      const before = targetList[insertIndex - 1] ?? null;
      const after = targetList[insertIndex] ?? null;
      if (targetColumnId === task.columnId && before?.id !== undefined) {
        // no-op if it didn't actually move
        const current = (tasksByColumn.get(task.columnId) ?? []).findIndex((tk) => tk.id === task.id);
        if (current === insertIndex || current === insertIndex - 1 ? current === insertIndex : false) return;
      }

      let optimisticRank: string;
      try {
        optimisticRank = rankBetween(before?.rank ?? null, after?.rank ?? null);
      } catch {
        return;
      }

      move.mutate(
        {
          taskId: task.id,
          columnId: targetColumnId,
          beforeTaskId: before?.id ?? null,
          afterTaskId: after?.id ?? null,
          optimisticRank,
        },
        { onError: () => toast.error(t('board.moveFailed')) },
      );
    },
    [board.data, columns, tasksByColumn, move, reorderColumn, t],
  );

  if (board.isLoading) {
    return (
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-full w-72 shrink-0 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (board.isError || !board.data) {
    return <ErrorState title={t('errors.generic')} onRetry={() => void board.refetch()} retryLabel={t('common.retry')} />;
  }

  const canManageBoard = can('board.manage');
  const canCreateTask = can('task.create');
  const canMove = can('task.move');

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={canMove || canManageBoard ? onDragStart : undefined}
      onDragEnd={canMove || canManageBoard ? onDragEnd : undefined}
    >
      <Scrollable axis="x" className="h-full">
        <div className="flex h-full items-start gap-4 p-4">
          <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            {columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                tasks={tasksByColumn.get(column.id) ?? []}
                usersById={usersById}
                labelsById={labelsById as Map<string, LabelView>}
                canManageBoard={canManageBoard}
                canCreateTask={canCreateTask}
                activeTaskId={activeCard?.id ?? null}
                onOpenTask={onOpenTask}
                onAddCard={async (columnId, title) => {
                  await createTask.mutateAsync({ projectId, columnId, title }).catch(() => toast.error(t('errors.generic')));
                }}
                onRename={(columnId, name) => updateColumn.mutate({ columnId, name })}
                onUpdate={(columnId, patch) => updateColumn.mutate({ columnId, ...patch })}
                onDelete={(columnId) => {
                  const fallback = columns.find((c) => c.id !== columnId);
                  deleteColumn.mutate(
                    { columnId, moveToColumnId: fallback?.id },
                    { onError: () => toast.error(t('errors.generic')) },
                  );
                }}
                addPending={createTask.isPending}
              />
            ))}
          </SortableContext>

          {canManageBoard && (
            <AddColumn onAdd={(name) => createColumn.mutate({ name, projectId })} pending={createColumn.isPending} />
          )}
        </div>
      </Scrollable>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.25,1,0.5,1)' }}>
        {activeCard ? (
          <div className="w-64 rotate-2">
            <TaskCard
              task={activeCard}
              usersById={usersById}
              labelsById={labelsById as Map<string, LabelView>}
              onOpen={() => undefined}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function AddColumn({ onAdd, pending }: { onAdd: (name: string) => void; pending: boolean }): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-72 shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-sm text-text-muted hover:border-border-strong hover:text-text"
      >
        <Plus className="size-4" />
        {t('board.addColumn')}
      </button>
    );
  }
  return (
    <div className="w-72 shrink-0 rounded-2xl bg-surface-sunken/60 p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('board.newColumnName')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) {
            onAdd(name.trim());
            setName('');
            setOpen(false);
          }
          if (e.key === 'Escape') {
            setOpen(false);
            setName('');
          }
        }}
        onBlur={() => {
          if (name.trim()) onAdd(name.trim());
          setName('');
          setOpen(false);
        }}
        className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text outline-none focus:border-primary"
        disabled={pending}
      />
    </div>
  );
}
