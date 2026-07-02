import { create } from 'zustand';
import type { Space, Folder, Document, Comment, DocumentFormValues, DocumentQueryParams } from '@/types/knowledge';
import * as knowledgeApi from '@/services/knowledge';

interface KnowledgeState {
  // 空间
  spaces: Space[];
  currentSpaceId: number | null;
  // 文件夹
  folders: Folder[];
  currentFolderId: number | null;
  // 文档
  documents: Document[];
  currentDocument: Document | null;
  loading: boolean;
  pagination: { current: number; pageSize: number; total: number };
  // 评论
  comments: Comment[];
  // Actions
  fetchSpaces: () => Promise<void>;
  createSpace: (data: Partial<Space>) => Promise<void>;
  updateSpace: (id: number, data: Partial<Space>) => Promise<void>;
  deleteSpace: (id: number) => Promise<void>;
  setCurrentSpace: (id: number | null) => void;

  fetchFolders: (spaceId: number) => Promise<void>;
  createFolder: (spaceId: number, data: Partial<Folder>) => Promise<void>;
  updateFolder: (id: number, data: Partial<Folder>) => Promise<void>;
  deleteFolder: (id: number) => Promise<void>;
  setCurrentFolder: (id: number | null) => void;

  fetchDocuments: (params?: DocumentQueryParams) => Promise<void>;
  fetchRootDocuments: () => Promise<void>;
  fetchDocument: (id: number) => Promise<Document>;
  createDocument: (data: DocumentFormValues) => Promise<void>;
  updateDocument: (id: number, data: Partial<DocumentFormValues>) => Promise<void>;
  deleteDocument: (id: number) => Promise<void>;
  publishDocument: (id: number) => Promise<void>;
  unpublishDocument: (id: number) => Promise<void>;
  pinDocument: (id: number) => Promise<void>;
  fetchRecentDocuments: () => Promise<void>;
  fetchFavoriteDocuments: () => Promise<void>;

  likeDocument: (id: number) => Promise<void>;
  unlikeDocument: (id: number) => Promise<void>;
  favoriteDocument: (id: number) => Promise<void>;
  unfavoriteDocument: (id: number) => Promise<void>;
  fetchComments: (documentId: number) => Promise<void>;
  createComment: (documentId: number, data: { content: string; parent_id?: number; reply_to_user_id?: number }) => Promise<void>;
  deleteComment: (id: number) => Promise<void>;

  setPagination: (pagination: Partial<{ current: number; pageSize: number }>) => void;
  clearDocument: () => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  spaces: [],
  currentSpaceId: null,
  folders: [],
  currentFolderId: null,
  documents: [],
  currentDocument: null,
  loading: false,
  pagination: { current: 1, pageSize: 10, total: 0 },
  comments: [],

  // ========== 空间 ==========

  fetchSpaces: async () => {
    const spaces = await knowledgeApi.getSpaces();
    set({ spaces });
  },

  createSpace: async (data) => {
    await knowledgeApi.createSpace(data);
    await get().fetchSpaces();
  },

  updateSpace: async (id, data) => {
    await knowledgeApi.updateSpace(id, data);
    await get().fetchSpaces();
  },

  deleteSpace: async (id) => {
    await knowledgeApi.deleteSpace(id);
    const { currentSpaceId } = get();
    if (currentSpaceId === id) {
      set({ currentSpaceId: null, currentFolderId: null });
    }
    await get().fetchSpaces();
  },

  setCurrentSpace: (id) => {
    set({ currentSpaceId: id, currentFolderId: null, pagination: { ...get().pagination, current: 1 } });
    if (id) {
      get().fetchFolders(id);
      get().fetchDocuments({ space_id: id });
    } else {
      set({ folders: [] });
      get().fetchRootDocuments();
    }
  },

  // ========== 文件夹 ==========

  fetchFolders: async (spaceId) => {
    const folders = await knowledgeApi.getFolders(spaceId);
    set({ folders });
  },

  createFolder: async (spaceId, data) => {
    await knowledgeApi.createFolder(spaceId, data);
    await get().fetchFolders(spaceId);
  },

  updateFolder: async (id, data) => {
    const { currentSpaceId } = get();
    await knowledgeApi.updateFolder(id, data);
    if (currentSpaceId) await get().fetchFolders(currentSpaceId);
  },

  deleteFolder: async (id) => {
    const { currentSpaceId, currentFolderId } = get();
    await knowledgeApi.deleteFolder(id);
    if (currentFolderId === id) {
      set({ currentFolderId: null });
    }
    if (currentSpaceId) await get().fetchFolders(currentSpaceId);
  },

  setCurrentFolder: (id) => {
    const { currentSpaceId, pagination } = get();
    set({ currentFolderId: id, pagination: { ...pagination, current: 1 } });
    if (id) {
      get().fetchDocuments({ folder_id: id });
    } else if (currentSpaceId) {
      get().fetchDocuments({ space_id: currentSpaceId });
    }
  },

