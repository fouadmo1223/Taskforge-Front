import * as Popover from '@radix-ui/react-popover';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useWorkspace } from '@/features/workspace/workspace.context';
import { useUpdateProject, type ProjectView } from '@/features/projects/projects.api';

const PALETTE = ['#4f46e5', '#2563eb', '#0ea5e9', '#0d9488', '#16a34a', '#65a30d', '#d97706', '#ea580c', '#dc2626', '#db2777', '#7c3aed', '#64748b'];

/** The project's colour indicator — click to recolour if you can edit the project. */
export function ProjectColorDot({ project }: { project: ProjectView }): React.ReactElement {
  const { t } = useTranslation();
  const { workspaceId, can } = useWorkspace();
  const update = useUpdateProject(workspaceId, project.id);

  if (!can('project.update')) {
    return <span className="size-3 rounded" style={{ backgroundColor: project.color }} />;
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="size-3.5 rounded ring-offset-1 ring-offset-surface transition-shadow hover:ring-2 hover:ring-border-strong"
          style={{ backgroundColor: project.color }}
          aria-label={t('projectColor.change')}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="z-[120] rounded-xl border border-border bg-surface-elevated p-2.5 shadow-pop"
        >
          <p className="mb-1.5 px-0.5 text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            {t('projectColor.title')}
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => update.mutate({ color: c })}
                className={cn(
                  'flex size-6 items-center justify-center rounded-md',
                  project.color.toLowerCase() === c && 'ring-2 ring-primary ring-offset-1 ring-offset-surface-elevated',
                )}
                style={{ backgroundColor: c }}
              >
                {project.color.toLowerCase() === c && <Check className="size-3.5 text-white" />}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
