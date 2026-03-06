import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90 active:scale-95',
        primary: 'bg-primary text-primary-foreground hover:opacity-90 active:scale-95',
        secondary: 'bg-surface border border-border text-foreground hover:bg-surface-secondary active:scale-95',
        brand: 'bg-brand-orange text-brand-orange-foreground hover:opacity-90 active:scale-95',
        purple: 'bg-brand-purple text-brand-purple-foreground hover:opacity-90 active:scale-95',
        success: 'bg-success text-success-foreground hover:opacity-90 active:scale-95',
        destructive: 'bg-error text-error-foreground hover:opacity-90 active:scale-95',
        outline: 'border border-border bg-transparent text-foreground hover:bg-interactive-bg active:scale-95',
        ghost: 'bg-transparent text-foreground hover:bg-interactive-bg active:scale-95',
        link: 'text-brand-orange underline-offset-4 hover:underline p-0 h-auto'
      },
      size: {
        default: 'h-12 px-6 py-3',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-14 px-8 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12'
      },
      rounded: {
        default: 'rounded-full',
        sm: 'rounded-lg',
        md: 'rounded-xl',
        lg: 'rounded-2xl',
        none: 'rounded-none'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      rounded: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      rounded,
      asChild = false,
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, rounded, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText || children}
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };