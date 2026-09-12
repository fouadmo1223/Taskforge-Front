import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

interface LightboxState {
  url: string | null;
  open: (url: string) => void;
  close: () => void;
}

const useLightboxStore = create<LightboxState>((set) => ({
  url: null,
  open: (url) => set({ url }),
  close: () => set({ url: null }),
}));

export const lightbox = {
  open: (url: string): void => useLightboxStore.getState().open(url),
};

/**
 * Click-to-zoom for any image. Attach to a container that renders untrusted /
 * dynamic `<img>` markup (rich text, chat) via event delegation — clicking any
 * `<img>` inside opens it full-screen; other clicks pass through untouched.
 */
export function onImageClick(e: React.MouseEvent): void {
  const img = (e.target as HTMLElement).closest('img');
  if (img?.src) {
    e.preventDefault();
    lightbox.open(img.src);
  }
}

/** Mount once near the app root. */
export function LightboxHost(): React.ReactElement {
  const url = useLightboxStore((s) => s.url);
  const close = useLightboxStore((s) => s.close);

  return (
    <AnimatePresence>
      {url && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 p-6"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={close}
            className="absolute end-4 top-4 rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          <motion.img
            key={url}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.15 }}
            src={url}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
