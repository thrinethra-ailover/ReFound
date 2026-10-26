import { useToast } from '../../hooks/useToast';

const VARIANT_STYLES: Record<string, string> = {
  success: 'bg-signal text-white',
  error: 'bg-coral text-white',
  info: 'bg-ink text-white',
};

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm sm:w-full"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`${VARIANT_STYLES[toast.variant]} rounded-card shadow-card-hover px-4 py-3 text-sm font-medium flex items-start justify-between gap-3 animate-[fadeIn_0.2s_ease-out]`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="opacity-80 hover:opacity-100 leading-none text-lg"
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
