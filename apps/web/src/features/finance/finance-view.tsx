import { useState } from 'react';
import { feedback } from '@/lib/api/mutation-feedback';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Check, Pencil, Plus, Receipt, Trash2, X } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { Badge, Button, Dialog, EmptyState, Field, Input, Skeleton, Textarea, DatePicker } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  useBudget,
  useCreateExpense,
  useDeleteExpense,
  useExpenseAction,
  useExpenses,
  useFinanceSummary,
  useSetBudget,
  type ExpenseView,
} from '@/features/finance/finance.api';

const STATUS_TONE: Record<ExpenseView['status'], 'neutral' | 'warning' | 'success' | 'danger' | 'primary'> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
  reimbursed: 'primary',
};

export function FinanceView({ projectId }: { projectId: string }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const summary = useFinanceSummary(workspaceId, projectId);
  const budget = useBudget(workspaceId, projectId);
  const expenses = useExpenses(workspaceId, projectId);
  const setBudget = useSetBudget(workspaceId, projectId);
  const createExpense = useCreateExpense(workspaceId, projectId);
  const action = useExpenseAction(workspaceId, projectId);
  const del = useDeleteExpense(workspaceId, projectId);
  const manage = can('finance.manage');

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState({ amount: '', currency: 'USD', notes: '' });
  const [addingExpense, setAddingExpense] = useState(false);
  const [exp, setExp] = useState({ description: '', amount: '', category: '', spentAt: format(new Date(), 'yyyy-MM-dd'), billable: false });

  const fmt = (n: number): string => `${summary.data?.currency ?? 'USD'} ${n.toLocaleString()}`;

  const s = summary.data;
  const pctSpent = s && s.budget > 0 ? Math.min(100, (s.spent / s.budget) * 100) : 0;
  const pctCommitted = s && s.budget > 0 ? Math.min(100 - pctSpent, (s.committed / s.budget) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-6">
      {/* summary */}
      {summary.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : s ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">{t('finance.summary')}</h2>
            {manage && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setBudgetDraft({
                    amount: String(budget.data?.amount ?? ''),
                    currency: budget.data?.currency ?? 'USD',
                    notes: budget.data?.notes ?? '',
                  });
                  setEditingBudget(true);
                }}
              >
                <Pencil className="size-3.5" />
                {t('finance.editBudget')}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t('finance.budget')} value={fmt(s.budget)} />
            <Stat label={t('finance.spent')} value={fmt(s.spent)} />
            <Stat label={t('finance.committed')} value={fmt(s.committed)} />
            <Stat label={t('finance.remaining')} value={fmt(s.remaining)} tone={s.remaining < 0 ? 'danger' : undefined} />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunken">
            <div className="flex h-full">
              <div className="h-full bg-primary" style={{ width: `${pctSpent}%` }} />
              <div className="h-full bg-warning/60" style={{ width: `${pctCommitted}%` }} />
            </div>
          </div>
          {s.billable > 0 && (
            <p className="mt-2 text-xs text-text-subtle">{t('finance.billableTotal')}: {fmt(s.billable)}</p>
          )}
          {s.byCategory.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {s.byCategory.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 truncate text-text-muted">{c.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={cn('h-full', c.budget > 0 && c.spent > c.budget ? 'bg-danger' : 'bg-primary')}
                      style={{ width: `${c.budget > 0 ? Math.min(100, (c.spent / c.budget) * 100) : c.spent > 0 ? 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-32 shrink-0 text-end text-text-subtle">
                    {fmt(c.spent)} / {fmt(c.budget)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* expenses */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('finance.expenses')}</h2>
          <Button size="sm" onClick={() => setAddingExpense(true)}>
            <Plus className="size-3.5" />
            {t('finance.addExpense')}
          </Button>
        </div>
        {expenses.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (expenses.data?.length ?? 0) === 0 ? (
          <EmptyState title={t('finance.noExpenses')} />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {expenses.data!.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface px-4 py-2.5 text-sm">
                <Badge tone={STATUS_TONE[e.status]}>{t(`finance.status.${e.status}`)}</Badge>
                <span className="font-medium text-text">{e.description}</span>
                {e.category && <span className="text-xs text-text-subtle">{e.category}</span>}
                {e.billable && <span className="text-xs text-primary">{t('finance.billable')}</span>}
                <span className="text-xs text-text-subtle">{format(new Date(e.spentAt), 'MMM d, yyyy')}</span>
                {e.receiptUrl && (
                  <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="text-text-muted hover:text-primary">
                    <Receipt className="size-3.5" />
                  </a>
                )}
                <span className="ms-auto font-medium text-text">{e.currency} {e.amount.toLocaleString()}</span>
                <div className="flex items-center gap-1">
                  {e.status === 'draft' && (
                    <Button size="sm" variant="secondary" onClick={() => action.mutate({ id: e.id, action: 'submit' }, feedback(t, { success: t('common.updated') }))}>
                      {t('finance.submit')}
                    </Button>
                  )}
                  {e.status === 'submitted' && manage && (
                    <>
                      <button
                        onClick={() => action.mutate({ id: e.id, action: 'review', decision: 'approve' }, feedback(t, { success: t('common.updated') }))}
                        className="rounded-lg p-1.5 text-success hover:bg-surface-sunken"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        onClick={() => action.mutate({ id: e.id, action: 'review', decision: 'reject' }, feedback(t, { success: t('common.updated') }))}
                        className="rounded-lg p-1.5 text-danger hover:bg-surface-sunken"
                      >
                        <X className="size-3.5" />
                      </button>
                    </>
                  )}
                  {e.status === 'approved' && manage && (
                    <Button size="sm" variant="ghost" onClick={() => action.mutate({ id: e.id, action: 'review', decision: 'reimburse' }, feedback(t, { success: t('common.updated') }))}>
                      {t('finance.markReimbursed')}
                    </Button>
                  )}
                  {(e.status === 'draft' || e.status === 'rejected') && (
                    <button onClick={() => del.mutate(e.id, feedback(t, { success: t('common.deleted') }))} className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                {e.reviewNote && <p className="w-full text-xs text-text-subtle">“{e.reviewNote}”</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={editingBudget}
        onOpenChange={setEditingBudget}
        title={t('finance.editBudget')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingBudget(false)}>{t('common.cancel')}</Button>
            <Button
              loading={setBudget.isPending}
              onClick={() =>
                setBudget.mutate(
                  { amount: Number(budgetDraft.amount) || 0, currency: budgetDraft.currency.toUpperCase(), notes: budgetDraft.notes },
                  {
                    onError: feedback(t).onError,
                    onSuccess: () => {
                      feedback(t, { success: t('common.saved') }).onSuccess();
                      setEditingBudget(false);
                    },
                  },
                )
              }
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-3">
          <Field label={t('finance.budget')} className="sm:col-span-2">
            <Input type="number" value={budgetDraft.amount} onChange={(e) => setBudgetDraft({ ...budgetDraft, amount: e.target.value })} />
          </Field>
          <Field label={t('finance.currency')}>
            <Input maxLength={3} className="uppercase" value={budgetDraft.currency} onChange={(e) => setBudgetDraft({ ...budgetDraft, currency: e.target.value })} />
          </Field>
          <Field label={t('finance.notes')} className="sm:col-span-3">
            <Textarea rows={2} value={budgetDraft.notes} onChange={(e) => setBudgetDraft({ ...budgetDraft, notes: e.target.value })} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={addingExpense}
        onOpenChange={setAddingExpense}
        title={t('finance.addExpense')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddingExpense(false)}>{t('common.cancel')}</Button>
            <Button
              loading={createExpense.isPending}
              disabled={!exp.description.trim() || !(Number(exp.amount) > 0)}
              onClick={() =>
                createExpense.mutate(
                  {
                    description: exp.description.trim(),
                    amount: Number(exp.amount),
                    category: exp.category.trim() || undefined,
                    spentAt: exp.spentAt,
                    billable: exp.billable,
                  },
                  {
                    onError: feedback(t).onError,
                    onSuccess: () => {
                      feedback(t, { success: t('common.created') }).onSuccess();
                      setAddingExpense(false);
                      setExp({ description: '', amount: '', category: '', spentAt: format(new Date(), 'yyyy-MM-dd'), billable: false });
                    },
                  },
                )
              }
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2">
          <Field label={t('finance.description')} className="sm:col-span-2">
            <Input autoFocus value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} />
          </Field>
          <Field label={t('finance.amount')}>
            <Input type="number" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} />
          </Field>
          <Field label={t('finance.category')}>
            <Input value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })} />
          </Field>
          <Field label={t('finance.spentAt')}>
            <DatePicker value={exp.spentAt} onChange={(v) => setExp({ ...exp, spentAt: v ?? '' })} clearable={false} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-text">
            <input type="checkbox" checked={exp.billable} onChange={(e) => setExp({ ...exp, billable: e.target.checked })} className="size-4 rounded border-border" />
            {t('finance.billable')}
          </label>
        </div>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' }): React.ReactElement {
  return (
    <div>
      <div className={cn('text-lg font-semibold', tone === 'danger' ? 'text-danger' : 'text-text')}>{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}
