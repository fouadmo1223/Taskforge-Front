import type { ReactNode } from 'react';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** group heading; options sharing a group render together under it */
  group?: string;
  /** free-form keywords to widen search matching */
  keywords?: string[];
}

export interface SelectBaseProps<V extends string = string> {
  options: SelectOption<V>[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  invalid?: boolean;
  /** show a clear ("x") affordance when something is selected */
  clearable?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  errorLabel?: string;
  name?: string;
  id?: string;
  className?: string;
  /** menu width strategy */
  menuMatchTrigger?: boolean;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}
