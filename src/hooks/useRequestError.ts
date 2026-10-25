import { useCallback } from 'react';
import { App } from 'antd';
import { ApiError, apiErrorMessage } from '@/lib/api-error';

// UI boundaries own notifications; stores propagate failures and never toast.
export function useRequestError() {
  const { message } = App.useApp();
  return useCallback((error: unknown) => {
    if (error instanceof ApiError && ['canceled','unauthorized'].includes(error.kind)) return;
    // Ant Design has already rendered field validation errors inline.
    if (error && typeof error === 'object' && 'errorFields' in error) return;
    void message.error(apiErrorMessage(error));
  }, [message]);
}
