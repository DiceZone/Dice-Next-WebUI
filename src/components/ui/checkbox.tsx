import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}
/** Keyboard-accessible, styled checkbox without an additional runtime package. */
export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { checked, onCheckedChange, className, onClick, disabled, ...props }, ref,
) {
  return <button {...props} ref={ref} type="button" role="checkbox" aria-checked={checked} disabled={disabled}
    className={cn('inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', checked && 'bg-primary text-primary-foreground', className)}
    onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) onCheckedChange(!checked); }}>
    {checked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
  </button>;
});
