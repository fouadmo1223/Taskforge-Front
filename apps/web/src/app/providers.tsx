import { useEffect, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import * as RTooltip from '@radix-ui/react-tooltip';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { queryClient } from '@/lib/query';
import { channels } from '@flowdesk/types';
import { useAuth } from '@/features/auth/auth.store';
import { useTheme } from '@/lib/theme/theme.store';
import { realtime } from '@/lib/realtime/ably';
import { useRoom } from '@/lib/realtime/hooks';
import { ConfirmHost } from '@/components/ui/confirm';
import { ToastHost } from '@/components/ui/toast';
import { LightboxHost } from '@/components/ui/lightbox';

function RealtimeBridge(): null {
  const status = useAuth((s) => s.status);
  const token = useAuth((s) => s.accessToken);
  const userId = useAuth((s) => s.user?.id ?? null);
  useEffect(() => {
    if (status === 'authenticated') realtime.connect();
    else realtime.disconnect();
  }, [status]);
  useEffect(() => {
    if (status === 'authenticated' && token) realtime.reauth();
  }, [token, status]);
  // personal channel: notifications + presence (running timer)
  useRoom(status === 'authenticated' && userId ? channels.user(userId) : null);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }): React.ReactElement {
  useEffect(() => {
    void useAuth.getState().bootstrap();
    useTheme.getState().syncResolved();
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <RTooltip.Provider delayDuration={300} skipDelayDuration={200}>
          <RealtimeBridge />
          {children}
          <ConfirmHost />
          <ToastHost />
          <LightboxHost />
        </RTooltip.Provider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
