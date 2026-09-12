import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { Spinner } from '@/components/ui';

export function VerifyEmailPage(): React.ReactElement {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [state, setState] = useState<'pending' | 'ok' | 'fail'>('pending');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get('token');
    if (!token) {
      setState('fail');
      return;
    }
    api
      .post('/auth/verify-email', { token }, { anonymous: true })
      .then(() => setState('ok'))
      .catch(() => setState('fail'));
  }, [params]);

  return (
    <AuthLayout title={t('common.appName')}>
      <div className="flex flex-col items-center gap-3 text-center">
        {state === 'pending' && (
          <>
            <Spinner className="size-6 text-text-muted" />
            <p className="text-sm text-text-muted">{t('auth.verifyEmailTitle')}</p>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="size-10 text-success" />
            <p className="text-sm text-text-muted">{t('auth.verifyEmailOk')}</p>
            <Link to="/login" className="text-sm font-medium text-primary hover:underline">
              {t('auth.signIn')}
            </Link>
          </>
        )}
        {state === 'fail' && (
          <>
            <XCircle className="size-10 text-danger" />
            <p className="text-sm text-text-muted">{t('auth.verifyEmailFail')}</p>
            <Link to="/login" className="text-sm font-medium text-primary hover:underline">
              {t('auth.signIn')}
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
