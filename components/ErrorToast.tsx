import React, { useEffect, useState } from 'react';
import { AlertCircle, X, RefreshCw } from 'lucide-react';

interface ErrorToastProps {
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
  autoHide?: boolean;
  duration?: number;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  message,
  onDismiss,
  onRetry,
  autoHide = true,
  duration = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration, onDismiss]);

  return (
    <div
      className={`fixed bottom-24 right-8 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 shadow-2xl backdrop-blur-md max-w-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{message}</p>
          </div>
          <button
            onClick={onDismiss}
            className="text-[#80808a] hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
          >
            <RefreshCw size={12} />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

// Hook for managing error state
export function useErrorToast() {
  const [error, setError] = useState<string | null>(null);
  const [retryFn, setRetryFn] = useState<(() => void) | null>(null);

  const showError = (message: string, retry?: () => void) => {
    setError(message);
    setRetryFn(() => retry || null);
  };

  const hideError = () => {
    setError(null);
    setRetryFn(null);
  };

  const ErrorComponent = error ? (
    <ErrorToast
      message={error}
      onDismiss={hideError}
      onRetry={retryFn || undefined}
    />
  ) : null;

  return { showError, hideError, ErrorComponent };
}

export default ErrorToast;

