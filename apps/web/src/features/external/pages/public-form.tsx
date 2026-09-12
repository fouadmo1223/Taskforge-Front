import { useState } from 'react';
import { errorText } from '@/lib/api/errors';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import type { FormFieldView } from '@/features/external/external.api';
import { usePublicForm, useSubmitPublicForm } from '@/features/external/external.api';
import { Button, Field, Input, MultiSelect, Select, Spinner, Textarea } from '@/components/ui';
import { LanguageThemeControls } from '@/components/layout/language-theme-controls';

export function PublicFormPage(): React.ReactElement {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const form = usePublicForm(slug);
  const submit = useSubmitPublicForm(slug);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const setAnswer = (id: string, value: unknown): void => setAnswers((a) => ({ ...a, [id]: value }));

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    submit.mutate(
      { answers, submitterName: name || undefined, submitterEmail: email || undefined },
      {
        onSuccess: (res) => setDone(res.message),
        onError: (err) => setError(errorText(err, t)),
      },
    );
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex justify-end p-4">
        <LanguageThemeControls compact />
      </header>
      <main className="mx-auto max-w-xl px-4 pb-16 pt-4">
        {form.isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : form.isError || !form.data ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-sm text-text-muted">
            {t('external.publicForm.notAvailable')}
          </p>
        ) : done ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <CheckCircle2 className="mx-auto size-10 text-success" />
            <h1 className="mt-3 text-lg font-semibold text-text">{t('external.publicForm.thanks')}</h1>
            <p className="mt-1 text-sm text-text-muted">{done}</p>
            <Button
              variant="ghost"
              className="mt-4"
              onClick={() => {
                setDone(null);
                setAnswers({});
                setName('');
                setEmail('');
              }}
            >
              {t('external.publicForm.submitAnother')}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
            <h1 className="text-xl font-semibold text-text">{form.data.title}</h1>
            {form.data.description && <p className="mt-1 text-sm text-text-muted">{form.data.description}</p>}

            <div className="mt-6 space-y-4">
              {form.data.fields.map((f) => (
                <PublicField key={f.id} field={f} value={answers[f.id]} onChange={(v) => setAnswer(f.id, v)} />
              ))}
              <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <Field label={t('external.publicForm.yourName')}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label={t('external.publicForm.yourEmail')}>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
              </div>
            </div>

            {error && <p className="mt-4 rounded-lg bg-danger-soft/50 px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" className="mt-6 w-full" loading={submit.isPending}>
              {t('external.publicForm.submit')}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}

function PublicField({
  field,
  value,
  onChange,
}: {
  field: FormFieldView;
  value: unknown;
  onChange: (v: unknown) => void;
}): React.ReactElement {
  const label = field.label + (field.required ? ' *' : '');
  const options = field.options.map((o) => ({ value: o.value, label: o.label }));

  switch (field.type) {
    case 'textarea':
      return (
        <Field label={label} hint={field.description}>
          <Textarea rows={4} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
        </Field>
      );
    case 'select':
    case 'radio':
      return (
        <Field label={label} hint={field.description}>
          <Select value={(value as string) ?? null} onChange={(v) => onChange(v)} options={options} />
        </Field>
      );
    case 'multi_select':
      return (
        <Field label={label} hint={field.description}>
          <MultiSelect value={(value as string[]) ?? []} onChange={(v) => onChange(v)} options={options} />
        </Field>
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded border-border" />
          {label}
        </label>
      );
    default:
      return (
        <Field label={label} hint={field.description}>
          <Input
            type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : field.type === 'phone' ? 'tel' : 'text'}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        </Field>
      );
  }
}
