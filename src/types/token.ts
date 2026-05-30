export interface Token {
  id: number;
  provider: string;
  name: string;
  token_value: string;
  group_name: string | null;
  token_type: string | null;
  mask_prefix_len: number;
  mask_suffix_len: number;
  expires_at: string | null;
  remark: string | null;
  user_id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  category: string | null;
}

export interface TokenFormValues {
  provider: string;
  name: string;
  token_value: string;
  group_name?: string;
  token_type?: string;
  category?: string;
  mask_prefix_len?: number;
  mask_suffix_len?: number;
  expires_at?: string;
  remark?: string;
}

export interface TokenQueryParams {
  page?: number;
  page_size?: number;
  provider?: string;
  group_name?: string;
  category?: string;
  keyword?: string;
}
