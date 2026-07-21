'use client';

import { Toaster as SonnerToaster } from 'sonner';

/* Toaster — Sonner with no rounding, ink-bordered, cream-fill. */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'sw-toast',
        },
      }}
    />
  );
}
