export interface QuickLinkSettings {
  panelDefaultOpen: boolean;
  openInNewTab: boolean;
}

export interface ShortcutsSettings {
  togglePanel: string;
  openSearch: string;
}

export interface ThemeSettings {
  sidebarCollapsed: boolean;
}

export interface Settings {
  quickLink: QuickLinkSettings;
  shortcuts: ShortcutsSettings;
  theme: ThemeSettings;
}

export const defaultSettings: Settings = {
  quickLink: {
    panelDefaultOpen: false,
    openInNewTab: true,
  },
  shortcuts: {
    togglePanel: 'Ctrl+Shift+K',
    openSearch: 'Ctrl+K',
  },
  theme: {
    sidebarCollapsed: false,
  },
};
