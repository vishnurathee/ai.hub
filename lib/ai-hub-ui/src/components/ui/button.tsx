import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

function buttonVariants({
  variant = 'default',
  size = 'default',
}: Pick<ButtonProps, 'variant' | 'size'> = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    {
      'bg-primary-600 text-white hover:bg-primary-700': variant === 'default',
      'border border-slate-300 text-slate-700 hover:bg-slate-50': variant === 'outline',
      'hover:bg-slate-100 text-slate-700': variant === 'ghost',
      'underline-offset-4 hover:underline text-primary-600': variant === 'link',
    },
    {
      'h-10 px-4 py-2': size === 'default',
      'h-9 rounded-md px-3': size === 'sm',
      'h-11 rounded-md px-8': size === 'lg',
      'h-10 w-10': size === 'icon',
    },
  );
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };