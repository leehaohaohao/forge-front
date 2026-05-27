export interface Token {
  id: number;
  provider: string;
  name: string;
  token_value: string;
  group_name: string;
  token_type: string;
  expires_at: string | null;
  remark: string;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface TokenFormValues {
  provider: string;
  name: string;
  token_value: string;
  group_name?: string;
  token_type?: string;
  expires_at?: string;
  remark?: string;
}

export interface TokenQueryParams {
  page?: number;
  page_size?: number;
  provider?: string;
  group_name?: string;
  keyword?: string;
}
