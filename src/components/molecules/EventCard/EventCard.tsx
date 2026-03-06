import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/molecules/Card/Card';
import { Text, Heading } from '@/components/atoms/Text/Text';
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
    background: 'bg-surface',
    textColor: 'text-foreground'
  },
  work: {
    background: 'bg-brand-purple',
    textColor: 'text-brand-purple-foreground'
  },
  training: {
    background: 'bg-brand-orange',
    textColor: 'text-brand-orange-foreground'
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
        interactive={!!onClick}
      >
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            {/* Date circle */}
            <div className={cn(
              'flex flex-col items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shrink-0',
              'text-center leading-tight'
            )}>
              <Text variant="h5" className="text-white font-medium">
                {day}
              </Text>
              <Text variant="caption" className="text-white/80 font-light text-[10px]">
                {month}.
              </Text>
            </div>

            {/* Category */}
            <div className="flex-1">
              <Text variant="body-sm" className="leading-relaxed">
                {event.category === 'corporate_culture' && 'Корпоративная культура\nи эвэнты'}
                {event.category === 'important' && 'Важное'}
                {event.category === 'work' && 'Рабочие задачи'}
                {event.category === 'training' && 'Обучение'}
              </Text>
            </div>
          </div>

          {/* Content */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Text variant="caption" className="opacity-80 mb-1">
                {event.category === 'corporate_culture' && 'Корпоративная культура'}
                {event.category === 'important' && 'Магазин'}
                {event.category === 'work' && 'Работа'}
                {event.category === 'training' && 'Обучение'}
              </Text>
              
              <Heading level={4} className="leading-tight font-medium tracking-tight">
                {event.title}
              </Heading>
            </div>

            {/* Preview image placeholder */}
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