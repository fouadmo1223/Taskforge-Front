import { useEffect, useMemo, useRef, useState } from 'react';
import { Select } from './Select';
import type { SelectBaseProps, SelectOption } from './types';

interface AsyncSelectProps<V extends string> extends Omit<SelectBaseProps<V>, 'options'> {
  value: V | null;
  onChange: (value: V | null) => void;
  /** called with the current search term; return matching options */
  loader: (query: string) => Promise<SelectOption<V>[]>;
  /** options to show before the user types / to resolve the current value's label */
  initialOptions?: SelectOption<V>[];
  debounceMs?: number;
}

/** Debounced server-backed single-select. */
export function AsyncSelect<V extends string = string>({
  value,
  onChange,
  loader,
  initialOptions = [],
  debounceMs = 250,
  ...rest
}: AsyncSelectProps<V>): React.ReactElement {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SelectOption<V>[]>(initialOptions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await loader(query);
        if (seq.current === id) setOptions(result);
      } catch {
        if (seq.current === id) setError('Could not load options.');
      } finally {
        if (seq.current === id) setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [query, loader, debounceMs]);

  const merged = useMemo(() => {
    const byValue = new Map<string, SelectOption<V>>();
    for (const o of [...initialOptions, ...options]) byValue.set(o.value, o);
    return [...byValue.values()];
  }, [initialOptions, options]);

  return (
    <Select
      {...rest}
      value={value}
      onChange={onChange}
      options={merged}
      searchable
      loading={loading}
      errorLabel={error ?? undefined}
      onSearchChange={setQuery}
    />
  );
}
