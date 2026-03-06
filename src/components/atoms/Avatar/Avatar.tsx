import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

const avatarVariants = cva(
  'relative flex shrink-0 overflow-hidden rounded-full border-2 border-background',
  {
    variants: {
      size: {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
        xl: 'h-14 w-14',
        '2xl': 'h-16 w-16',
        '3xl': 'h-20 w-20'
      },
      status: {
        none: '',
        online: 'ring-2 ring-success',
        offline: 'ring-2 ring-text-tertiary',
        busy: 'ring-2 ring-warning',
        away: 'ring-2 ring-brand-orange'
      }
    },
    defaultVariants: {
      size: 'md',
      status: 'none'
    }
  }
);

const avatarImageVariants = cva(
  'aspect-square h-full w-full object-cover transition-all',
  {
    variants: {
      loading: {
        true: 'opacity-0',
        false: 'opacity-100'
      }
    },
    defaultVariants: {
      loading: false
    }
  }
);

const avatarFallbackVariants = cva(
  'flex h-full w-full items-center justify-center bg-muted text-muted-foreground font-medium',
  {
    variants: {
      size: {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
        xl: 'text-lg',
        '2xl': 'text-xl',
        '3xl': 'text-2xl'
      }
    },
    defaultVariants: {
      size: 'md'
    }
  }
);

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  fallback?: string;
  className?: string;
  onClick?: () => void;
  loading?: boolean;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt, fallback, size, status, className, onClick, loading = false, ...props }, ref) => {
    const [imageLoaded, setImageLoaded] = React.useState(false);
    const [imageError, setImageError] = React.useState(false);

    const handleImageLoad = () => {
      setImageLoaded(true);
    };

    const handleImageError = () => {
      setImageError(true);
      setImageLoaded(false);
    };

    const getFallbackText = () => {
      if (fallback) return fallback;
      if (alt) {
        return alt
          .split(' ')
          .map(word => word[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
      }
      return '';
    };

    const showImage = src && !imageError && imageLoaded;
    const showFallback = !src || imageError || !imageLoaded;

    return (
      <div
        ref={ref}
        className={cn(
          avatarVariants({ size, status }),
          onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
          className
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        {...props}
      >
        {src && (
          <img
            src={src}
            alt={alt}
            className={cn(avatarImageVariants({ loading: loading || !imageLoaded }))}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
        
        {showFallback && (
          <div className={cn(avatarFallbackVariants({ size }))}>
            {getFallbackText() || <User className="h-1/2 w-1/2" />}
          </div>
        )}

        {/* Status indicator */}
        {status && status !== 'none' && (
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-current" />
        )}

        {/* Loading state */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export { Avatar, avatarVariants };