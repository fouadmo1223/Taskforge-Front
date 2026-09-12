import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

export function NotFoundPage(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background text-center">
      <p className="text-5xl font-bold text-text-subtle">404</p>
      <p className="text-sm text-text-muted">{t('errors.notFound')}</p>
      <Link to="/" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-contrast">
        {t('common.back')}
      </Link>
    </div>
  );
}
