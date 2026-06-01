import { useEffect } from 'react';
import { useQuickLinkStore } from '@/stores/quickLinks';
import { useSettingsStore } from '@/stores/settings';

function parseShortcut(combo: string) {
  const parts = combo.split('+').map((s) => s.trim().toLowerCase());
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta'),
    key: parts.filter((p) => !['ctrl', 'shift', 'alt', 'meta'].includes(p))[0] || '',
  };
}

export function useQuickLinkShortcut() {
  const togglePanel = useQuickLinkStore((s) => s.togglePanel);
  const shortcut = useSettingsStore((s) => s.settings.shortcuts.togglePanel);

  useEffect(() => {
    const combo = parseShortcut(shortcut);
    if (!combo.key) return;

    const handler = (e: KeyboardEvent) => {
      const keyMatch = e.key.toLowerCase() === combo.key || e.code.toLowerCase() === `key${combo.key}`;
      if (
        e.ctrlKey === combo.ctrl &&
        e.shiftKey === combo.shift &&
        e.altKey === combo.alt &&
        e.metaKey === combo.meta &&
        keyMatch
      ) {
        e.preventDefault();
        togglePanel();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [togglePanel, shortcut]);
}
