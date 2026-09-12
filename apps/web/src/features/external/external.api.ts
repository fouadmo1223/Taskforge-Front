import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApprovalDecision, ApprovalStrategy, FormFieldType, FormVisibility, TaskPriority } from '@flowdesk/types';
import { api } from '@/lib/api/client';

// ── clients ────────────────────────────────────────────────────────────────

export interface ClientView {
  id: string;
  name: string;
  logo: { secureUrl: string } | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  notes: string;
  status: 'active' | 'archived';
  projectIds: string[];
  createdAt: string;
}

const clientsKey = (w: string) => ['clients', w];

export function useClients(workspaceId: string, includeArchived = false) {
  return useQuery({
    queryKey: [...clientsKey(workspaceId), { includeArchived }],
    queryFn: () =>
      api.get<ClientView[]>(`/workspaces/${workspaceId}/clients`, {
        query: { includeArchived: includeArchived ? 'true' : undefined },
      }),
  });
}

export function useCreateClient(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ClientView> & { name: string }) =>
      api.post<ClientView>(`/workspaces/${workspaceId}/clients`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clientsKey(workspaceId) }),
  });
}

export function useUpdateClient(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ClientView> & { id: string }) =>
      api.patch<ClientView>(`/workspaces/${workspaceId}/clients/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clientsKey(workspaceId) }),
  });
}

export function useSetClientProjects(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectIds }: { id: string; projectIds: string[] }) =>
      api.patch<ClientView>(`/workspaces/${workspaceId}/clients/${id}/projects`, { projectIds }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clientsKey(workspaceId) }),
  });
}

export function useDeleteClient(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/clients/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: clientsKey(workspaceId) }),
  });
}

// ── forms ──────────────────────────────────────────────────────────────────

export interface FormFieldView {
  id: string;
  type: FormFieldType;
  label: string;
  description: string;
  placeholder: string;
  required: boolean;
  options: { label: string; value: string }[];
  order: number;
}

export interface FormView {
  id: string;
  title: string;
  description: string;
  slug: string;
  projectId: string | null;
  visibility: FormVisibility;
  status: 'draft' | 'published' | 'closed';
  fields: FormFieldView[];
  successMessage: string;
  routing: { enabled: boolean; projectId: string | null; assigneeUserId: string | null; priority: TaskPriority };
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmissionView {
  id: string;
  formId: string;
  answers: Record<string, unknown>;
  submitterName: string;
  submitterEmail: string;
  requestId: string | null;
  createdAt: string;
}

export interface FormInput {
  title: string;
  description?: string;
  visibility?: FormVisibility;
  fields?: Array<Omit<FormFieldView, 'order'> & { order?: number }>;
  successMessage?: string;
  routing?: FormView['routing'];
  status?: FormView['status'];
}

const formsKey = (w: string) => ['forms', w];

export function useForms(workspaceId: string) {
  return useQuery({
    queryKey: formsKey(workspaceId),
    queryFn: () => api.get<FormView[]>(`/workspaces/${workspaceId}/forms`),
  });
}

export function useForm(workspaceId: string, formId: string | null) {
  return useQuery({
    queryKey: ['form', workspaceId, formId],
    queryFn: () => api.get<FormView>(`/workspaces/${workspaceId}/forms/${formId}`),
    enabled: Boolean(formId),
  });
}

export function useFormSubmissions(workspaceId: string, formId: string | null) {
  return useQuery({
    queryKey: ['form-submissions', workspaceId, formId],
    queryFn: () => api.get<FormSubmissionView[]>(`/workspaces/${workspaceId}/forms/${formId}/submissions`),
    enabled: Boolean(formId),
  });
}

export function useCreateForm(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FormInput) => api.post<FormView>(`/workspaces/${workspaceId}/forms`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: formsKey(workspaceId) }),
  });
}

export function useUpdateForm(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: FormInput & { id: string }) =>
      api.patch<FormView>(`/workspaces/${workspaceId}/forms/${id}`, body),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: formsKey(workspaceId) });
      qc.setQueryData(['form', workspaceId, data.id], data);
    },
  });
}

export function useDeleteForm(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/forms/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: formsKey(workspaceId) }),
  });
}

// ── public form (unauthenticated) ──────────────────────────────────────────

export interface PublicFormView {
  title: string;
  description: string;
  slug: string;
  fields: FormFieldView[];
  successMessage: string;
}

export function usePublicForm(slug: string) {
  return useQuery({
    queryKey: ['public-form', slug],
    queryFn: () => api.get<PublicFormView>(`/public/forms/${slug}`, { anonymous: true }),
    retry: false,
  });
}

export function useSubmitPublicForm(slug: string) {
  return useMutation({
    mutationFn: (body: { answers: Record<string, unknown>; submitterName?: string; submitterEmail?: string }) =>
      api.post<{ message: string }>(`/public/forms/${slug}/submit`, body, { anonymous: true }),
  });
}

// ── requests ───────────────────────────────────────────────────────────────

export type RequestStatus = 'new' | 'triage' | 'accepted' | 'declined' | 'converted';

export interface RequestView {
  id: string;
  title: string;
  description: string;
  status: RequestStatus;
  priority: TaskPriority;
  source: 'form' | 'portal' | 'manual';
  projectId: string | null;
  clientId: string | null;
  requesterName: string;
  requesterEmail: string;
  assigneeUserId: string | null;
  linkedTaskId: string | null;
  createdAt: string;
}

const requestsKey = (w: string) => ['requests', w];

export function useRequests(workspaceId: string, status?: RequestStatus) {
  return useQuery({
    queryKey: [...requestsKey(workspaceId), status ?? null],
    queryFn: () =>
      api.get<RequestView[]>(`/workspaces/${workspaceId}/requests`, { query: { status } }),
  });
}

export function useCreateRequest(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description?: string; priority?: TaskPriority; projectId?: string; clientId?: string }) =>
      api.post<RequestView>(`/workspaces/${workspaceId}/requests`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: requestsKey(workspaceId) }),
  });
}

export function useUpdateRequest(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<RequestView> & { id: string }) =>
      api.patch<RequestView>(`/workspaces/${workspaceId}/requests/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: requestsKey(workspaceId) }),
  });
}

