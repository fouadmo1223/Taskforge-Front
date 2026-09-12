import { useMemo, useRef, useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { useTranslation } from 'react-i18next';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Check, MoreHorizontal, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { UserSummary } from '@flowdesk/types';
import { cn } from '@/lib/cn';
import { Avatar, Button, Spinner, confirm, lightbox, toast } from '@/components/ui';
import { RelativeTime } from '@/components/ui/bits';
import { RichTextEditor, RichTextView } from '@/components/ui/rich-text';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useAuth } from '@/features/auth/auth.store';
import { PersonCard } from '@/features/chat/person-card';
import type { TaskView } from '@/features/board/board.api';
import {
  useAddComment,
  useChecklistOps,
  useCreateSubtask,
  useDeleteAttachment,
  useDeleteComment,
  useEditComment,
  useSetTaskComplete,
  useSubtree,
  useTaskActivity,
  useTaskAttachments,
  useTaskComments,
  useUploadAttachment,
} from './tasks.api';

// ── Subtasks ───────────────────────────────────────────────────────────────
export function SubtasksPanel({
  task,
  boardId,
  usersById,
  onOpenTask,
}: {
  task: TaskView;
  boardId?: string;
  usersById: Map<string, UserSummary>;
  onOpenTask: (id: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const subtree = useSubtree(workspaceId, task.id);
  const create = useCreateSubtask(workspaceId, task.id, task.projectId);
  const complete = useSetTaskComplete(workspaceId, task.id, boardId);
  const [title, setTitle] = useState('');
  const children = (subtree.data ?? []).filter((s) => s.id !== task.id);
  const done = children.filter((c) => c.completedAt).length;
  const pct = children.length ? Math.round((done / children.length) * 100) : 0;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t('task.subtasks')} {children.length > 0 && <span className="text-text-subtle">{done}/{children.length}</span>}
        </h3>
        {children.length > 0 && <span className="text-xs font-medium text-text-subtle">{pct}%</span>}
      </div>
      {children.length > 0 && (
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-success' : 'bg-primary')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div className="flex flex-col gap-1">
        {children.map((child) => (
          <div key={child.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-sunken">
            <button
              disabled={!can('task.update') || complete.isPending}
              onClick={() => can('task.update') && complete.mutate({ taskId: child.id, completed: !child.completedAt })}
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                child.completedAt ? 'border-success bg-success text-white' : 'border-border-strong hover:border-success',
              )}
              aria-label={t('task.toggleComplete')}
            >
              {child.completedAt && <Check className="size-3" />}
            </button>
            <button
              onClick={() => onOpenTask(child.id)}
              className={cn(
                'min-w-0 flex-1 truncate text-start text-sm hover:underline',
                child.completedAt ? 'text-text-subtle line-through' : 'text-text',
              )}
            >
              <span className="me-1.5 font-mono text-[11px] text-text-subtle">{child.key}</span>
              {child.title}
            </button>
            {child.assigneeUserIds[0] &&
              (usersById.get(child.assigneeUserIds[0]) ? (
                <PersonCard
                  user={usersById.get(child.assigneeUserIds[0])!}
                  trigger={
                    <button onClick={(e) => e.stopPropagation()} className="shrink-0 rounded-full">
                      <Avatar name={usersById.get(child.assigneeUserIds[0])!.name} src={usersById.get(child.assigneeUserIds[0])!.avatar} size="xs" />
                    </button>
                  }
                />
              ) : (
                <Avatar name="?" size="xs" />
              ))}
          </div>
        ))}
      </div>
      {can('task.create') && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            await create.mutateAsync(title.trim()).catch(() => toast.error(t('errors.generic')));
            setTitle('');
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('task.addSubtask')}
            className="h-8 flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus:border-primary"
          />
          <Button size="sm" type="submit" loading={create.isPending} disabled={!title.trim()}>
            <Plus className="size-3.5" />
          </Button>
        </form>
      )}
    </section>
  );
}

