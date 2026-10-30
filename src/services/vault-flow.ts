import api, {type ApiResponse} from '@/lib/api';
import {parseFlowStatus} from '@/lib/vault/flow';
export async function readFlowStatus(signal:AbortSignal) {
  return parseFlowStatus(
    (await api.get<ApiResponse<unknown>>('/vault/migration-status', {
      signal,
      params: { contract: 'self-service-v1' },
    })).data.data,
  );
}
