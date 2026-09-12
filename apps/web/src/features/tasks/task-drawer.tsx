import { useEffect, useMemo, useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { useTranslation } from 'react-i18next';
import { Link2, MoreHorizontal, Trash2, Archive, X } from 'lucide-react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { api } from '@/lib/api/client';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useWorkspaceUsers } from '@/features/workspace/use-workspace-users';
import { useLabels } from '@/features/labels/labels.api';
import { useBoard, useMoveTask, type TaskView } from '@/features/board/board.api';
import { columnLabel } from '@/features/board/column-label';
import { useRoom, useRealtimeEvent } from '@/lib/realtime/hooks';
import { channels } from '@flowdesk/types';
import { Drawer } from '@/components/ui/drawer';
import { DatePicker, Field, MultiSelect, NumberInput, Select, Skeleton, confirm, toast } from '@/components/ui';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { UserMultiSelect, PrioritySelect } from '@/components/ui/select/specialized';
import { RichTextEditor } from '@/components/ui/rich-text';
import { scheduleImpact, type ScheduleImpactRow } from '@/features/planning/planning.api';
import { ScheduleImpactDialog } from '@/features/planning/schedule-impact-dialog';
import { TaskTimePanel } from '@/features/time/task-time-panel';
import { useTask, usePatchTask, useUploadAttachment } from './tasks.api';
import { DependenciesPanel } from './dependencies-panel';
import { ActivityPanel, AttachmentsPanel, ChecklistsPanel, CommentsPanel, SubtasksPanel } from './task-panels';

interface TaskDrawerProps {
  workspaceId: string;
  taskId: string | null;
  boardId?: string;
  onClose: () => void;
  onOpenTask: (id: string) => void;
}

export function TaskDrawer({ workspaceId, taskId, boardId, onClose, onOpenTask }: TaskDrawerProps): React.ReactElement {
  const { t } = useTranslation();
  const { can } = useWorkspace();
  const taskQ = useTask(workspaceId, taskId);
  const task = taskQ.data;
  const board = useBoard(workspaceId, boardId ?? task?.boardId);
  const { users, byId: usersById } = useWorkspaceUsers(workspaceId);
  const labelsQ = useLabels(workspaceId);
  const patch = usePatchTask(workspaceId, boardId);
  const uploadImage = useUploadAttachment(workspaceId, taskId ?? '');
  const move = useMoveTask(workspaceId, board.data?.board.id ?? '');

  useRoom(workspaceId ? channels.workspace(workspaceId) : null);
  useRealtimeEvent<{ task?: TaskView }>('task.updated', (msg) => {
    if (msg.payload.task && msg.payload.task.id === taskId) {
      taskQ.refetch().catch(() => undefined);
    }
  });

  const [title, setTitle] = useState('');
  const [impactRows, setImpactRows] = useState<ScheduleImpactRow[] | null>(null);
  useEffect(() => {
    if (task) setTitle(task.title);
  }, [task?.id, task?.title]);

  const editable = can('task.update');
  const columnOptions = useMemo(
    () =>
      [...(board.data?.columns ?? [])]
        .sort((a, b) => (a.rank < b.rank ? -1 : 1))
        .map((c) => ({ value: c.id, label: columnLabel(c.name, t) })),
    [board.data?.columns, t],
  );
  const labelOptions = useMemo(
    () => (labelsQ.data ?? []).map((l) => ({ value: l.id, label: l.name, icon: <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} /> })),
    [labelsQ.data],
  );
  const labelsById = useMemo(() => new Map((labelsQ.data ?? []).map((l) => [l.id, l])), [labelsQ.data]);

  const saveField = (body: Record<string, unknown>): void => {
    if (!taskId) return;
    patch.mutate(
      { taskId, ...body },
      {
        onError: (e) => toast.error(errorText(e, t)),
        onSuccess: (updated) => {
          // If the due date moved later, offer to shift dependent tasks.
          if (
            'dueDate' in body &&
            body.dueDate &&
            task?.dueDate &&
            new Date(String(body.dueDate)) > new Date(task.dueDate) &&
            can('dependency.manage')
          ) {
            scheduleImpact(workspaceId, updated.id, updated.dueDate ?? String(body.dueDate))
              .then((rows) => rows.length > 0 && setImpactRows(rows))
              .catch(() => undefined);
          }
        },
      },
    );
  };

  return (
    <Drawer open={Boolean(taskId)} onOpenChange={(o) => !o && onClose()} width="40rem" title={task?.key ?? t('common.loading')}>
      {taskQ.isLoading || !task ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* header actions */}
          <div className="-mt-1 flex items-center justify-end gap-1">
            <span
              className={cn(
                'me-auto flex items-center gap-1.5 text-xs transition-opacity',
                patch.isPending ? 'text-text-subtle opacity-100' : patch.isSuccess ? 'text-success opacity-100' : 'opacity-0',
              )}
            >
              {patch.isPending ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  {t('task.saving')}
                </>
              ) : (
                <>
                  <Check className="size-3" />
                  {t('task.saved')}
                </>
              )}
            </span>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}?task=${task.id}`);
                toast.success(t('task.linkCopied'));
              }}
              className="rounded-lg p-1.5 text-text-subtle hover:bg-surface-sunken hover:text-text"
            >
              <Link2 className="size-4" />
            </button>
            {(can('task.delete') || can('task.update')) && (
              <Dropdown.Root>
                <Dropdown.Trigger className="rounded-lg p-1.5 text-text-subtle hover:bg-surface-sunken hover:text-text">
                  <MoreHorizontal className="size-4" />
                </Dropdown.Trigger>
                <Dropdown.Portal>
                  <Dropdown.Content align="end" sideOffset={4} className="z-[60] w-44 rounded-xl border border-border bg-surface-elevated p-1.5 shadow-pop">
                    {can('task.update') && (
                      <Dropdown.Item
                        onSelect={async () => {
                          await api.post(`/workspaces/${workspaceId}/tasks/${task.id}/archive`, { archived: !task.archived }).catch(() => undefined);
                          taskQ.refetch().catch(() => undefined);
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-sunken"
                      >
                        <Archive className="size-4 text-text-subtle" />
                        {task.archived ? t('task.unarchive') : t('task.archive')}
                      </Dropdown.Item>
                    )}
                    {can('task.delete') && (
                      <Dropdown.Item
                        onSelect={async () => {
                          if (await confirm({ title: t('common.delete'), body: task.title, tone: 'danger', confirmLabel: t('common.delete') })) {
                            await api.delete(`/workspaces/${workspaceId}/tasks/${task.id}`).catch(() => undefined);
                            onClose();
                          }
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
                      >
                        <Trash2 className="size-4" />
                        {t('common.delete')}
                      </Dropdown.Item>
                    )}
                  </Dropdown.Content>
                </Dropdown.Portal>
              </Dropdown.Root>
            )}
          </div>

          {/* title */}
          <textarea
            value={title}
            rows={1}
            disabled={!editable}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && saveField({ title: title.trim() })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="scrollable w-full resize-none bg-transparent text-lg font-semibold text-text outline-none"
          />

          {/* meta grid */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('task.column')}>
              <Select
                size="sm"
                value={task.columnId}
                onChange={(v) => v && move.mutate({ taskId: task.id, columnId: v, optimisticRank: task.rank })}
                options={columnOptions}
                disabled={!can('task.move')}
              />
            </Field>
            <Field label={t('task.priority')}>
              <PrioritySelect value={task.priority} onChange={(v) => saveField({ priority: v ?? 'none' })} disabled={!editable} size="sm" />
            </Field>
            <Field label={t('task.assignees')} className="col-span-2">
              <UserMultiSelect
                users={users}
                value={task.assigneeUserIds}
                onChange={(v) => saveField({ assigneeUserIds: v })}
                disabled={!editable}
              />
            </Field>
            <Field label={t('task.labels')} className="col-span-2">
              <div className="flex flex-col gap-2">
                {task.labelIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {task.labelIds.map((id) => {
                      const l = labelsById.get(id);
                      if (!l) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-white"
                          style={{ backgroundColor: l.color }}
                        >
                          {l.name}
                          {editable && (
                            <button
                              onClick={() => saveField({ labelIds: task.labelIds.filter((x) => x !== id) })}
                              className="opacity-80 hover:opacity-100"
                              aria-label={t('common.remove')}
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
                <MultiSelect
                  value={task.labelIds}
                  onChange={(v) => saveField({ labelIds: v })}
                  options={labelOptions}
                  disabled={!editable}
                  placeholder={t('task.labels')}
                />
              </div>
            </Field>
            <Field label={t('task.due')}>
              <DatePicker
                size="sm"
                disabled={!editable}
                value={task.dueDate ? task.dueDate.slice(0, 10) : null}
                onChange={(v) => saveField({ dueDate: v ? new Date(v).toISOString() : null })}
              />
            </Field>
            <Field label={t('task.estimate')}>
              <NumberInput
                size="sm"
                min={0}
                step={0.5}
                precision={2}
                disabled={!editable}
                value={task.estimateHours ?? null}
                onChange={(v) => saveField({ estimateHours: v })}
              />
            </Field>
          </div>

          {/* description */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('task.description')}</h3>
            <RichTextEditor
              value={task.description}
              editable={editable}
              onBlur={(html) => html !== task.description && saveField({ description: html })}
              placeholder={t('task.descriptionPlaceholder')}
              minHeight={100}
              onImageUpload={async (file) => {
                try {
                  const a = await uploadImage.mutateAsync(file);
                  return a.url;
                } catch (e) {
                  toast.error(errorText(e, t));
                  throw e;
                }
              }}
            />
          </div>

          <SubtasksPanel task={task} boardId={boardId} usersById={usersById} onOpenTask={onOpenTask} />
          <DependenciesPanel task={task} />
          <TaskTimePanel task={task} usersById={usersById} />
          <ChecklistsPanel task={task} boardId={boardId} />
          <AttachmentsPanel task={task} />
          <CommentsPanel task={task} usersById={usersById} />
          <ActivityPanel task={task} usersById={usersById} />
        </div>
      )}
      <ScheduleImpactDialog
        workspaceId={workspaceId}
        rows={impactRows}
        onClose={() => setImpactRows(null)}
        onApplied={() => void taskQ.refetch()}
      />
    </Drawer>
  );
}
