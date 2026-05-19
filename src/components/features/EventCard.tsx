import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarEvent } from '@/types';

interface EventCardProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
  className?: string;
}

const categoryConfig = {
  corporate_culture: {
    background: 'bg-success',
    textColor: 'text-success-foreground'
  },
  important: {
    background: 'bg-card',
    textColor: 'text-foreground'
  },
  work: {
    background: 'bg-accent',
    textColor: 'text-accent-foreground'
  },
  training: {
    background: 'bg-primary',
    textColor: 'text-primary-foreground'
  }
};

const EventCard = React.forwardRef<HTMLDivElement, EventCardProps>(
  ({ event, onClick, className }, ref) => {
    const config = categoryConfig[event.category] || categoryConfig.work;

    const formatDate = (date: Date) => {
      return {
        day: date.getDate().toString(),
        month: date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')
      };
    };

    const { day, month } = formatDate(event.date);

    return (
      <Card
        ref={ref}
        className={cn(
          config.background,
          config.textColor,
          'shadow-sm cursor-pointer hover:shadow-md transition-all',
          className
        )}
        onClick={() => onClick?.(event)}
      >
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className={cn(
              'flex flex-col items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shrink-0',
              'text-center leading-tight'
            )}>
              <span className="text-body-lg font-semibold text-primary-foreground">
                {day}
              </span>
              <span className="text-helpertext-xs text-primary-foreground/80 font-light">
                {month}.
              </span>
            </div>

            <div className="flex-1">
              <p className="text-body-md leading-relaxed">
                {event.category === 'corporate_culture' && 'Корпоративная культура\nи эвэнты'}
                {event.category === 'important' && 'Важное'}
                {event.category === 'work' && 'Рабочие задачи'}
                {event.category === 'training' && 'Обучение'}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-caption-sm opacity-80 mb-1">
                {event.category === 'corporate_culture' && 'Корпоративная культура'}
                {event.category === 'important' && 'Магазин'}
                {event.category === 'work' && 'Работа'}
                {event.category === 'training' && 'Обучение'}
              </p>

              <h4 className="text-heading-4 font-semibold leading-tight tracking-tight">
                {event.title}
              </h4>
            </div>

            <div className="w-[84px] h-12 bg-primary/40 rounded-full p-0.5 shrink-0">
              <div className="w-full h-full bg-gradient-to-r from-primary/20 to-primary/10 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

EventCard.displayName = 'EventCard';

export { EventCard };