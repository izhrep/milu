import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        error: 'border-transparent bg-error text-error-foreground',
        brand: 'border-transparent bg-brand-orange text-brand-orange-foreground',
        purple: 'border-transparent bg-brand-purple text-brand-purple-foreground',
        outline: 'border-border text-foreground',
        ghost: 'border-transparent text-foreground hover:bg-interactive-bg'
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm'
      },
      status: {
        none: '',
        active: 'animate-pulse',
        inactive: 'opacity-60'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      status: 'none'
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
  removable?: boolean;
  onRemove?: () => void;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, status, icon, removable, onRemove, children, ...props }, ref) => {
    return (
      <div className={cn(badgeVariants({ variant, size, status }), className)} ref={ref} {...props}>
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span className="truncate">{children}</span>
        {removable && (
          <button
            type="button"
            className="ml-1 flex-shrink-0 rounded-full p-0.5 hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-current"
            onClick={onRemove}
            aria-label="Remove badge"
          >
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };