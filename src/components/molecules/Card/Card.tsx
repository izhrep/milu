import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'rounded-lg border bg-card text-card-foreground',
  {
    variants: {
      variant: {
        default: 'bg-surface border-border shadow-sm',
        elevated: 'bg-surface border-border shadow-card',
        outlined: 'bg-transparent border-border border-2',
        filled: 'bg-surface-secondary border-transparent',
        gradient: 'bg-gradient-to-br border-transparent text-white',
        success: 'bg-success border-transparent text-success-foreground',
        warning: 'bg-warning border-transparent text-warning-foreground',
        error: 'bg-error border-transparent text-error-foreground'
      },
      size: {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8'
      },
      radius: {
        sm: 'rounded-lg',
        md: 'rounded-xl',
        lg: 'rounded-2xl'
      },
      interactive: {
        true: 'cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      radius: 'lg',
      interactive: false
    }
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, radius, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, size, radius, interactive }), className)}
      {...props}
    />
  )
);

Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5', className)}
    {...props}
  />
));

CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('font-semibold leading-none tracking-tight', className)}
    {...props}
  >
    {children}
  </h3>
));

CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-text-secondary', className)}
    {...props}
  />
));

CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('', className)} {...props} />
));

CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center pt-6', className)}
    {...props}
  />
));

CardFooter.displayName = 'CardFooter';

// Specialized card components

interface LearningCardProps extends CardProps {
  type: string;
  title: string;
  status: string;
  dates: string;
  format?: string;
  mentor?: string;
  progress?: {
    percentage: number;
    description: string;
  };
  isCompleted?: boolean;
  completionDate?: string;
  currentStage?: string;
  gradientFrom?: string;
  gradientTo?: string;
}

const LearningCard = React.forwardRef<HTMLDivElement, LearningCardProps>(
  ({
    type,
    title,
    status,
    dates,
    format,
    mentor,
    progress,
    isCompleted,
    completionDate,
    currentStage,
    gradientFrom = 'from-purple-600',
    gradientTo = 'to-blue-600',
    className,
    ...props
  }, ref) => {
    const cardStyle = isCompleted
      ? 'border border-brand-orange bg-surface text-foreground'
      : `bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white`;

    return (
      <Card
        ref={ref}
        className={cn(cardStyle, 'min-w-60 flex-1', className)}
        {...props}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <span className={cn(
              'text-xs font-semibold',
              isCompleted ? 'text-text-secondary' : 'text-white/70'
            )}>
              {type}
            </span>
            <span className={cn(
              'text-xs font-medium',
              isCompleted ? 'text-foreground' : 'text-white'
            )}>
              {status}
            </span>
          </div>
          <CardTitle className={cn(
            'text-2xl leading-tight tracking-tight',
            isCompleted ? 'text-foreground' : 'text-white'
          )}>
            {title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-2">
          <div className="space-y-1 text-xs">
            <div className="flex gap-1">
              <span className={cn(
                isCompleted ? 'text-text-secondary' : 'text-white/50'
              )}>
                {isCompleted ? 'Дата завершения:' : 'Сроки:'}
              </span>
              <span className={cn(
                isCompleted ? 'text-foreground' : 'text-white'
              )}>
                {isCompleted ? completionDate : dates}
              </span>
            </div>
            
            {!isCompleted && format && (
              <div className="flex gap-1">
                <span className="text-white/50">Формат:</span>
                <span className="text-white">{format}</span>
              </div>
            )}
            
            {currentStage && (
              <div className="flex gap-1">
                <span className={cn(
                  isCompleted ? 'text-text-secondary' : 'text-white/50'
                )}>
                  Текущий этап:
                </span>
                <span className={cn(
                  isCompleted ? 'text-foreground' : 'text-white'
                )}>
                  {currentStage}
                </span>
              </div>
            )}
            
            {!isCompleted && mentor && (
              <div className="flex gap-1">
                <span className="text-white/50">Наставник:</span>
                <span className="text-white">{mentor}</span>
              </div>
            )}
          </div>

          {progress && (
            <div className={cn(
              'flex gap-2.5 items-start',
              isCompleted ? 'mt-8' : 'mt-4'
            )}>
              <div className={cn(
                'text-2xl font-bold leading-none',
                isCompleted ? 'text-foreground' : 'text-white'
              )}>
                {progress.percentage}%
              </div>
              <div className={cn(
                'text-xs font-medium leading-tight flex-1',
                isCompleted ? 'text-text-secondary' : 'text-white'
              )}>
                {progress.description}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

LearningCard.displayName = 'LearningCard';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  LearningCard,
  cardVariants
};