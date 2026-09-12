import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, MoreHorizontal } from 'lucide-react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { STATUS_CATEGORIES, type StatusCategory, type UserSummary } from '@flowdesk/types';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Scrollable } from '@/components/ui/scrollable';
import { confirm, NumberInput } from '@/components/ui';
import { columnLabel } from './column-label';
import type { LabelView } from '@/features/labels/labels.api';
import type { ColumnView, TaskView } from './board.api';
import { TaskCard } from './task-card';
import { AddCard } from './add-card';

/** default accent per semantic bucket, used when a column has no explicit color */
const STATUS_COLOR: Record<StatusCategory, string> = {
  backlog: '#8a909d',
  todo: '#2563eb',
  in_progress: '#6366f1',
  blocked: '#dc2626',
  in_review: '#d97706',
  done: '#16a34a',
  cancelled: '#8a909d',
};

const PALETTE = ['#64748b', '#2563eb', '#6366f1', '#8b5cf6', '#db2777', '#dc2626', '#ea580c', '#d97706', '#16a34a', '#0d9488'];

export type ColumnPatch = { name?: string; statusCategory?: StatusCategory; color?: string | null; wipLimit?: number };

interface BoardColumnProps {
  column: ColumnView;
  tasks: TaskView[];
  usersById: Map<string, UserSummary>;
  labelsById: Map<string, LabelView>;
  canManageBoard: boolean;
  canCreateTask: boolean;
  activeTaskId: string | null;
  onOpenTask: (taskId: string) => void;
  onAddCard: (columnId: string, title: string) => Promise<void>;
  onRename: (columnId: string, name: string) => void;
  onUpdate: (columnId: string, patch: ColumnPatch) => void;
  onDelete: (columnId: string) => void;
  addPending: boolean;
}

