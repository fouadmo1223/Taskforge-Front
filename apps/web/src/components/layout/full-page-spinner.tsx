import { Spinner } from '@/components/ui/spinner';

export function FullPageSpinner(): React.ReactElement {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background">
      <Spinner className="size-6 text-text-muted" />
    </div>
  );
}
