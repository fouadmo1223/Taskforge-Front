import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DependencyType, MilestoneStatus, StatusCategory, TaskPriority } from '@flowdesk/types';
import { api } from '@/lib/api/client';

// ── My Work ────────────────────────────────────────────────────────────────
export interface MyWorkItem {
  id: string;
  key: string;
  title: string;
  projectId: string;
  projectName: string;
  projectKey: string;
  columnName: string;
  priority: TaskPriority;
  dueDate: string | null;
  startDate: string | null;
  completedAt: string | null;
  relation: 'assignee' | 'reporter' | 'follower';
}
export interface MyWorkResponse {
  items: MyWorkItem[];
  stats: { assigned: number; overdue: number; dueToday: number; completedLast7d: number };
}

export function useMyWork(workspaceId: string) {
  return useQuery({
    queryKey: ['my-work', workspaceId],
    queryFn: () => api.get<MyWorkResponse>(`/workspaces/${workspaceId}/my-work`),
    staleTime: 20_000,
  });
}

// ── Search ─────────────────────────────────────────────────────────────────
export interface SearchHit {
  type: 'task' | 'project' | 'comment';
  id: string;
  title: string;
  subtitle: string | null;
  projectId: string | null;
  taskId: string | null;
}
export function useSearch(workspaceId: string, q: string) {
  return useQuery({
    queryKey: ['search', workspaceId, q],
    queryFn: () => api.get<SearchHit[]>(`/workspaces/${workspaceId}/search`, { query: { q } }),
    enabled: q.trim().length >= 2,
    staleTime: 15_000,
  });
}

// ── Dependencies ───────────────────────────────────────────────────────────
export interface DependencyView {
  id: string;
  type: DependencyType;
  fromTaskId: string;
  toTaskId: string;
  createdAt: string;
}
export interface ScheduleImpactRow {
  taskId: string;
  key: string;
  title: string;
  currentStart: string | null;
  currentDue: string | null;
  proposedStart: string;
  proposedDue: string;
  shiftDays: number;
}

export function useTaskDependencies(workspaceId: string, taskId: string | null) {
  return useQuery({
    queryKey: ['dependencies', workspaceId, taskId],
    queryFn: () => api.get<DependencyView[]>(`/workspaces/${workspaceId}/tasks/${taskId}/dependencies`),
    enabled: Boolean(taskId),
  });
}

export function useAddDependency(workspaceId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { toTaskId: string; type: DependencyType }) =>
      api.post<DependencyView>(`/workspaces/${workspaceId}/tasks/${taskId}/dependencies`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dependencies', workspaceId, taskId] });
      void qc.invalidateQueries({ queryKey: ['timeline', workspaceId] });
    },
  });
}

export function useRemoveDependency(workspaceId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dependencyId: string) => api.delete(`/workspaces/${workspaceId}/dependencies/${dependencyId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dependencies', workspaceId, taskId] });
      void qc.invalidateQueries({ queryKey: ['timeline', workspaceId] });
    },
  });
}

export function scheduleImpact(workspaceId: string, taskId: string, newFinish: string) {
  return api.post<ScheduleImpactRow[]>(`/workspaces/${workspaceId}/tasks/${taskId}/schedule-impact`, { newFinish });
}
export function applyScheduleShift(
  workspaceId: string,
  shifts: Array<{ taskId: string; startDate: string; dueDate: string }>,
) {
  return api.post<{ updated: number }>(`/workspaces/${workspaceId}/tasks/apply-schedule-shift`, { shifts });
}

// ── Milestones ─────────────────────────────────────────────────────────────
export interface MilestoneView {
  id: string;
  projectId: string;
  name: string;
  description: string;
  ownerUserId: string | null;
  date: string;
  status: MilestoneStatus;
  taskIds: string[];
  progress: { done: number; total: number };
}

export function useMilestones(workspaceId: string, projectId: string | undefined) {
  return useQuery({
    queryKey: ['milestones', workspaceId, projectId],
    queryFn: () => api.get<MilestoneView[]>(`/workspaces/${workspaceId}/projects/${projectId}/milestones`),
    enabled: Boolean(projectId),
  });
}
export function useCreateMilestone(workspaceId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; date: string; description?: string; ownerUserId?: string | null }) =>
      api.post<MilestoneView>(`/workspaces/${workspaceId}/projects/${projectId}/milestones`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['milestones', workspaceId, projectId] });
      void qc.invalidateQueries({ queryKey: ['timeline', workspaceId, projectId] });
    },
  });
}
export function useUpdateMilestone(workspaceId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ milestoneId, ...body }: { milestoneId: string } & Partial<MilestoneView>) =>
      api.patch<MilestoneView>(`/workspaces/${workspaceId}/milestones/${milestoneId}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['milestones', workspaceId, projectId] });
      void qc.invalidateQueries({ queryKey: ['timeline', workspaceId, projectId] });
    },
  });
}
export function useDeleteMilestone(workspaceId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (milestoneId: string) => api.delete(`/workspaces/${workspaceId}/milestones/${milestoneId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['milestones', workspaceId, projectId] });
      void qc.invalidateQueries({ queryKey: ['timeline', workspaceId, projectId] });
    },
  });
}

// ── Timeline ───────────────────────────────────────────────────────────────
export interface TimelineTask {
  id: string;
  key: string;
  title: string;
  parentTaskId: string | null;
  depth: number;
  startDate: string | null;
  dueDate: string | null;
  statusCategory: StatusCategory;
  completedAt: string | null;
  milestoneId: string | null;
  assigneeUserIds: string[];
  critical: boolean;
  baseline: { startDate: string | null; dueDate: string | null } | null;
}
export interface TimelineResponse {
  tasks: TimelineTask[];
  dependencies: Array<{ id: string; type: DependencyType; fromTaskId: string; toTaskId: string }>;
  milestones: MilestoneView[];
  baseline: { id: string; name: string; createdAt: string } | null;
}

export function useTimeline(workspaceId: string, projectId: string | undefined) {
  return useQuery({
    queryKey: ['timeline', workspaceId, projectId],
    queryFn: () => api.get<TimelineResponse>(`/workspaces/${workspaceId}/projects/${projectId}/timeline`),
    enabled: Boolean(projectId),
    staleTime: 10_000,
  });
}

export interface BaselineMeta {
  id: string;
  name: string;
  createdAt: string;
  taskCount: number;
}
export function useBaselines(workspaceId: string, projectId: string | undefined) {
  return useQuery({
    queryKey: ['baselines', workspaceId, projectId],
    queryFn: () => api.get<BaselineMeta[]>(`/workspaces/${workspaceId}/projects/${projectId}/baselines`),
    enabled: Boolean(projectId),
  });
}
export function useCreateBaseline(workspaceId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name?: string) =>
      api.post<BaselineMeta>(`/workspaces/${workspaceId}/projects/${projectId}/baselines`, { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['baselines', workspaceId, projectId] });
      void qc.invalidateQueries({ queryKey: ['timeline', workspaceId, projectId] });
    },
  });
}

// ── Calendar ───────────────────────────────────────────────────────────────
export interface CalendarResponse {
  tasks: Array<{ id: string; key: string; title: string; dueDate: string; startDate: string | null; completedAt: string | null }>;
  milestones: MilestoneView[];
}
export function useCalendar(workspaceId: string, projectId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['calendar', workspaceId, projectId, from, to],
    queryFn: () =>
      api.get<CalendarResponse>(`/workspaces/${workspaceId}/projects/${projectId}/calendar`, { query: { from, to } }),
    enabled: Boolean(projectId),
  });
}
