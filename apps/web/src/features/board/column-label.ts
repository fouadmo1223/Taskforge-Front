import type { TFunction } from 'i18next';

/**
 * Stock column names come from the English default seed ("To Do", "In Progress",
 * …). When a column still carries one of those names we show the localized
 * status label instead; genuinely custom names ("Discovery", "Launch") are left
 * untouched. Editing still operates on the real stored `name`.
 */
const DEFAULT_NAME_KEY: Record<string, string> = {
  backlog: 'statusCategory.backlog',
  'to do': 'statusCategory.todo',
  todo: 'statusCategory.todo',
  'to-do': 'statusCategory.todo',
  'in progress': 'statusCategory.in_progress',
  'in-progress': 'statusCategory.in_progress',
  doing: 'statusCategory.in_progress',
  blocked: 'statusCategory.blocked',
  'in review': 'statusCategory.in_review',
  'in-review': 'statusCategory.in_review',
  review: 'statusCategory.in_review',
  done: 'statusCategory.done',
  complete: 'statusCategory.done',
  completed: 'statusCategory.done',
  cancelled: 'statusCategory.cancelled',
  canceled: 'statusCategory.cancelled',
};

export function columnLabel(name: string, t: TFunction): string {
  const key = DEFAULT_NAME_KEY[name.trim().toLowerCase()];
  return key ? t(key) : name;
}
