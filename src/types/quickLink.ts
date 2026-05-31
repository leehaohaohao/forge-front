export interface Workspace {
  id: number;
  name: string;
  is_default: boolean;
  sort_order: number;
}

export interface QuickLink {
  id: number;
  name: string;
  url: string;
  icon: string;
  category: string;
  sort_order: number;
  workspaces: number[];
}

export interface CreateLinkParams {
  name: string;
  url: string;
  icon?: string;
  category?: string;
  workspace_ids: number[];
  sort_order?: number;
}

export interface UpdateLinkParams {
  name?: string;
  url?: string;
  icon?: string;
  category?: string;
  workspace_ids?: number[];
  sort_order?: number;
}
