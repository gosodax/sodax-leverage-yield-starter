import type { ReactNode } from 'react';

/** A labelled form control. Pass `htmlFor` for a native input; Radix selects label themselves with aria-label. */
export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  const className = 'text-sm font-medium';
  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={className}>
          {label}
        </label>
      ) : (
        <span className={className}>{label}</span>
      )}
      {children}
    </div>
  );
}
