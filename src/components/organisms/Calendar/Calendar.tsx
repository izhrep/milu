import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardContent } from '@/components/molecules/Card/Card';
import { Button } from '@/components/atoms/Button/Button';
import { Text, Heading } from '@/components/atoms/Text/Text';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarEvent, CalendarDate } from '@/types';

interface CalendarProps {
  events?: CalendarEvent[];
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
}

const WEEKDAYS = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  ({ events = [], selectedDate, onDateSelect, onEventClick, className }, ref) => {
    const [currentDate, setCurrentDate] = useState(selectedDate || new Date());
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const navigateMonth = (direction: 'prev' | 'next') => {
      setCurrentDate(prev => {
        const newDate = new Date(prev);
        if (direction === 'prev') {
          newDate.setMonth(prev.getMonth() - 1);
        } else {
          newDate.setMonth(prev.getMonth() + 1);
        }
        return newDate;
      });
    };

    const handleDateClick = (date: CalendarDate) => {
      if (!date.isCurrentMonth) return;
      
      const selectedDateTime = new Date(date.year, date.month, date.date);
      onDateSelect?.(selectedDateTime);
    };

    // Generate calendar dates
    const calendarDates = useMemo(() => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      const firstDayOfWeek = firstDayOfMonth.getDay() === 0 ? 7 : firstDayOfMonth.getDay(); // Convert Sunday = 0 to 7
      
      const dates: CalendarDate[] = [];
      
      // Previous month dates
      const prevMonth = new Date(year, month - 1, 0);
      for (let i = firstDayOfWeek - 1; i > 0; i--) {
        const date = prevMonth.getDate() - i + 1;
        dates.push({
          date,
          month: prevMonth.getMonth(),
          year: prevMonth.getFullYear(),
          isToday: false,
          isCurrentMonth: false,
          hasEvents: false
        });
      }
      
      // Current month dates
      for (let date = 1; date <= lastDayOfMonth.getDate(); date++) {
        const dateObj = new Date(year, month, date);
        const isToday = dateObj.getTime() === today.getTime();
        const hasEvents = events.some(event => {
          const eventDate = new Date(event.date);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate.getTime() === dateObj.getTime();
        });
        
        dates.push({
          date,
          month,
          year,
          isToday,
          isCurrentMonth: true,
          hasEvents,
          events: hasEvents ? events.filter(event => {
            const eventDate = new Date(event.date);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate.getTime() === dateObj.getTime();
          }) : undefined
        });
      }
      
      // Next month dates
      const remainingCells = 42 - dates.length; // 6 rows × 7 days
      for (let date = 1; date <= remainingCells; date++) {
        dates.push({
          date,
          month: month + 1 > 11 ? 0 : month + 1,
          year: month + 1 > 11 ? year + 1 : year,
          isToday: false,
          isCurrentMonth: false,
          hasEvents: false
        });
      }
      
      return dates;
    }, [currentDate, events, today]);

    // Group dates into weeks
    const weeks = useMemo(() => {
      const weeksArray = [];
      for (let i = 0; i < calendarDates.length; i += 7) {
        weeksArray.push(calendarDates.slice(i, i + 7));
      }
      return weeksArray;
    }, [calendarDates]);

    const getDateClasses = (date: CalendarDate) => {
      let classes = 'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all';
      
      if (!date.isCurrentMonth) {
        classes += ' text-text-tertiary';
      } else if (date.isToday) {
        classes += ' bg-brand-purple text-brand-purple-foreground font-semibold';
      } else if (date.hasEvents) {
        // Check event type for special styling
        const hasSpecialEvent = date.events?.some(e => e.category === 'corporate_culture');
        if (hasSpecialEvent) {
          classes += ' bg-success text-success-foreground';
        } else {
          classes += ' border border-brand-purple text-foreground';
        }
      } else {
        classes += ' text-foreground hover:bg-interactive-bg';
      }
      
      if (date.isCurrentMonth) {
        classes += ' cursor-pointer';
      }
      
      return classes;
    };

    const formatMonthYear = (date: Date) => {
      return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    };

    return (
      <Card ref={ref} className={cn('w-full', className)} variant="elevated">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Heading level={5} className="font-medium">
              {formatMonthYear(currentDate)}
            </Heading>
            
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => navigateMonth('prev')}
                aria-label="Предыдущий месяц"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => navigateMonth('next')}
                aria-label="Следующий месяц"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day, index) => (
              <div
                key={index}
                className="flex h-8 w-8 items-center justify-center text-xs font-medium text-text-secondary"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="space-y-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-1">
                {week.map((date, dayIndex) => (
                  <button
                    key={`${weekIndex}-${dayIndex}`}
                    className={getDateClasses(date)}
                    onClick={() => handleDateClick(date)}
                    disabled={!date.isCurrentMonth}
                    aria-label={`${date.date} ${MONTHS[date.month]} ${date.year}`}
                    title={date.hasEvents ? `${date.events?.length} событий` : undefined}
                  >
                    {date.date}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-brand-purple" />
                <Text variant="caption" color="secondary">Сегодня</Text>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-success" />
                <Text variant="caption" color="secondary">События</Text>
              </div>
            </div>
            
            <Button
              variant="link"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="text-xs"
            >
              Сегодня
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
);

Calendar.displayName = 'Calendar';

export { Calendar };