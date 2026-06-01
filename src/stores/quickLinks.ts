import { create } from 'zustand';
import type { Workspace, QuickLink, CreateLinkParams, UpdateLinkParams } from '@/types/quickLink';
import * as workspaceApi from '@/services/workspace';
import * as quickLinkApi from '@/services/quickLink';

interface QuickLinkStore {
  workspaces: Workspace[];
  currentWorkspaceId: number | null;
  links: QuickLink[];
  panelVisible: boolean;
  searchKeyword: string;
  loading: boolean;

  fetchWorkspaces: () => Promise<void>;
  fetchLinks: (workspaceId?: number) => Promise<void>;
  setCurrentWorkspace: (id: number) => void;
  setSearchKeyword: (keyword: string) => void;
  togglePanel: () => void;
  closePanel: () => void;
  setPanelVisible: (visible: boolean) => void;

  createLink: (data: CreateLinkParams) => Promise<void>;
  updateLink: (id: number, data: UpdateLinkParams) => Promise<void>;
  deleteLink: (id: number) => Promise<void>;
  removeLinkFromWorkspace: (linkId: number, workspaceId: number) => Promise<void>;
  batchAssignWorkspace: (linkIds: number[], workspaceId: number) => Promise<void>;

  createWorkspace: (name: string) => Promise<void>;
  updateWorkspace: (id: number, name: string) => Promise<void>;
  deleteWorkspace: (id: number) => Promise<void>;
}

const WS_KEY = 'forge_current_workspace';

export const useQuickLinkStore = create<QuickLinkStore>((set, get) => ({
  workspaces: [],
  currentWorkspaceId: null,
  links: [],
  panelVisible: false,
  searchKeyword: '',
  loading: false,

  fetchWorkspaces: async () => {
    const workspaces = await workspaceApi.getWorkspaces();
    set({ workspaces });
    const { currentWorkspaceId } = get();
    if (!currentWorkspaceId && workspaces.length > 0) {
      const savedId = Number(localStorage.getItem(WS_KEY));
      const saved = savedId && workspaces.find((w) => w.id === savedId);
      const fallback = saved || workspaces.find((w) => w.is_default) || workspaces[0];
      set({ currentWorkspaceId: fallback.id });
    }
  },

  fetchLinks: async (workspaceId?: number) => {
    set({ loading: true });
    try {
      const wsId = workspaceId ?? get().currentWorkspaceId;
      const links = await quickLinkApi.getQuickLinks(wsId ? { workspace_id: wsId } : undefined);
      set({ links });
    } finally {
      set({ loading: false });
    }
  },

  setCurrentWorkspace: (id) => {
    localStorage.setItem(WS_KEY, String(id));
    set({ currentWorkspaceId: id, searchKeyword: '' });
    get().fetchLinks(id);
  },

  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),

  togglePanel: () => {
    const { panelVisible, workspaces, fetchLinks } = get();
    if (!panelVisible && workspaces.length === 0) {
      get().fetchWorkspaces().then(() => fetchLinks());
    } else if (!panelVisible) {
      fetchLinks();
    }
    set({ panelVisible: !panelVisible, searchKeyword: '' });
  },

  closePanel: () => set({ panelVisible: false, searchKeyword: '' }),

  setPanelVisible: (visible) => {
    if (visible) {
      const { workspaces, fetchLinks } = get();
      if (workspaces.length === 0) {
        get().fetchWorkspaces().then(() => fetchLinks());
      } else {
        fetchLinks();
      }
    }
    set({ panelVisible: visible, searchKeyword: '' });
  },

  createLink: async (data) => {
    await quickLinkApi.createQuickLink(data);
    await get().fetchLinks();
  },

  updateLink: async (id, data) => {
    await quickLinkApi.updateQuickLink(id, data);
    await get().fetchLinks();
  },

  deleteLink: async (id) => {
    await quickLinkApi.deleteQuickLink(id);
    await get().fetchLinks();
  },

  removeLinkFromWorkspace: async (linkId, workspaceId) => {
    await quickLinkApi.removeLinkFromWorkspace(linkId, workspaceId);
    await get().fetchLinks();
  },

  batchAssignWorkspace: async (linkIds, workspaceId) => {
    await Promise.all(
      linkIds.map((id) => {
        const link = get().links.find((l) => l.id === id);
        const existing = link?.workspaces || [];
        const workspace_ids = [...new Set([...existing, workspaceId])];
        return quickLinkApi.updateQuickLink(id, { workspace_ids });
      }),
    );
    await get().fetchLinks();
  },

  createWorkspace: async (name) => {
    await workspaceApi.createWorkspace(name);
    await get().fetchWorkspaces();
  },

  updateWorkspace: async (id, name) => {
    await workspaceApi.updateWorkspace(id, { name });
    await get().fetchWorkspaces();
  },

  deleteWorkspace: async (id) => {
    await workspaceApi.deleteWorkspace(id);
    const { currentWorkspaceId, workspaces } = get();
    if (currentWorkspaceId === id) {
      const fallback = workspaces.find((w) => w.id !== id);
      const newId = fallback?.id ?? null;
      set({ currentWorkspaceId: newId });
      if (newId) localStorage.setItem(WS_KEY, String(newId));
      else localStorage.removeItem(WS_KEY);
    }
    await get().fetchWorkspaces();
  },
}));
