import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { LanguageThemeControls } from '@/components/layout/language-theme-controls';
import { BrandMark } from '@/components/layout/brand-mark';

/** Two-panel shell for every auth screen: brand panel + form card. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(60rem_40rem_at_30%_20%,white,transparent)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-primary-contrast">
          <span className="flex items-center gap-2 text-lg font-bold">
            <BrandMark className="size-6 text-white" />
            {t('common.appName')}
          </span>
          <div>
            <p className="max-w-md text-2xl font-semibold leading-snug">{t('auth.brandTagline')}</p>
            <p className="mt-3 max-w-md text-sm text-primary-contrast/80">{t('auth.brandSubtitle')}</p>
          </div>
          <span className="text-xs text-primary-contrast/60">© {new Date().getFullYear()} {t('common.appName')}</span>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex justify-end p-4">
          <LanguageThemeControls />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            className="w-full max-w-sm"
          >
            <h1 className="text-xl font-semibold text-text">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-text-muted">{subtitle}</p>}
            <div className="mt-6">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-text-muted">{footer}</div>}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
