import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, id, className = '', ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={`rounded-lg border px-3 py-2.5 text-sm bg-white text-ink placeholder:text-slate-light transition-colors resize-y min-h-[100px] ${
            error ? 'border-coral' : 'border-border focus:border-signal'
          } ${className}`}
          {...rest}
        />
        {hint && !error && <span className="text-xs text-slate">{hint}</span>}
        {error && <span className="text-xs text-coral-dark">{error}</span>}
      </div>
    );
  }
);
TextArea.displayName = 'TextArea';