export function BoardColumn({
  column,
  tasks,
  usersById,
  labelsById,
  canManageBoard,
  canCreateTask,
  activeTaskId,
  onOpenTask,
  onAddCard,
  onRename,
  onUpdate,
  onDelete,
  addPending,
}: BoardColumnProps): React.ReactElement {
  const { t } = useTranslation();
  const sortable = useSortable({ id: column.id, data: { type: 'column' } });
  const { setNodeRef: setColRef, transform, transition, attributes, listeners, isDragging } = sortable;
  const { setNodeRef: setDropRef } = useDroppable({ id: `col-drop-${column.id}`, data: { type: 'column', columnId: column.id } });
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  const overLimit = column.wipLimit > 0 && tasks.length > column.wipLimit;
  const accent = column.color ?? STATUS_COLOR[column.statusCategory];

  return (
    <div
      ref={setColRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('flex h-full w-72 shrink-0 flex-col rounded-2xl bg-surface-sunken/60', isDragging && 'opacity-50')}
    >
      <div
        className="rounded-t-2xl border-t-2"
        style={{ borderTopColor: accent }}
      >
        <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-2.5">
          {canManageBoard && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab text-text-subtle hover:text-text active:cursor-grabbing"
              aria-label={t('board.dragColumn')}
            >
              <GripVertical className="size-3.5" />
            </button>
          )}
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                setRenaming(false);
                if (name.trim() && name !== column.name) onRename(column.id, name.trim());
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  setName(column.name);
                  setRenaming(false);
                }
              }}
              className="min-w-0 flex-1 rounded bg-surface px-1 text-sm font-semibold text-text outline-none ring-1 ring-primary"
            />
          ) : (
            <button
              onClick={() => canManageBoard && setRenaming(true)}
              className="min-w-0 flex-1 truncate text-start text-sm font-semibold text-text"
            >
              {columnLabel(column.name, t)}
            </button>
          )}
          <span className={cn('rounded-md px-1.5 text-xs font-medium', overLimit ? 'bg-danger-soft text-danger' : 'text-text-subtle')}>
            {tasks.length}
            {column.wipLimit > 0 && `/${column.wipLimit}`}
          </span>
          {canManageBoard && (
            <Dropdown.Root>
              <Dropdown.Trigger className="rounded p-1 text-text-subtle hover:bg-surface hover:text-text">
                <MoreHorizontal className="size-3.5" />
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content
                  align="end"
                  sideOffset={4}
                  className="z-40 w-56 rounded-xl border border-border bg-surface-elevated p-2 shadow-pop"
                >
                  <Dropdown.Item
                    onSelect={() => setRenaming(true)}
                    className="cursor-pointer rounded-lg px-2 py-1.5 text-sm text-text outline-none data-[highlighted]:bg-surface-sunken"
                  >
                    {t('column.rename')}
                  </Dropdown.Item>

                  <div className="my-1.5 border-t border-border" />

                  <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-text-subtle">{t('column.color')}</p>
                  <div className="flex flex-wrap gap-1.5 px-2 pb-1.5">
                    <button
                      onClick={() => onUpdate(column.id, { color: null })}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full border border-border text-[10px] text-text-subtle',
                        !column.color && 'ring-2 ring-primary ring-offset-1 ring-offset-surface-elevated',
                      )}
                      title={t('column.autoColor')}
                    >
                      A
                    </button>
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => onUpdate(column.id, { color: c })}
                        className={cn(
                          'flex size-6 items-center justify-center rounded-full',
                          column.color?.toLowerCase() === c && 'ring-2 ring-primary ring-offset-1 ring-offset-surface-elevated',
                        )}
                        style={{ backgroundColor: c }}
                      >
                        {column.color?.toLowerCase() === c && <Check className="size-3 text-white" />}
                      </button>
                    ))}
                  </div>

                  <div className="my-1.5 border-t border-border" />

                  <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-text-subtle">{t('column.status')}</p>
                  {STATUS_CATEGORIES.map((sc) => (
                    <Dropdown.Item
                      key={sc}
                      onSelect={() => onUpdate(column.id, { statusCategory: sc })}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text outline-none data-[highlighted]:bg-surface-sunken"
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[sc] }} />
                      {t(`statusCategory.${sc}`)}
                      {column.statusCategory === sc && <Check className="ms-auto size-3.5 text-primary" />}
                    </Dropdown.Item>
                  ))}

                  <div className="my-1.5 border-t border-border" />

                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <span className="flex-1 text-sm text-text">{t('column.wipLimit')}</span>
                    <div className="w-24" onKeyDown={(e) => e.stopPropagation()}>
                      <NumberInput
                        size="sm"
                        min={0}
                        step={1}
                        precision={0}
                        aria-label={t('column.wipLimit')}
                        value={column.wipLimit || null}
                        onChange={(v) => {
                          const n = v ?? 0;
                          if (n !== column.wipLimit) onUpdate(column.id, { wipLimit: n });
                        }}
                      />
                    </div>
                  </div>

                  <div className="my-1.5 border-t border-border" />

                  <Dropdown.Item
                    onSelect={async () => {
                      const ok = await confirm({ title: t('board.deleteColumn'), body: column.name, tone: 'danger', confirmLabel: t('common.delete') });
                      if (ok) onDelete(column.id);
                    }}
                    className="cursor-pointer rounded-lg px-2 py-1.5 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
                  >
                    {t('common.delete')}
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          )}
        </div>
      </div>

      <Scrollable ref={setDropRef} className="flex-1 px-2 pb-2">
        <SortableContext items={tasks.map((tk) => tk.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 py-1">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                usersById={usersById}
                labelsById={labelsById}
                onOpen={onOpenTask}
                dragging={task.id === activeTaskId}
              />
            ))}
            {tasks.length === 0 && (
              <p className="rounded-lg border border-dashed border-border px-2 py-6 text-center text-xs text-text-subtle">
                {t('board.emptyColumn')}
              </p>
            )}
          </div>
        </SortableContext>
        {canCreateTask && <div className="pt-1"><AddCard onAdd={(title) => onAddCard(column.id, title)} pending={addPending} /></div>}
      </Scrollable>
    </div>
  );
}
