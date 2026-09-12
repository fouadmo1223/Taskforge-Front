import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TimerState, TimesheetStatus, WorkloadBand } from '@flowdesk/types';
import { api } from '@/lib/api/client';

export interface TimerView {
  id: string;
  taskId: string;
  projectId: string;
  description: string;
  state: TimerState;
  startedAt: string;
  elapsedSeconds: number;
}
export interface TimeEntryView {
  id: string;
  taskId: string;
  projectId: string;
  userId: string;
  description: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  source: 'timer' | 'manual';
  locked: boolean;
}

const timerKey = (w: string) => ['timer', w];

export function useCurrentTimer(workspaceId: string) {
  return useQuery({
    queryKey: timerKey(workspaceId),
    queryFn: () => api.get<TimerView | null>(`/workspaces/${workspaceId}/timer`),
    refetchInterval: 60_000,
    staleTime: 5_000,
  });
}

export function useTimerActions(workspaceId: string) {
  const qc = useQueryClient();
  const set = (data: TimerView | null): void => {
    qc.setQueryData(timerKey(workspaceId), data);
  };
  const bust = (): void => {
    void qc.invalidateQueries({ queryKey: timerKey(workspaceId) });
  };
  return {
    start: useMutation({
      mutationFn: (v: { taskId: string; description?: string }) =>
        api.post<TimerView>(`/workspaces/${workspaceId}/timer/start`, v),
      onSuccess: set,
    }),
    pause: useMutation({ mutationFn: () => api.post<TimerView>(`/workspaces/${workspaceId}/timer/pause`), onSuccess: set }),
    resume: useMutation({ mutationFn: () => api.post<TimerView>(`/workspaces/${workspaceId}/timer/resume`), onSuccess: set }),
    stop: useMutation({
      mutationFn: () => api.post<TimeEntryView>(`/workspaces/${workspaceId}/timer/stop`),
      onSuccess: () => {
        set(null);
        bust();
      },
    }),
  };
}

export function useTaskTimeEntries(workspaceId: string, taskId: string | null) {
  return useQuery({
    queryKey: ['time-entries', workspaceId, taskId],
    queryFn: () => api.get<TimeEntryView[]>(`/workspaces/${workspaceId}/time-entries`, { query: { taskId: taskId ?? '' } }),
    enabled: Boolean(taskId),
  });
}

export function useAddManualEntry(workspaceId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { startedAt: string; minutes: number; description?: string }) =>
      api.post<TimeEntryView>(`/workspaces/${workspaceId}/time-entries`, { taskId, ...v }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['time-entries', workspaceId, taskId] });
      void qc.invalidateQueries({ queryKey: ['task', workspaceId, taskId] });
    },
  });
}

export function useDeleteEntry(workspaceId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => api.delete(`/workspaces/${workspaceId}/time-entries/${entryId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['time-entries', workspaceId, taskId] });
      void qc.invalidateQueries({ queryKey: ['task', workspaceId, taskId] });
    },
  });
}

// ── timesheets ─────────────────────────────────────────────────────────────
export interface TimesheetWeek {
  periodStart: string;
  periodEnd: string;
  status: TimesheetStatus;
  totalSeconds: number;
  reviewNote: string | null;
  reviewedAt: string | null;
  rows: Array<{ taskId: string; taskKey: string; taskTitle: string; projectId: string; byDay: number[]; total: number }>;
}

export function useTimesheetWeek(workspaceId: string, periodStart: string) {
  return useQuery({
    queryKey: ['timesheet', workspaceId, periodStart],
    queryFn: () => api.get<TimesheetWeek>(`/workspaces/${workspaceId}/timesheets/week`, { query: { periodStart } }),
  });
}
export function useSubmitTimesheet(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodStart: string) => api.post(`/workspaces/${workspaceId}/timesheets/submit`, { periodStart }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheet', workspaceId] }),
  });
}
export function usePendingTimesheets(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['timesheets-pending', workspaceId],
    queryFn: () =>
      api.get<Array<{ id: string; userId: string; userName: string; periodStart: string; periodEnd: string; totalSeconds: number; submittedAt: string | null }>>(
        `/workspaces/${workspaceId}/timesheets/pending`,
      ),
    enabled,
  });
}
export function useReviewTimesheet(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { timesheetId: string; decision: 'approve' | 'reject'; note?: string }) =>
      api.post(`/workspaces/${workspaceId}/timesheets/${v.timesheetId}/review`, { decision: v.decision, note: v.note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets-pending', workspaceId] }),
  });
}

// ── availability + workload ────────────────────────────────────────────────
export interface AvailabilityView {
  userId: string;
  weeklyHours: number;
  workingDays: number[];
  hoursPerDay: number;
  timezone: string;
}
export interface WorkloadRow {
  userId: string;
  availableHours: number;
  plannedHours: number;
  unscheduledHours: number;
  band: WorkloadBand;
  ratio: number;
  byProject: Array<{ projectId: string; projectName: string; hours: number }>;
  tasks: Array<{ taskId: string; key: string; title: string; projectId: string; plannedHours: number; dueDate: string | null }>;
}

export function useMyAvailability(workspaceId: string) {
  return useQuery({
    queryKey: ['availability-me', workspaceId],
    queryFn: () => api.get<AvailabilityView>(`/workspaces/${workspaceId}/availability/me`),
  });
}
export function useUpdateMyAvailability(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AvailabilityView>) => api.patch<AvailabilityView>(`/workspaces/${workspaceId}/availability/me`, patch),
    onSuccess: (data) => qc.setQueryData(['availability-me', workspaceId], data),
  });
}
export function useWorkload(workspaceId: string, from: string, to: string, projectId?: string) {
  return useQuery({
    queryKey: ['workload', workspaceId, from, to, projectId ?? null],
    queryFn: () =>
      api.get<WorkloadRow[]>(`/workspaces/${workspaceId}/workload`, {
        query: { from, to, projectId },
      }),
  });
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h > 0 ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
