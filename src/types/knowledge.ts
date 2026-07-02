export interface Space {
  id: number;
  name: string;
  description: string;
  icon: string;
  user_id: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: number;
  name: string;
  space_id: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: number;
  title: string;
  content: string;
  summary: string;
  tags: string[];
  space_id: number | null;
  folder_id: number | null;
  user_id: number;
  status: number; // 0草稿 1发布 2归档
  visibility: number; // 0私有 1公开
  is_pinned: boolean;
  view_count: number;
  like_count: number;
  comment_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  content: string;
  document_id: number;
  user_id: number;
  parent_id: number;
  reply_to_user_id: number | null;
  created_at: string;
  children?: Comment[];
}

export interface DocumentDetail {
  document: Document;
  is_liked: boolean;
  is_favorited: boolean;
}

export interface DocumentFormValues {
  title: string;
  content?: string;
  summary?: string;
  tags?: string[];
  space_id?: number | null;
  folder_id?: number | null;
  visibility?: number;
  status?: number;
}

export interface DocumentQueryParams {
  page?: number;
  page_size?: number;
  space_id?: number;
  folder_id?: number;
  keyword?: string;
  status?: number;
  tag?: string;
}

export interface SquareQueryParams {
  page?: number;
  page_size?: number;
  keyword?: string;
}