// ── Checklists ─────────────────────────────────────────────────────────────
export function ChecklistsPanel({ task, boardId }: { task: TaskView; boardId?: string }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const ops = useChecklistOps(workspaceId, task.id, boardId);
  const editable = can('task.update');
  const [newTitle, setNewTitle] = useState('');
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [hideChecked, setHideChecked] = useState<Record<string, boolean>>({});

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('task.checklists')}</h3>
      <div className="flex flex-col gap-4">
        {task.checklists.map((cl) => {
          const done = cl.items.filter((i) => i.done).length;
          const pct = cl.items.length ? Math.round((done / cl.items.length) * 100) : 0;
          const isHidingChecked = Boolean(hideChecked[cl.id]);
          const visibleItems = isHidingChecked ? cl.items.filter((i) => !i.done) : cl.items;
          return (
            <div key={cl.id}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text">{cl.title}</span>
                {editable && (
                  <button
                    onClick={() => ops.removeChecklist.mutate(cl.id)}
                    className="rounded-md px-2 py-1 text-xs text-text-subtle hover:bg-danger-soft hover:text-danger"
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-xs font-medium text-text-subtle">{pct}%</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-success' : 'bg-primary')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              {cl.items.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1">
                  <button
                    onClick={() => setHideChecked((h) => ({ ...h, [cl.id]: !isHidingChecked }))}
                    className="rounded-md px-2 py-1 text-xs font-medium text-text-subtle hover:bg-surface-sunken hover:text-text"
                  >
                    {isHidingChecked ? t('task.showCheckedItems') : t('task.hideCheckedItems')}
                  </button>
                </div>
              )}
              <ul className="mt-1 flex flex-col gap-0.5">
                {visibleItems.map((it) => (
                  <li key={it.id} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-surface-sunken">
                    <button
                      disabled={!editable}
                      onClick={() => ops.toggleItem.mutate({ checklistId: cl.id, itemId: it.id, done: !it.done })}
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border',
                        it.done ? 'border-success bg-success text-white' : 'border-border-strong',
                      )}
                    >
                      {it.done && <Check className="size-3" />}
                    </button>
                    <span className={cn('flex-1 text-sm', it.done && 'text-text-subtle line-through')}>{it.text}</span>
                    {editable && (
                      <button
                        onClick={() => ops.removeItem.mutate({ checklistId: cl.id, itemId: it.id })}
                        className="text-text-subtle opacity-0 hover:text-danger group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {editable &&
                (addingTo === cl.id ? (
                  <form
                    className="mt-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = (itemDrafts[cl.id] ?? '').trim();
                      if (!v) return;
                      ops.addItem.mutate({ checklistId: cl.id, text: v });
                      setItemDrafts((d) => ({ ...d, [cl.id]: '' }));
                    }}
                  >
                    <input
                      autoFocus
                      value={itemDrafts[cl.id] ?? ''}
                      onChange={(e) => setItemDrafts((d) => ({ ...d, [cl.id]: e.target.value }))}
                      onBlur={() => {
                        if (!(itemDrafts[cl.id] ?? '').trim()) setAddingTo(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setAddingTo(null);
                      }}
                      placeholder={t('task.addItem')}
                      className="h-7 w-full rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary"
                    />
                  </form>
                ) : (
                  <button
                    onClick={() => setAddingTo(cl.id)}
                    className="mt-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-subtle hover:bg-surface-sunken hover:text-text"
                  >
                    {t('task.addItem')}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
      {editable && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTitle.trim()) return;
            ops.addChecklist.mutate(newTitle.trim());
            setNewTitle('');
          }}
        >
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t('task.addChecklist')}
            className="h-8 flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus:border-primary"
          />
          <Button size="sm" type="submit" variant="secondary" disabled={!newTitle.trim()}>
            <Plus className="size-3.5" />
          </Button>
        </form>
      )}
    </section>
  );
}

// ── Comments ───────────────────────────────────────────────────────────────
export function CommentsPanel({
  task,
  usersById,
}: {
  task: TaskView;
  usersById: Map<string, UserSummary>;
}): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can, isOwner } = useWorkspace();
  const myId = useAuth((s) => s.user?.id);
  const comments = useTaskComments(workspaceId, task.id);
  const add = useAddComment(workspaceId, task.id);
  const edit = useEditComment(workspaceId, task.id);
  const del = useDeleteComment(workspaceId, task.id);
  const uploadImage = useUploadAttachment(workspaceId, task.id);
  const [body, setBody] = useState('<p></p>');
  const [external, setExternal] = useState(false);
  const canExternal = can('comment.external');
  const canModerate = isOwner || can('comment.moderate');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('<p></p>');

  const submit = async (): Promise<void> => {
    if (!body.trim() || body === '<p></p>') return;
    await add
      .mutateAsync({ bodyHtml: body, visibility: external ? 'external' : 'internal' })
      .catch(() => toast.error(t('errors.generic')));
    setBody('<p></p>');
  };

  const startEdit = (c: { id: string; bodyHtml: string }): void => {
    setEditingId(c.id);
    setEditBody(c.bodyHtml);
  };

  const saveEdit = async (): Promise<void> => {
    if (!editingId || !editBody.trim() || editBody === '<p></p>') return;
    const id = editingId;
    await edit.mutateAsync({ commentId: id, bodyHtml: editBody }).catch((e) => toast.error(errorText(e, t)));
    setEditingId(null);
  };

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {t('task.comments')} {(comments.data?.length ?? 0) > 0 && <span className="text-text-subtle">{comments.data!.length}</span>}
      </h3>
      <div className="flex flex-col gap-3">
        {comments.isLoading && <Spinner className="text-text-muted" />}
        {(comments.data ?? []).map((c) => {
          const author = usersById.get(c.authorUserId);
          const mine = c.authorUserId === myId;
          const editingThis = editingId === c.id;
          return (
            <div key={c.id} className="group flex gap-2.5">
              {author ? (
                <PersonCard
                  user={author}
                  trigger={
                    <button className="shrink-0 rounded-full">
                      <Avatar name={author.name} src={author.avatar} size="sm" />
                    </button>
                  }
                />
              ) : (
                <Avatar name="?" size="sm" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-text">{author?.name ?? 'Someone'}</span>
                  <span className="text-text-subtle">
                    <RelativeTime value={c.createdAt} />
                    {c.edited && ` · ${t('task.edited')}`}
                  </span>
                  {c.visibility === 'external' && (
                    <span className="rounded bg-warning-soft px-1 text-[10px] font-medium text-warning">{t('task.clientVisible')}</span>
                  )}
                  {(mine || canModerate) && !editingThis && (
                    <Dropdown.Root>
                      <Dropdown.Trigger className="ms-auto rounded p-1 text-text-subtle opacity-0 hover:bg-surface-sunken hover:text-text group-hover:opacity-100">
                        <MoreHorizontal className="size-3.5" />
                      </Dropdown.Trigger>
                      <Dropdown.Portal>
                        <Dropdown.Content
                          align="end"
                          sideOffset={4}
                          className="z-[200] w-40 rounded-xl border border-border bg-surface-elevated p-1.5 shadow-pop"
                        >
                          {mine && (
                            <Dropdown.Item
                              onSelect={() => startEdit(c)}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-text outline-none data-[highlighted]:bg-surface-sunken"
                            >
                              <Pencil className="size-3.5 text-text-subtle" />
                              {t('common.edit')}
                            </Dropdown.Item>
                          )}
                          <Dropdown.Item
                            onSelect={async () => {
                              if (await confirm({ title: t('common.delete'), tone: 'danger', confirmLabel: t('common.delete') })) del.mutate(c.id);
                            }}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
                          >
                            <Trash2 className="size-3.5" />
                            {t('common.delete')}
                          </Dropdown.Item>
                        </Dropdown.Content>
                      </Dropdown.Portal>
                    </Dropdown.Root>
                  )}
                </div>
                {editingThis ? (
                  <div className="mt-1">
                    <RichTextEditor
                      value={editBody}
                      onChange={setEditBody}
                      minHeight={50}
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
                    <div className="mt-1.5 flex items-center gap-2">
                      <Button size="sm" onClick={() => void saveEdit()} loading={edit.isPending}>
                        {t('common.save')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-0.5 rounded-lg bg-surface-sunken px-3 py-2">
                    <RichTextView html={c.bodyHtml} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {can('comment.create') && (
        <div className="mt-3">
          <RichTextEditor
            value={body}
            onChange={setBody}
            placeholder={t('task.writeComment')}
            minHeight={60}
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
          <div className="mt-2 flex items-center gap-3">
            <Button size="sm" onClick={() => void submit()} loading={add.isPending}>
              {t('task.comment')}
            </Button>
            {canExternal && (
              <label className="flex items-center gap-1.5 text-xs text-text-muted">
                <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} className="size-3.5 rounded border-border" />
                {t('task.postClientVisible')}
              </label>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Attachments ────────────────────────────────────────────────────────────
export function AttachmentsPanel({ task }: { task: TaskView }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const attachments = useTaskAttachments(workspaceId, task.id);
  const upload = useUploadAttachment(workspaceId, task.id);
  const del = useDeleteAttachment(workspaceId, task.id);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('task.attachments')}</h3>
        {can('task.update') && (
          <>
            <input
              ref={inputRef}
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file, { onError: (err) => toast.error(errorText(err, t)) });
                e.target.value = '';
              }}
            />
            <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()} loading={upload.isPending}>
              <Paperclip className="size-3.5" />
              {t('task.upload')}
            </Button>
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(attachments.data ?? []).map((a) => (
          <div key={a.id} className="group relative overflow-hidden rounded-lg border border-border">
            {a.resourceType === 'image' ? (
              <button onClick={() => lightbox.open(a.url)} className="block w-full cursor-zoom-in">
                <img src={a.url} alt={a.name} className="h-24 w-full object-cover" />
              </button>
            ) : (
              <a href={a.url} target="_blank" rel="noreferrer" className="flex h-24 items-center justify-center bg-surface-sunken text-xs text-text-muted">
                {a.format.toUpperCase()}
              </a>
            )}
            <div className="flex items-center justify-between gap-1 px-2 py-1 text-[11px]">
              <span className="truncate text-text-muted">{a.name}</span>
              {can('task.update') && (
                <button onClick={() => del.mutate(a.id)} className="text-text-subtle hover:text-danger">
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>
        ))}
        {(attachments.data?.length ?? 0) === 0 && <p className="col-span-2 text-sm text-text-subtle">{t('task.noAttachments')}</p>}
      </div>
    </section>
  );
}

// ── Activity ───────────────────────────────────────────────────────────────
export function ActivityPanel({ task, usersById }: { task: TaskView; usersById: Map<string, UserSummary> }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId } = useWorkspace();
  const activity = useTaskActivity(workspaceId, task.id);
  const items = activity.data?.items ?? [];

  const label = useMemo(
    () => ({
      'task.created': t('activity.created'),
      'subtask.created': t('activity.subtaskCreated'),
      'task.updated': t('activity.updated'),
      'task.moved': t('activity.moved'),
      'comment.added': t('activity.commented'),
      'task.deleted': t('activity.deleted'),
    }) as Record<string, string>,
    [t],
  );

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('task.activity')}</h3>
      <ol className="flex flex-col gap-2.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-start gap-2.5 text-sm">
            {it.actor && usersById.get(it.actor.id) ? (
              <PersonCard
                user={usersById.get(it.actor.id)!}
                trigger={
                  <button className="shrink-0 rounded-full">
                    <Avatar name={usersById.get(it.actor.id)!.name} src={usersById.get(it.actor.id)!.avatar} size="xs" />
                  </button>
                }
              />
            ) : (
              <Avatar name={it.actor?.name ?? '?'} size="xs" />
            )}
            <p className="text-text-muted">
              <span className="font-medium text-text">{it.actor?.name ?? 'Someone'}</span>{' '}
              {label[it.verb] ?? it.verb.replace('.', ' ')}
              <span className="ms-1.5 text-xs text-text-subtle">
                <RelativeTime value={it.createdAt} />
              </span>
            </p>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-text-subtle">{t('task.noActivity')}</li>}
      </ol>
    </section>
  );
}
