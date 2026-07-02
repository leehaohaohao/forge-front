import api, { type ApiResponse, type PageData } from '@/lib/api';
import type {
  Space,
  Folder,
  Document,
  Comment,
  DocumentFormValues,
  DocumentQueryParams,
  SquareQueryParams,
} from '@/types/knowledge';

// ========== 空间 ==========

export async function getSpaces() {
  const res = await api.get<ApiResponse<Space[]>>('/knowledge/space');
  return res.data.data;
}

export async function createSpace(data: Partial<Space>) {
  const res = await api.post<ApiResponse<Space>>('/knowledge/space', data);
  return res.data.data;
}

export async function updateSpace(id: number, data: Partial<Space>) {
  const res = await api.put<ApiResponse<Space>>(`/knowledge/space/${id}`, data);
  return res.data.data;
}

export async function deleteSpace(id: number) {
  await api.delete(`/knowledge/space/${id}`);
}

// ========== 文件夹 ==========

export async function getFolders(spaceId: number) {
  const res = await api.get<ApiResponse<Folder[]>>(`/knowledge/space/${spaceId}/folder`);
  return res.data.data;
}

export async function createFolder(spaceId: number, data: Partial<Folder>) {
  const res = await api.post<ApiResponse<Folder>>(`/knowledge/space/${spaceId}/folder`, data);
  return res.data.data;
}

export async function updateFolder(id: number, data: Partial<Folder>) {
  const res = await api.put<ApiResponse<Folder>>(`/knowledge/folder/${id}`, data);
  return res.data.data;
}

export async function deleteFolder(id: number) {
  await api.delete(`/knowledge/folder/${id}`);
}

// ========== 文档 ==========

export async function getDocuments(params?: DocumentQueryParams) {
  const res = await api.get<ApiResponse<PageData<Document>>>('/knowledge/document', { params });
  const { list, total } = res.data.data;
  return { data: list, total };
}

export async function getRootDocuments(params?: { page?: number; page_size?: number }) {
  const res = await api.get<ApiResponse<PageData<Document>>>('/knowledge/document/root', { params });
  const { list, total } = res.data.data;
  return { data: list, total };
}

export async function getDocument(id: number) {
  const res = await api.get<ApiResponse<Document>>(`/knowledge/document/${id}`);
  return res.data.data;
}

export async function createDocument(data: DocumentFormValues) {
  const res = await api.post<ApiResponse<Document>>('/knowledge/document', data);
  return res.data.data;
}

export async function updateDocument(id: number, data: Partial<DocumentFormValues>) {
  const res = await api.put<ApiResponse<Document>>(`/knowledge/document/${id}`, data);
  return res.data.data;
}

export async function deleteDocument(id: number) {
  await api.delete(`/knowledge/document/${id}`);
}

export async function publishDocument(id: number) {
  const res = await api.put<ApiResponse<Document>>(`/knowledge/document/${id}/publish`);
  return res.data.data;
}

export async function unpublishDocument(id: number) {
  const res = await api.put<ApiResponse<Document>>(`/knowledge/document/${id}/unpublish`);
  return res.data.data;
}

export async function pinDocument(id: number) {
  const res = await api.put<ApiResponse<Document>>(`/knowledge/document/${id}/pin`);
  return res.data.data;
}

export async function getRecentDocuments(params?: { page?: number; page_size?: number }) {
  const res = await api.get<ApiResponse<PageData<Document>>>('/knowledge/document/recent', { params });
  const { list, total } = res.data.data;
  return { data: list, total };
}

export async function getFavoriteDocuments(params?: { page?: number; page_size?: number }) {
  const res = await api.get<ApiResponse<PageData<Document>>>('/knowledge/document/favorites', { params });
  const { list, total } = res.data.data;
  return { data: list, total };
}

// ========== 互动 ==========

export async function likeDocument(id: number) {
  await api.post(`/knowledge/document/${id}/like`);
}

export async function unlikeDocument(id: number) {
  await api.delete(`/knowledge/document/${id}/like`);
}

export async function favoriteDocument(id: number) {
  await api.post(`/knowledge/document/${id}/favorite`);
}

export async function unfavoriteDocument(id: number) {
  await api.delete(`/knowledge/document/${id}/favorite`);
}

export async function getComments(documentId: number) {
  const res = await api.get<ApiResponse<Comment[]>>(`/knowledge/document/${documentId}/comment`);
  return res.data.data;
}

export async function createComment(documentId: number, data: { content: string; parent_id?: number; reply_to_user_id?: number }) {
  const res = await api.post<ApiResponse<Comment>>(`/knowledge/document/${documentId}/comment`, data);
  return res.data.data;
}

export async function deleteComment(id: number) {
  await api.delete(`/knowledge/comment/${id}`);
}

// ========== 广场 ==========

export async function getSquareLatest(params?: SquareQueryParams) {
  const res = await api.get<ApiResponse<PageData<Document>>>('/knowledge/square/latest', { params });
  const { list, total } = res.data.data;
  return { data: list, total };
}

export async function getSquareHot(params?: SquareQueryParams) {
  const res = await api.get<ApiResponse<PageData<Document>>>('/knowledge/square/hot', { params });
  const { list, total } = res.data.data;
  return { data: list, total };
}

export async function getSquareSearch(params?: SquareQueryParams) {
  const res = await api.get<ApiResponse<PageData<Document>>>('/knowledge/square/search', { params });
  const { list, total } = res.data.data;
  return { data: list, total };
}

export async function getSquareDocument(id: number) {
  const res = await api.get<ApiResponse<Document>>(`/knowledge/square/document/${id}`);
  return res.data.data;
}
