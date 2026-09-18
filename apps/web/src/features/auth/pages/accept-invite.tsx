import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { XCircle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { errorText } from '@/lib/api/errors';
import { useAuth } from '@/features/auth/auth.store';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { Spinner } from '@/components/ui';

export function AcceptInvitePage(): React.ReactElement {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reloadMemberships = useAuth((s) => s.reloadMemberships);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get('token');
    if (!token) {
      setError(t('auth.verifyEmailFail'));
      return;
    }
    api
      .post<{ workspaceId: string }>('/invites/accept', { token })
      .then(async () => {
        await reloadMemberships();
        void navigate('/', { replace: true });
      })
      .catch((err: unknown) => setError(errorText(err, t)));
  }, [params, navigate, reloadMemberships, t]);

  return (
    <AuthLayout title={t('auth.acceptInviteTitle')} centerTitle>
      <div className="flex flex-col items-center gap-3 text-center">
        {error ? (
          <>
            <XCircle className="size-10 text-danger" />
            <p className="text-sm text-text-muted">{error}</p>
          </>
        ) : (
          <>
            <Spinner className="size-6 text-text-muted" />
            <p className="text-sm text-text-muted">{t('common.loading')}</p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
