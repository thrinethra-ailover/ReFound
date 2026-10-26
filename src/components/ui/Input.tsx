import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={`rounded-lg border px-3 py-2.5 text-sm bg-white text-ink placeholder:text-slate-light transition-colors ${
            error ? 'border-coral' : 'border-border focus:border-signal'
          } ${className}`}
          {...rest}
        />
        {hint && !error && (
          <span id={hintId} className="text-xs text-slate">
            {hint}
          </span>
        )}
        {error && (
          <span id={errorId} className="text-xs text-coral-dark">
            {error}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
