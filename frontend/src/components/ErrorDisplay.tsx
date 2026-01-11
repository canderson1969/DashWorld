import { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { LogEntry } from '../utils/logger';
import { getUserFriendlyErrorMessage } from '../utils/errors';

interface ErrorDisplayProps {
  error?: Error | null;
  onDismiss?: () => void;
  dismissible?: boolean;
}

/**
 * Display error message to user
 *
 * @param {ErrorDisplayProps} props - Component props
 * @returns {JSX.Element | null} Error display component
 */
export const ErrorDisplay = ({ error, onDismiss, dismissible = true }: ErrorDisplayProps) => {
  if (!error) return null;

  const message = getUserFriendlyErrorMessage(error);

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <h3 className="text-red-800 dark:text-red-200 font-semibold mb-1">Error</h3>
          <p className="text-red-700 dark:text-red-300 text-sm">{message}</p>
          {import.meta.env.DEV && error.stack && (
            <details className="mt-2">
              <summary className="text-red-600 dark:text-red-400 text-xs cursor-pointer">
                Technical Details (Dev Only)
              </summary>
              <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900/40 p-2 rounded overflow-x-auto text-red-800 dark:text-red-200">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            aria-label="Dismiss error"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Global error toast that listens for error events
 *
 * @returns {JSX.Element} Global error toast component
 */
export const GlobalErrorToast = () => {
  const [errors, setErrors] = useState<LogEntry[]>([]);

  useEffect(() => {
    const handleError = (event: CustomEvent<LogEntry>) => {
      setErrors((prev) => [...prev, event.detail]);

      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        setErrors((prev) => prev.filter((e) => e !== event.detail));
      }, 10000);
    };

    window.addEventListener('dash-world-error', handleError as EventListener);

    return () => {
      window.removeEventListener('dash-world-error', handleError as EventListener);
    };
  }, []);

  const dismissError = (entry: LogEntry) => {
    setErrors((prev) => prev.filter((e) => e !== entry));
  };

  if (errors.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {errors.map((entry, index) => (
        <div
          key={`${entry.timestamp}-${index}`}
          className="bg-red-50 dark:bg-red-900/90 border border-red-200 dark:border-red-800 rounded-lg p-4 shadow-lg animate-slide-in-right"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="text-red-800 dark:text-red-200 font-semibold mb-1">Error</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{entry.message}</p>
              {entry.context && Object.keys(entry.context).length > 0 && import.meta.env.DEV && (
                <details className="mt-2">
                  <summary className="text-red-600 dark:text-red-400 text-xs cursor-pointer">
                    Details
                  </summary>
                  <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900/40 p-2 rounded overflow-x-auto text-red-800 dark:text-red-200">
                    {JSON.stringify(entry.context, null, 2)}
                  </pre>
                </details>
              )}
            </div>
            <button
              onClick={() => dismissError(entry)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              aria-label="Dismiss error"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
