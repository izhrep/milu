import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      h1: 'text-4xl font-bold tracking-tight lg:text-5xl',
      h2: 'text-3xl font-semibold tracking-tight',
      h3: 'text-2xl font-semibold tracking-tight',
      h4: 'text-xl font-semibold tracking-tight',
      h5: 'text-lg font-semibold',
      h6: 'text-base font-semibold',
      body: 'text-base',
      'body-sm': 'text-sm',
      label: 'text-sm font-medium',
      'label-sm': 'text-xs font-medium',
      caption: 'text-xs text-muted-foreground',
      muted: 'text-sm text-muted-foreground'
    },
    color: {
      default: '',
      primary: 'text-primary',
      secondary: 'text-secondary',
      tertiary: 'text-text-tertiary',
      accent: 'text-accent',
      muted: 'text-muted-foreground',
      destructive: 'text-destructive'
    }
  },
  defaultVariants: {
    variant: 'body',
    color: 'default'
  }
});

interface TextProps extends VariantProps<typeof textVariants> {
  className?: string;
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'label';
}

export const Text = forwardRef<HTMLElement, TextProps & React.HTMLAttributes<HTMLElement>>(
  ({ className, variant = 'body', color = 'default', as, children, ...props }, ref) => {
    const Component = as || (variant?.startsWith('h') ? variant as any : 'p');
    
    return React.createElement(
      Component,
      {
        className: cn(textVariants({ variant, color }), className),
        ref,
        ...props
      },
      children
    );
  }
);

Text.displayName = 'Text';

// Convenience components for common use cases
export const Heading = React.forwardRef<
  HTMLHeadingElement,
  Omit<TextProps, 'as'> & {
    level: 1 | 2 | 3 | 4 | 5 | 6;
  } & React.HTMLAttributes<HTMLElement>
>(({ level, variant, ...props }, ref) => {
  const headingVariant = variant || `h${level}` as any;
  
  return (
    <Text
      ref={ref}
      as={`h${level}` as any}
      variant={headingVariant}
      {...props}
    />
  );
});

Heading.displayName = 'Heading';