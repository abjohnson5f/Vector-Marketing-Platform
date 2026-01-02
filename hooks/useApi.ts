import { useState, useEffect, useCallback } from 'react';
import { ApiError } from '../services/api';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiOptions {
  immediate?: boolean;
  onError?: (error: string) => void;
}

/**
 * Custom hook for API calls with loading and error states
 */
export function useApi<T>(
  apiFn: () => Promise<T>,
  deps: any[] = [],
  options: UseApiOptions = {}
) {
  const { immediate = true, onError } = options;
  
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await apiFn();
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      const message = err instanceof ApiError 
        ? err.message 
        : err instanceof Error 
          ? err.message 
          : 'An unexpected error occurred';
      
      setState(prev => ({ ...prev, loading: false, error: message }));
      onError?.(message);
      throw err;
    }
  }, deps);

  useEffect(() => {
    if (immediate) {
      execute().catch(() => {}); // Error handled in state
    }
  }, [execute, immediate]);

  const refetch = useCallback(() => {
    return execute();
  }, [execute]);

  return {
    ...state,
    refetch,
    execute,
  };
}

/**
 * Hook for mutation operations (POST, PUT, DELETE)
 */
export function useMutation<T, P = void>(
  mutationFn: (params: P) => Promise<T>,
  options: { onSuccess?: (data: T) => void; onError?: (error: string) => void } = {}
) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: false,
    error: null,
  });

  const mutate = useCallback(async (params: P) => {
    setState({ data: null, loading: true, error: null });
    
    try {
      const data = await mutationFn(params);
      setState({ data, loading: false, error: null });
      options.onSuccess?.(data);
      return data;
    } catch (err) {
      const message = err instanceof ApiError 
        ? err.message 
        : err instanceof Error 
          ? err.message 
          : 'An unexpected error occurred';
      
      setState(prev => ({ ...prev, loading: false, error: message }));
      options.onError?.(message);
      throw err;
    }
  }, [mutationFn, options.onSuccess, options.onError]);

  return {
    ...state,
    mutate,
    reset: () => setState({ data: null, loading: false, error: null }),
  };
}

export default useApi;