  // ========== 文档 ==========

  fetchDocuments: async (params) => {
    set({ loading: true });
    try {
      const { pagination } = get();
      const res = await knowledgeApi.getDocuments({
        page: pagination.current,
        page_size: pagination.pageSize,
        ...params,
      });
      set({ documents: res.data, pagination: { ...pagination, total: res.total } });
    } finally {
      set({ loading: false });
    }
  },

  fetchRootDocuments: async () => {
    set({ loading: true });
    try {
      const { pagination } = get();
      const res = await knowledgeApi.getRootDocuments({
        page: pagination.current,
        page_size: pagination.pageSize,
      });
      set({ documents: res.data, pagination: { ...pagination, total: res.total } });
    } finally {
      set({ loading: false });
    }
  },

  fetchDocument: async (id) => {
    const doc = await knowledgeApi.getDocument(id);
    set({ currentDocument: doc });
    return doc;
  },

  createDocument: async (data) => {
    await knowledgeApi.createDocument(data);
    const { currentSpaceId, currentFolderId } = get();
    if (currentFolderId) {
      await get().fetchDocuments({ folder_id: currentFolderId });
    } else if (currentSpaceId) {
      await get().fetchDocuments({ space_id: currentSpaceId });
    } else {
      await get().fetchRootDocuments();
    }
  },

  updateDocument: async (id, data) => {
    await knowledgeApi.updateDocument(id, data);
    const { currentDocument } = get();
    if (currentDocument?.id === id) {
      await get().fetchDocument(id);
    }
  },

  deleteDocument: async (id) => {
    await knowledgeApi.deleteDocument(id);
    const { currentSpaceId, currentFolderId } = get();
    if (currentFolderId) {
      await get().fetchDocuments({ folder_id: currentFolderId });
    } else if (currentSpaceId) {
      await get().fetchDocuments({ space_id: currentSpaceId });
    } else {
      await get().fetchRootDocuments();
    }
  },

  publishDocument: async (id) => {
    await knowledgeApi.publishDocument(id);
    const { currentDocument } = get();
    if (currentDocument?.id === id) await get().fetchDocument(id);
  },

  unpublishDocument: async (id) => {
    await knowledgeApi.unpublishDocument(id);
    const { currentDocument } = get();
    if (currentDocument?.id === id) await get().fetchDocument(id);
  },

  pinDocument: async (id) => {
    await knowledgeApi.pinDocument(id);
    const { currentSpaceId, currentFolderId } = get();
    if (currentFolderId) {
      await get().fetchDocuments({ folder_id: currentFolderId });
    } else if (currentSpaceId) {
      await get().fetchDocuments({ space_id: currentSpaceId });
    } else {
      await get().fetchRootDocuments();
    }
  },

  fetchRecentDocuments: async () => {
    set({ loading: true });
    try {
      const { pagination } = get();
      const res = await knowledgeApi.getRecentDocuments({
        page: pagination.current,
        page_size: pagination.pageSize,
      });
      set({ documents: res.data, pagination: { ...pagination, total: res.total } });
    } finally {
      set({ loading: false });
    }
  },

  fetchFavoriteDocuments: async () => {
    set({ loading: true });
    try {
      const { pagination } = get();
      const res = await knowledgeApi.getFavoriteDocuments({
        page: pagination.current,
        page_size: pagination.pageSize,
      });
      set({ documents: res.data, pagination: { ...pagination, total: res.total } });
    } finally {
      set({ loading: false });
    }
  },

  // ========== 互动 ==========

  likeDocument: async (id) => {
    await knowledgeApi.likeDocument(id);
    const { currentDocument } = get();
    if (currentDocument?.id === id) await get().fetchDocument(id);
  },

  unlikeDocument: async (id) => {
    await knowledgeApi.unlikeDocument(id);
    const { currentDocument } = get();
    if (currentDocument?.id === id) await get().fetchDocument(id);
  },

  favoriteDocument: async (id) => {
    await knowledgeApi.favoriteDocument(id);
  },

  unfavoriteDocument: async (id) => {
    await knowledgeApi.unfavoriteDocument(id);
  },

  fetchComments: async (documentId) => {
    const comments = await knowledgeApi.getComments(documentId);
    set({ comments });
  },

  createComment: async (documentId, data) => {
    await knowledgeApi.createComment(documentId, data);
    await get().fetchComments(documentId);
    const { currentDocument } = get();
    if (currentDocument?.id === documentId) await get().fetchDocument(documentId);
  },

  deleteComment: async (id) => {
    await knowledgeApi.deleteComment(id);
  },

  // ========== 工具 ==========

  setPagination: (pagination) => {
    set((state) => ({ pagination: { ...state.pagination, ...pagination } }));
  },

  clearDocument: () => set({ currentDocument: null, comments: [] }),
}));
