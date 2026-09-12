import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2,
  CalendarClock,
  CheckSquare,
  Clock,
  FileInput,
  FileStack,
  FolderKanban,
  Gauge,
  Inbox,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  MessageCircle,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  Target,
  Users,
  Users2,
  X,
  Zap,
} from 'lucide-react';
import type { Permission } from '@flowdesk/types';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { cn } from '@/lib/cn';
import { Scrollable } from '@/components/ui/scrollable';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip } from '@/components/ui';
import { CommandPalette, useCommandPalette } from '@/features/search/command-palette';
import { TimerWidget } from '@/features/time/timer-widget';
import { ChatPanel, useChatUi, useTotalUnread } from '@/features/chat/chat-panel';
import { WorkspaceSwitcher } from './workspace-switcher';
import { BrandMark } from './brand-mark';
import { UserMenu } from './user-menu';
import { LanguageThemeControls } from './language-theme-controls';

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof LayoutGrid;
  end?: boolean;
  permission?: Permission;
}

const NAV: NavItem[] = [
  { to: '', labelKey: 'nav.myWork', icon: LayoutGrid, end: true },
  { to: 'projects', labelKey: 'nav.projects', icon: FolderKanban, permission: 'project.read' },
  { to: 'portfolios', labelKey: 'nav.portfolios', icon: Layers, permission: 'project.read' },
  { to: 'goals', labelKey: 'nav.goals', icon: Target, permission: 'project.read' },
  { to: 'dashboards', labelKey: 'nav.dashboards', icon: LayoutDashboard, permission: 'report.read' },
  { to: 'timesheet', labelKey: 'nav.timesheet', icon: Clock, permission: 'time.log' },
  { to: 'workload', labelKey: 'nav.workload', icon: CalendarClock, permission: 'workload.read' },
  { to: 'requests', labelKey: 'nav.requests', icon: Inbox, permission: 'request.manage' },
  { to: 'approvals', labelKey: 'nav.approvals', icon: CheckSquare, permission: 'approval.approve' },
  { to: 'deliverables', labelKey: 'nav.deliverables', icon: Package, permission: 'client.manage' },
  { to: 'sla', labelKey: 'nav.sla', icon: Gauge, permission: 'sla.manage' },
  { to: 'forms', labelKey: 'nav.forms', icon: FileInput, permission: 'form.read' },
  { to: 'clients', labelKey: 'nav.clients', icon: Building2, permission: 'client.read' },
  { to: 'templates', labelKey: 'nav.templates', icon: FileStack, permission: 'template.manage' },
  { to: 'automations', labelKey: 'nav.automations', icon: Zap, permission: 'automation.manage' },
  { to: 'integrations', labelKey: 'nav.integrations', icon: Plug, permission: 'webhook.manage' },
  { to: 'teams', labelKey: 'nav.teams', icon: Users2, permission: 'team.manage' },
  { to: 'members', labelKey: 'nav.members', icon: Users, permission: 'members.invite' },
  { to: 'roles', labelKey: 'nav.roles', icon: ShieldCheck, permission: 'roles.manage' },
  { to: 'settings', labelKey: 'nav.settings', icon: Settings, permission: 'workspace.manage' },
];

const COLLAPSE_KEY = 'flowdesk.sidebar.collapsed';

/** Mirrors NavLink's own active-match rules (exact for `end`, prefix otherwise). */
function isNavActive(pathname: string, base: string, to: string, end?: boolean): boolean {
  const full = (to ? `${base}/${to}` : base).replace(/\/+$/, '');
  return end ? pathname === full : pathname === full || pathname.startsWith(`${full}/`);
}

function SidebarNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }): React.ReactElement {
  const { t } = useTranslation();
  const { slug, can } = useWorkspace();
  const { pathname } = useLocation();
  const base = `/w/${slug}`;
  return (
    <nav className={cn('flex flex-col', collapsed ? 'gap-2' : 'gap-0.5')}>
      {NAV.filter((item) => !item.permission || can(item.permission)).map((item) => {
        // Computed here (not as a NavLink `className` function) because Radix's
        // Slot — used by <Tooltip> to merge props onto the collapsed link —
        // joins className values with `.join(' ')`, which silently stringifies
        // a function prop into its literal source text instead of calling it.
        const active = isNavActive(pathname, base, item.to, item.end);
        const link = (
          <NavLink
            key={item.to}
            to={`${base}/${item.to}`}
            end={item.end}
            onClick={onNavigate}
            className={cn(
              'flex items-center rounded-lg font-medium transition-colors',
              collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2 text-sm',
              active
                ? collapsed
                  ? 'bg-primary text-primary-contrast shadow-xs'
                  : 'bg-primary-soft text-primary'
                : 'text-text-muted hover:bg-surface-sunken hover:text-text',
            )}
          >
            <item.icon className={cn('shrink-0', collapsed ? 'size-5' : 'size-4')} />
            {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
          </NavLink>
        );
        return collapsed ? (
          <Tooltip key={item.to} content={t(item.labelKey)} side="right">
            {link}
          </Tooltip>
        ) : (
          link
        );
      })}
    </nav>
  );
}

export function AppShell(): React.ReactElement {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <div className="flex h-dvh bg-background">
      <CommandPalette />
      <ChatPanel />

      {/* desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? '3.75rem' : '15rem' }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
        className="hidden shrink-0 flex-col overflow-hidden border-e border-border bg-surface lg:flex"
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 border-b border-border/60 p-2.5 pb-3">
            <Tooltip content={t('common.appName')} side="right">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-contrast">
                <BrandMark className="size-[18px]" />
              </span>
            </Tooltip>
            <Tooltip content={t('common.expandSidebar')} side="right">
              <button
                onClick={() => setCollapsed(false)}
                className="rounded-lg p-1.5 text-text-subtle hover:bg-surface-sunken hover:text-text"
                aria-label={t('common.expandSidebar')}
              >
                <PanelLeftOpen className="size-4" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-1 p-2.5">
            <div className="min-w-0 flex-1">
              <WorkspaceSwitcher />
            </div>
            <Tooltip content={t('common.collapseSidebar')} side="right">
              <button
                onClick={() => setCollapsed(true)}
                className="rounded-lg p-1.5 text-text-subtle hover:bg-surface-sunken hover:text-text"
                aria-label={t('common.collapseSidebar')}
              >
                <PanelLeftClose className="size-4" />
              </button>
            </Tooltip>
          </div>
        )}
        <Scrollable className={cn('flex-1 pb-4', collapsed ? 'px-2 pt-2' : 'px-2.5')} hidden>
          <SidebarNav collapsed={collapsed} />
        </Scrollable>
      </motion.aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 40 }}
              className="fixed inset-y-0 start-0 z-50 flex w-64 flex-col border-e border-border bg-surface lg:hidden rtl:[--tw-enter-translate-x:100%]"
            >
              <div className="flex items-center justify-between p-2.5">
                <WorkspaceSwitcher />
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 hover:bg-surface-sunken">
                  <X className="size-4" />
                </button>
              </div>
              <Scrollable className="flex-1 px-2.5 pb-4" hidden>
                <SidebarNav onNavigate={() => setMobileOpen(false)} />
              </Scrollable>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <button
            onClick={() => useCommandPalette.getState().setOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm text-text-subtle hover:bg-surface-sunken"
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">{t('common.search')}</span>
            <kbd className="hidden rounded bg-surface-sunken px-1 text-[10px] sm:inline">⌘K</kbd>
          </button>
          <div className="flex-1" />
          <TimerWidget />
          <ChatButton />
          <LanguageThemeControls compact />
          <UserMenu />
        </header>

        <main className="min-h-0 flex-1">
          <Scrollable className="h-full" gutter>
            {/* No route-change fade here on purpose: a lazy chunk suspending
                unmounts its subtree synchronously, which fights any exit/enter
                animation keyed on the route (fade-out -> spinner -> hard-cut-to-
                content reads as a double flash). A plain Suspense swap — instant
                once the page's own chunk is cached, a brief spinner only the very
                first time a route is visited — is the more stable choice here. */}
            <Suspense fallback={<div className="flex h-full items-center justify-center"><Spinner className="size-6 text-text-muted" /></div>}>
              <Outlet />
            </Suspense>
          </Scrollable>
        </main>
      </div>
    </div>
  );
}

function ChatButton(): React.ReactElement {
  const setOpen = useChatUi((s) => s.setOpen);
  const unread = useTotalUnread();
  return (
    <button
      onClick={() => setOpen(true)}
      className="relative rounded-lg p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text"
      aria-label="Messages"
    >
      <MessageCircle className="size-5" />
      {unread > 0 && (
        <span className="absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
