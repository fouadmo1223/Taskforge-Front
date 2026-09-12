import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { WidgetDef } from '@/features/dashboards/dashboards.api';

const PRIORITY_COLOR: Record<string, string> = {
  none: 'bg-text-subtle',
  low: 'bg-info',
  medium: 'bg-warning',
  high: 'bg-accent',
  urgent: 'bg-danger',
};

export function WidgetCard({
  widget,
  data,
  onRemove,
}: {
  widget: WidgetDef;
  data: unknown;
  onRemove?: () => void;
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text">{widget.title}</h3>
        {onRemove && (
          <button onClick={onRemove} className="rounded p-1 text-text-subtle hover:bg-surface-sunken hover:text-danger">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <WidgetBody source={widget.source} data={data} emptyLabel={t('dashboards.noData')} />
    </div>
  );
}

function WidgetBody({ source, data, emptyLabel }: { source: string; data: unknown; emptyLabel: string }): React.ReactElement {
  if (data == null) return <p className="text-sm text-text-subtle">{emptyLabel}</p>;

  if (source === 'task_count') {
    const v = (data as { value?: number }).value ?? 0;
    return <div className="text-3xl font-semibold text-text">{v.toLocaleString()}</div>;
  }

  if (source === 'priority_breakdown') {
    const rec = data as Record<string, number>;
    const total = Object.values(rec).reduce((a, b) => a + b, 0) || 1;
    return (
      <div className="space-y-1.5">
        {Object.entries(rec).map(([k, n]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-14 text-text-muted">{k}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <div className={cn('h-full', PRIORITY_COLOR[k] ?? 'bg-primary')} style={{ width: `${(n / total) * 100}%` }} />
            </div>
            <span className="w-6 text-end text-text-subtle">{n}</span>
          </div>
        ))}
      </div>
    );
  }

  if (source === 'throughput') {
    const rows = data as Array<{ weekStart: string; created: number; completed: number }>;
    const max = Math.max(1, ...rows.map((r) => Math.max(r.created, r.completed)));
    return (
      <div className="flex h-28 items-end gap-1.5">
        {rows.map((r) => (
          <div key={r.weekStart} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end justify-center gap-0.5" style={{ height: '100%' }}>
              <div className="w-1/2 rounded-t bg-primary/40" style={{ height: `${(r.created / max) * 100}%` }} />
              <div className="w-1/2 rounded-t bg-success" style={{ height: `${(r.completed / max) * 100}%` }} />
            </div>
            <span className="text-[9px] text-text-subtle">{r.weekStart.slice(5, 10)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (source === 'project_status') {
    const rows = data as Array<{ key: string; name: string; total: number; overdue: number; completionRatio: number }>;
    return (
      <div className="space-y-1.5 text-xs">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="w-12 font-mono text-text-subtle">{r.key}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full bg-primary" style={{ width: `${r.completionRatio * 100}%` }} />
            </div>
            <span className="text-text-subtle">{Math.round(r.completionRatio * 100)}%</span>
            {r.overdue > 0 && <span className="text-danger">{r.overdue}!</span>}
          </div>
        ))}
      </div>
    );
  }

  return <pre className="overflow-x-auto text-xs text-text-muted">{JSON.stringify(data, null, 2).slice(0, 400)}</pre>;
}
