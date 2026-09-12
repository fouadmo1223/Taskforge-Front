import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckSquare, MessageSquare, Paperclip, GitBranch } from 'lucide-react';
import type { UserSummary } from '@flowdesk/types';
import { cn } from '@/lib/cn';
import { AvatarStack, DueDate, LabelChip, PriorityDot } from '@/components/ui/bits';
import type { LabelView } from '@/features/labels/labels.api';
import type { TaskView } from './board.api';

interface TaskCardProps {
  task: TaskView;
  usersById: Map<string, UserSummary>;
  labelsById: Map<string, LabelView>;
  onOpen: (taskId: string) => void;
  dragging?: boolean;
}

function checklistProgress(task: TaskView): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const c of task.checklists) {
    total += c.items.length;
    done += c.items.filter((i) => i.done).length;
  }
  return { done, total };
}

export const TaskCard = memo(function TaskCard({
  task,
  usersById,
  labelsById,
  onOpen,
  dragging,
}: TaskCardProps): React.ReactElement {
  const sortable = useSortable({ id: task.id, data: { type: 'card', task } });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const labels = task.labelIds.map((id) => labelsById.get(id)).filter(Boolean) as LabelView[];
  const cl = checklistProgress(task);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.defaultPrevented) {
          e.preventDefault();
          onOpen(task.id);
        }
      }}
      className={cn(
        'group cursor-pointer rounded-xl border border-border bg-surface p-3 text-start shadow-xs transition-shadow hover:shadow-sm',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        (isDragging || dragging) && 'opacity-40',
        task.completedAt && 'opacity-70',
      )}
    >
      {labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {labels.map((l) => (
            <LabelChip key={l.id} name={l.name} color={l.color} solid />
          ))}
        </div>
      )}
      <p className={cn('text-sm text-text', task.completedAt && 'line-through')}>{task.title}</p>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-text-subtle">
        <PriorityDot priority={task.priority} />
        <span className="font-mono">{task.key}</span>
        {task.dueDate && <DueDate value={task.dueDate} />}
        <div className="flex items-center gap-2">
          {cl.total > 0 && (
            <span className={cn('inline-flex items-center gap-0.5', cl.done === cl.total && 'text-success')}>
              <CheckSquare className="size-3" />
              {cl.done}/{cl.total}
            </span>
          )}
          {task.subtaskCount > 0 && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5',
                task.subtaskDoneCount >= task.subtaskCount && 'text-success',
              )}
            >
              <GitBranch className="size-3" />
              {task.subtaskDoneCount}/{task.subtaskCount}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <MessageSquare className="size-3" />
              {task.commentCount}
            </span>
          )}
          {task.attachmentCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Paperclip className="size-3" />
              {task.attachmentCount}
            </span>
          )}
        </div>
        <div className="ms-auto">
          <AvatarStack userIds={task.assigneeUserIds} byId={usersById} />
        </div>
      </div>
    </div>
  );
});
