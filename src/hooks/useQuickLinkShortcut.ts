import { useEffect } from 'react';
import { useQuickLinkStore } from '@/stores/quickLinks';

export function useQuickLinkShortcut() {
  const togglePanel = useQuickLinkStore((s) => s.togglePanel);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        togglePanel();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [togglePanel]);
}
