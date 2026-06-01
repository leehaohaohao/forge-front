import { create } from 'zustand';
import type { Settings } from '@/types/settings';
import { defaultSettings } from '@/types/settings';
import * as settingsApi from '@/services/settings';

interface SettingsStore {
  settings: Settings;
  loading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: { ...defaultSettings },
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });
    try {
      const data = await settingsApi.getSettings();
      set({ settings: { ...defaultSettings, ...data } });
    } finally {
      set({ loading: false });
    }
  },

  updateSettings: async (patch) => {
    const current = get().settings;
    const merged = {
      quickLink: { ...current.quickLink, ...patch.quickLink },
      shortcuts: { ...current.shortcuts, ...patch.shortcuts },
      theme: { ...current.theme, ...patch.theme },
    };
    set({ settings: merged });
    try {
      await settingsApi.updateSettings(patch);
    } catch {
      set({ settings: current });
    }
  },

  resetSettings: async () => {
    await settingsApi.resetSettings();
    set({ settings: { ...defaultSettings } });
  },
}));
