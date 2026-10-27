import axios, { type AxiosResponse } from 'axios';

export type ApiErrorKind = 'account' | 'disabled' | 'registered' | 'parameters' | 'unavailable' | 'unauthorized' | 'reauth' | 'forbidden' | 'not-found' | 'conflict' | 'rate-limit' | 'network' | 'canceled' | 'unknown';

// Deliberately exclude raw response text, request bodies and Authorization headers.
export class ApiError extends Error {
  readonly name = 'ApiError';
  constructor(
    public readonly kind: ApiErrorKind,
    public readonly httpStatus?: number,
    public readonly businessCode?: number,
    public readonly requestId?: string,
    public readonly retryAfterSeconds?: number,
  ) { super(kind); }
}

export function normalizeApiError(error: unknown, response?: AxiosResponse): ApiError {
  if (error instanceof ApiError) return error;
  const transport = axios.isAxiosError(error) ? error : undefined;
  const res = response ?? transport?.response;
  const status = res?.status;
  const data = res?.data;
  const code = Number.isSafeInteger(data?.code) ? data.code as number : undefined;
  const id = res?.headers?.['x-request-id'] ?? data?.request_id;
  const requestId = typeof id === 'string' ? id : undefined;
  const path = res?.config?.url?.split('?')[0];
  let kind: ApiErrorKind = 'unknown';
  if (axios.isCancel(error)) kind = 'canceled';
  else if (code === 40101) kind = 'reauth';
  else if (status === 401 || code === 401) kind = 'unauthorized';
  else if ((status !== undefined && status >= 500) || (code !== undefined && code >= 500 && code <= 599)) kind = 'unavailable';
  else if (status === 429 || code === 429) kind = 'rate-limit';
  else if (status === 403 || code === 403) kind = 'forbidden';
  else if (status === 404 || code === 404) kind = 'not-found';
  else if (status === 409 || code === 409 || (code !== undefined && code >= 40900 && code <= 40999)) kind = 'conflict';
  else if (status === 400 || status === 422 || code === 400 || code === 422) {
    // Legacy auth APIs share code 400. Match only these known messages and routes;
    // never render arbitrary backend exceptions or validation details.
    if (path === '/auth/login' && data?.message === '手机号或密码错误') kind = 'account';
    else if (path === '/auth/login' && data?.message === '账号已被禁用') kind = 'disabled';
    else if (path === '/auth/register' && data?.message === '该手机号已注册！') kind = 'registered';
    else kind = 'parameters';
  } else if (!res && transport) kind = 'network';
  const retry = res?.headers?.['retry-after'];
  const seconds=typeof retry==='string' && /^\d+$/.test(retry)?Number(retry):typeof retry==='string'?Math.ceil((Date.parse(retry)-Date.now())/1000):undefined;
  return new ApiError(kind,status,code,requestId,seconds!==undefined && Number.isFinite(seconds) && seconds>=0?seconds:undefined);
}

const safeMessages: Record<ApiErrorKind,string> = {
  account:'手机号或密码错误',
  disabled:'账号已被禁用，请联系管理员',
  registered:'该手机号已注册，请直接登录',
  parameters:'请求参数不正确，请检查输入后重试',
  unavailable:'服务暂时不可用，请稍后重试',
  unauthorized:'登录已失效，请重新登录',
  reauth:'身份验证失败，请检查账号密码后重试',
  forbidden:'没有权限执行此操作',
  'not-found':'请求的内容不存在或已删除',
  conflict:'数据已变化，请刷新后重试',
  'rate-limit':'请求过于频繁，请稍后重试',
  network:'网络连接失败，请检查网络后重试',
  canceled:'操作已取消',
  unknown:'请求未完成，请稍后重试',
};
export function apiErrorMessage(error: unknown): string {
  return safeMessages[normalizeApiError(error).kind];
}
