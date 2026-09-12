import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  STATUS_CATEGORIES,
  TASK_PRIORITIES,
  type StatusCategory,
  type TaskPriority,
  type UserSummary,
} from '@flowdesk/types';
import { Avatar } from '../avatar';
import { Select } from './Select';
import { MultiSelect } from './MultiSelect';
import type { SelectOption } from './types';

const PRIORITY_DOT: Record<TaskPriority, string> = {
  none: 'bg-text-subtle',
  low: 'bg-info',
  medium: 'bg-warning',
  high: 'bg-accent',
  urgent: 'bg-danger',
};

const STATUS_DOT: Record<StatusCategory, string> = {
  backlog: 'bg-text-subtle',
  todo: 'bg-info',
  in_progress: 'bg-primary',
  blocked: 'bg-danger',
  in_review: 'bg-warning',
  done: 'bg-success',
  cancelled: 'bg-text-subtle',
};

const dot = (cls: string): React.ReactElement => <span className={`size-2 rounded-full ${cls}`} />;

export function PrioritySelect({
  value,
  onChange,
  ...rest
}: {
  value: TaskPriority | null;
  onChange: (v: TaskPriority | null) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}): React.ReactElement {
  const { t } = useTranslation();
  const options: SelectOption<TaskPriority>[] = TASK_PRIORITIES.map((p) => ({
    value: p,
    label: t(`priority.${p}`),
    icon: dot(PRIORITY_DOT[p]),
  }));
  return <Select {...rest} value={value} onChange={onChange} options={options} placeholder={t('priority.label')} />;
}

export function StatusSelect({
  value,
  onChange,
  labels,
  ...rest
}: {
  value: StatusCategory | null;
  onChange: (v: StatusCategory | null) => void;
  labels?: Partial<Record<StatusCategory, string>>;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}): React.ReactElement {
  const { t } = useTranslation();
  const options: SelectOption<StatusCategory>[] = STATUS_CATEGORIES.map((s) => ({
    value: s,
    label: labels?.[s] ?? t(`statusCategory.${s}`),
    icon: dot(STATUS_DOT[s]),
  }));
  return <Select {...rest} value={value} onChange={onChange} options={options} placeholder={t('status.label')} />;
}

function userOptions(users: UserSummary[]): SelectOption[] {
  return users.map((u) => ({
    value: u.id,
    label: u.name,
    description: u.email,
    keywords: [u.email],
    icon: <Avatar name={u.name} src={u.avatar} size="xs" />,
  }));
}

export function UserSelect({
  users,
  value,
  onChange,
  ...rest
}: {
  users: UserSummary[];
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  loading?: boolean;
  clearable?: boolean;
  className?: string;
  placeholder?: string;
}): React.ReactElement {
  const { t } = useTranslation();
  const options = useMemo(() => userOptions(users), [users]);
  return <Select {...rest} value={value} onChange={onChange} options={options} searchable placeholder={rest.placeholder ?? t('task.assignees')} />;
}

export function UserMultiSelect({
  users,
  value,
  onChange,
  ...rest
}: {
  users: UserSummary[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  placeholder?: string;
}): React.ReactElement {
  const { t } = useTranslation();
  const options = useMemo(() => userOptions(users), [users]);
  return <MultiSelect {...rest} value={value} onChange={onChange} options={options} placeholder={rest.placeholder ?? t('task.assignees')} />;
}