export function useConvertRequest(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId, columnId }: { id: string; projectId: string; columnId?: string }) =>
      api.post<{ request: RequestView; taskId: string; taskKey: string }>(
        `/workspaces/${workspaceId}/requests/${id}/convert`,
        { projectId, columnId },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: requestsKey(workspaceId) });
    },
  });
}

// ── approvals ──────────────────────────────────────────────────────────────

export interface ApprovalStepView {
  id: string;
  order: number;
  approverUserId: string;
  decision: ApprovalDecision | null;
  comment: string;
  decidedAt: string | null;
  actionable: boolean;
}

export interface ApprovalView {
  id: string;
  subjectType: string;
  subjectId: string;
  projectId: string | null;
  title: string;
  description: string;
  strategy: ApprovalStrategy;
  requiredCount: number;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'cancelled';
  requestedByUserId: string;
  steps: ApprovalStepView[];
  decidedAt: string | null;
  createdAt: string;
}

const approvalsKey = (w: string) => ['approvals', w];

export function useMyApprovals(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: [...approvalsKey(workspaceId), 'mine'],
    queryFn: () => api.get<ApprovalView[]>(`/workspaces/${workspaceId}/approvals`),
    enabled,
  });
}

export function useSubjectApprovals(workspaceId: string, subjectType: string | null, subjectId: string | null) {
  return useQuery({
    queryKey: [...approvalsKey(workspaceId), subjectType, subjectId],
    queryFn: () =>
      api.get<ApprovalView[]>(`/workspaces/${workspaceId}/approvals`, {
        query: { subjectType: subjectType ?? '', subjectId: subjectId ?? '' },
      }),
    enabled: Boolean(subjectType && subjectId),
  });
}

export function useCreateApproval(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      subjectType: string;
      subjectId: string;
      projectId?: string;
      title: string;
      description?: string;
      strategy: ApprovalStrategy;
      requiredCount?: number;
      approverUserIds: string[];
    }) => api.post<ApprovalView>(`/workspaces/${workspaceId}/approvals`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: approvalsKey(workspaceId) }),
  });
}

export function useDecideApproval(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalId, stepId, decision, comment }: { approvalId: string; stepId: string; decision: ApprovalDecision; comment?: string }) =>
      api.post<ApprovalView>(`/workspaces/${workspaceId}/approvals/${approvalId}/steps/${stepId}/decide`, { decision, comment }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: approvalsKey(workspaceId) }),
  });
}

export function useCancelApproval(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (approvalId: string) => api.post<ApprovalView>(`/workspaces/${workspaceId}/approvals/${approvalId}/cancel`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: approvalsKey(workspaceId) }),
  });
}

// ── deliverables ───────────────────────────────────────────────────────────

export interface DeliverableVersionView {
  id: string;
  version: number;
  url: string;
  format: string;
  bytes: number;
  note: string;
  uploadedByUserId: string;
  approvalId: string | null;
  createdAt: string;
}

export interface DeliverableView {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string;
  status: 'draft' | 'in_review' | 'approved' | 'delivered' | 'archived';
  clientVisible: boolean;
  dueAt: string | null;
  currentVersion: number;
  versions: DeliverableVersionView[];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

const deliverablesKey = (w: string) => ['deliverables', w];

export function useDeliverables(workspaceId: string, projectId?: string) {
  return useQuery({
    queryKey: [...deliverablesKey(workspaceId), projectId ?? null],
    queryFn: () =>
      api.get<DeliverableView[]>(`/workspaces/${workspaceId}/deliverables`, { query: { projectId } }),
  });
}

export function useCreateDeliverable(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { projectId: string; title: string; description?: string; clientVisible?: boolean; dueAt?: string }) =>
      api.post<DeliverableView>(`/workspaces/${workspaceId}/deliverables`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: deliverablesKey(workspaceId) }),
  });
}

export function useUpdateDeliverable(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<DeliverableView> & { id: string }) =>
      api.patch<DeliverableView>(`/workspaces/${workspaceId}/deliverables/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: deliverablesKey(workspaceId) }),
  });
}

export function useUploadDeliverableVersion(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file, note }: { id: string; file: File; note?: string }) => {
      const fd = new FormData();
      fd.append('file', file);
      if (note) fd.append('note', note);
      return api.post<DeliverableView>(`/workspaces/${workspaceId}/deliverables/${id}/versions`, fd);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: deliverablesKey(workspaceId) }),
  });
}

export function useRequestVersionApproval(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, versionId, approverUserIds, strategy, requiredCount, description }: {
      id: string;
      versionId: string;
      approverUserIds: string[];
      strategy: ApprovalStrategy;
      requiredCount?: number;
      description?: string;
    }) =>
      api.post<DeliverableView>(
        `/workspaces/${workspaceId}/deliverables/${id}/versions/${versionId}/request-approval`,
        { approverUserIds, strategy, requiredCount, description },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliverablesKey(workspaceId) });
      void qc.invalidateQueries({ queryKey: ['approvals', workspaceId] });
    },
  });
}

export function useDeleteDeliverable(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/deliverables/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: deliverablesKey(workspaceId) }),
  });
}
