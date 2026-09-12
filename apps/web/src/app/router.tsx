import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { RequireAuth, RedirectIfAuthed } from '@/features/auth/guards';
import { WorkspaceProvider } from '@/features/workspace/workspace.context';
import { AppShell } from '@/components/layout/app-shell';
import { HomeRedirect } from '@/features/workspace/home-redirect';
import { FullPageSpinner } from '@/components/layout/full-page-spinner';
import { NotFoundPage } from '@/components/layout/not-found';

// Route-level code splitting: every page is its own async chunk so the initial
// bundle only carries the shell, guards and providers.
const LoginPage = lazy(() => import('@/features/auth/pages/login').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/features/auth/pages/register').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/forgot-password').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/reset-password').then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('@/features/auth/pages/verify-email').then((m) => ({ default: m.VerifyEmailPage })));
const AcceptInvitePage = lazy(() => import('@/features/auth/pages/accept-invite').then((m) => ({ default: m.AcceptInvitePage })));
const OnboardingPage = lazy(() => import('@/features/workspace/pages/onboarding').then((m) => ({ default: m.OnboardingPage })));
const MyWorkPage = lazy(() => import('@/features/workspace/pages/my-work').then((m) => ({ default: m.MyWorkPage })));
const ProjectsPage = lazy(() => import('@/features/projects/pages/projects').then((m) => ({ default: m.ProjectsPage })));
const ProjectPage = lazy(() => import('@/features/projects/pages/project').then((m) => ({ default: m.ProjectPage })));
const MembersPage = lazy(() => import('@/features/members/pages/members').then((m) => ({ default: m.MembersPage })));
const RolesPage = lazy(() => import('@/features/roles/pages/roles').then((m) => ({ default: m.RolesPage })));
const TimesheetPage = lazy(() => import('@/features/time/pages/timesheet').then((m) => ({ default: m.TimesheetPage })));
const WorkloadPage = lazy(() => import('@/features/time/pages/workload').then((m) => ({ default: m.WorkloadPage })));
const WorkspaceSettingsPage = lazy(() => import('@/features/workspace/pages/settings').then((m) => ({ default: m.WorkspaceSettingsPage })));
const ClientsPage = lazy(() => import('@/features/external/pages/clients').then((m) => ({ default: m.ClientsPage })));
const FormsPage = lazy(() => import('@/features/external/pages/forms').then((m) => ({ default: m.FormsPage })));
const RequestsPage = lazy(() => import('@/features/external/pages/requests').then((m) => ({ default: m.RequestsPage })));
const ApprovalsPage = lazy(() => import('@/features/external/pages/approvals').then((m) => ({ default: m.ApprovalsPage })));
const DeliverablesPage = lazy(() => import('@/features/external/pages/deliverables').then((m) => ({ default: m.DeliverablesPage })));
const PublicFormPage = lazy(() => import('@/features/external/pages/public-form').then((m) => ({ default: m.PublicFormPage })));
const PortalShell = lazy(() => import('@/features/portal/pages/portal').then((m) => ({ default: m.PortalShell })));
const SlaPage = lazy(() => import('@/features/sla/pages/sla').then((m) => ({ default: m.SlaPage })));
const PortfoliosPage = lazy(() => import('@/features/strategy/pages/portfolios').then((m) => ({ default: m.PortfoliosPage })));
const GoalsPage = lazy(() => import('@/features/strategy/pages/goals').then((m) => ({ default: m.GoalsPage })));
const AutomationsPage = lazy(() => import('@/features/automations/pages/automations').then((m) => ({ default: m.AutomationsPage })));
const IntegrationsPage = lazy(() => import('@/features/automations/pages/integrations').then((m) => ({ default: m.IntegrationsPage })));
const DashboardsPage = lazy(() => import('@/features/dashboards/pages/dashboards').then((m) => ({ default: m.DashboardsPage })));
const TemplatesPage = lazy(() => import('@/features/templates/pages/templates').then((m) => ({ default: m.TemplatesPage })));
const PublicSharePage = lazy(() => import('@/features/sharing/pages/public-share').then((m) => ({ default: m.PublicSharePage })));
const TeamsPage = lazy(() => import('@/features/teams/pages/teams').then((m) => ({ default: m.TeamsPage })));

/** Standalone (non-shell) routes need their own Suspense boundary. */
const page = (node: ReactNode): ReactNode => <Suspense fallback={<FullPageSpinner />}>{node}</Suspense>;

export const router = createBrowserRouter([
  { path: '/', element: <RequireAuth><HomeRedirect /></RequireAuth> },
  { path: '/login', element: <RedirectIfAuthed>{page(<LoginPage />)}</RedirectIfAuthed> },
  { path: '/register', element: <RedirectIfAuthed>{page(<RegisterPage />)}</RedirectIfAuthed> },
  { path: '/forgot-password', element: <RedirectIfAuthed>{page(<ForgotPasswordPage />)}</RedirectIfAuthed> },
  { path: '/reset-password', element: page(<ResetPasswordPage />) },
  { path: '/verify-email', element: page(<VerifyEmailPage />) },
  { path: '/f/:slug', element: page(<PublicFormPage />) },
  { path: '/share/:token', element: page(<PublicSharePage />) },
  {
    path: '/portal/:workspaceSlug',
    element: <RequireAuth>{page(<PortalShell />)}</RequireAuth>,
  },
  { path: '/invites/accept', element: <RequireAuth>{page(<AcceptInvitePage />)}</RequireAuth> },
  { path: '/onboarding', element: <RequireAuth>{page(<OnboardingPage />)}</RequireAuth> },
  {
    path: '/w/:workspaceSlug',
    element: (
      <RequireAuth>
        <WorkspaceProvider>
          <AppShell />
        </WorkspaceProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <MyWorkPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:projectId', element: <ProjectPage /> },
      { path: 'timesheet', element: <TimesheetPage /> },
      { path: 'workload', element: <WorkloadPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'forms', element: <FormsPage /> },
      { path: 'requests', element: <RequestsPage /> },
      { path: 'approvals', element: <ApprovalsPage /> },
      { path: 'deliverables', element: <DeliverablesPage /> },
      { path: 'sla', element: <SlaPage /> },
      { path: 'dashboards', element: <DashboardsPage /> },
      { path: 'portfolios', element: <PortfoliosPage /> },
      { path: 'goals', element: <GoalsPage /> },
      { path: 'automations', element: <AutomationsPage /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'integrations', element: <IntegrationsPage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'members', element: <MembersPage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'settings', element: <WorkspaceSettingsPage /> },
    ],
  },
  { path: '/404', element: <NotFoundPage /> },
  { path: '*', element: <Navigate to="/404" replace /> },
]);
