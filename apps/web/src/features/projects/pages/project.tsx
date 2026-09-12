import { lazy, Suspense, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CircleDollarSign, Flag, GanttChartSquare, GitPullRequestArrow, LayoutGrid, ShieldAlert } from 'lucide-react';
import type { Permission } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useProject } from '@/features/projects/projects.api';
import { useProjectBoards } from '@/features/projects/boards.api';
import { Board } from '@/features/board/board';
import { ProjectAccessButton } from '@/features/projects/project-access';
import { ProjectColorDot } from '@/features/projects/project-color-dot';
import { TaskDrawer } from '@/features/tasks/task-drawer';
import { FullPageSpinner } from '@/components/layout/full-page-spinner';
import { ErrorState, Scrollable, Select, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';

// Non-board views are heavier (gantt/CPM, charts) and rarely the first thing a
// user opens — split each into its own chunk.
const Timeline = lazy(() => import('@/features/planning/timeline').then((m) => ({ default: m.Timeline })));
const CalendarView = lazy(() => import('@/features/planning/calendar-view').then((m) => ({ default: m.CalendarView })));
const MilestonesView = lazy(() => import('@/features/planning/milestones-view').then((m) => ({ default: m.MilestonesView })));
const FinanceView = lazy(() => import('@/features/finance/finance-view').then((m) => ({ default: m.FinanceView })));
const RaidView = lazy(() => import('@/features/governance/raid-view').then((m) => ({ default: m.RaidView })));
const ChangesView = lazy(() => import('@/features/governance/changes-view').then((m) => ({ default: m.ChangesView })));

type View = 'board' | 'timeline' | 'calendar' | 'milestones' | 'finance' | 'raid' | 'changes';
const VIEWS: Array<{ id: View; icon: typeof LayoutGrid; labelKey: string; permission?: Permission }> = [
  { id: 'board', icon: LayoutGrid, labelKey: 'view.board' },
  { id: 'timeline', icon: GanttChartSquare, labelKey: 'view.timeline' },
  { id: 'calendar', icon: CalendarDays, labelKey: 'view.calendar' },
  { id: 'milestones', icon: Flag, labelKey: 'view.milestones' },
  { id: 'finance', icon: CircleDollarSign, labelKey: 'view.finance', permission: 'finance.read' },
  { id: 'raid', icon: ShieldAlert, labelKey: 'view.raid' },
  { id: 'changes', icon: GitPullRequestArrow, labelKey: 'view.changes' },
];

export function ProjectPage(): React.ReactElement {
  const { t } = useTranslation();
  const { projectId } = useParams();
  const { workspaceId, can } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const project = useProject(workspaceId, projectId);
  const boards = useProjectBoards(workspaceId, projectId);

  const view = (params.get('view') as View) || 'board';
  const activeBoardId = params.get('board') ?? project.data?.defaultBoardId ?? boards.data?.[0]?.id ?? null;
  const openTaskId = params.get('task');

  const boardOptions = useMemo(() => (boards.data ?? []).map((b) => ({ value: b.id, label: b.name })), [boards.data]);

  const patchParams = (mut: (p: URLSearchParams) => void): void => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        mut(next);
        return next;
      },
      { replace: true },
    );
  };
  const setTask = (id: string | null): void => patchParams((p) => (id ? p.set('task', id) : p.delete('task')));
  const setView = (v: View): void => patchParams((p) => (v === 'board' ? p.delete('view') : p.set('view', v)));

  if (project.isLoading) return <FullPageSpinner />;
  if (project.isError || !project.data) return <ErrorState title={t('errors.notFound')} />;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        <ProjectColorDot project={project.data} />
        <h1 className="text-base font-semibold text-text">{project.data.name}</h1>
        <span className="font-mono text-xs text-text-subtle">{project.data.key}</span>
        <ProjectAccessButton project={project.data} />

        <div className="ms-4 flex overflow-hidden rounded-lg border border-border">
          {VIEWS.filter((v) => !v.permission || can(v.permission)).map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium',
                view === v.id ? 'bg-primary-soft text-primary' : 'text-text-muted hover:bg-surface-sunken',
              )}
            >
              <v.icon className="size-3.5" />
              <span className="hidden sm:inline">{t(v.labelKey)}</span>
            </button>
          ))}
        </div>

        {view === 'board' && boardOptions.length > 1 && (
          <div className="ms-auto w-48">
            <Select
              size="sm"
              value={activeBoardId}
              onChange={(v) => v && patchParams((p) => p.set('board', v))}
              options={boardOptions}
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {view === 'board' && activeBoardId && <Board boardId={activeBoardId} projectId={project.data.id} onOpenTask={setTask} />}
        {view !== 'board' && (
          <Suspense fallback={<div className="flex h-full items-center justify-center"><Spinner className="size-6 text-text-muted" /></div>}>
            {view === 'timeline' && <Timeline projectId={project.data.id} onOpenTask={setTask} />}
            {view === 'calendar' && <CalendarView projectId={project.data.id} onOpenTask={setTask} />}
            {view === 'milestones' && <MilestonesView projectId={project.data.id} />}
            {view === 'finance' && (
              <Scrollable className="h-full">
                <FinanceView projectId={project.data.id} />
              </Scrollable>
            )}
            {view === 'raid' && (
              <Scrollable className="h-full">
                <RaidView projectId={project.data.id} />
              </Scrollable>
            )}
            {view === 'changes' && (
              <Scrollable className="h-full">
                <ChangesView projectId={project.data.id} />
              </Scrollable>
            )}
          </Suspense>
        )}
      </div>

      <TaskDrawer
        workspaceId={workspaceId}
        taskId={openTaskId}
        boardId={activeBoardId ?? undefined}
        onClose={() => setTask(null)}
        onOpenTask={setTask}
      />
    </div>
  );
}
