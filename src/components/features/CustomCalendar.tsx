import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { CalendarEvent, CalendarDate } from '@/types';

interface CustomCalendarProps {
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

const CustomCalendar = React.forwardRef<HTMLDivElement, CustomCalendarProps>(
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

    const calendarDates = useMemo(() => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      const firstDayOfWeek = firstDayOfMonth.getDay() === 0 ? 7 : firstDayOfMonth.getDay();

      const dates: CalendarDate[] = [];

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

      const remainingCells = 42 - dates.length;
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

    const weeks = useMemo(() => {
      const weeksArray = [];
      for (let i = 0; i < calendarDates.length; i += 7) {
        weeksArray.push(calendarDates.slice(i, i + 7));
      }
      return weeksArray;
    }, [calendarDates]);

    const getDateClasses = (date: CalendarDate) => {
      let classes = 'flex h-8 w-8 items-center justify-center rounded-full text-caption-sm font-medium transition-all';

      if (!date.isCurrentMonth) {
        classes += ' text-muted-foreground/50';
      } else if (date.isToday) {
        classes += ' bg-accent text-accent-foreground font-semibold';
      } else if (date.hasEvents) {
        const hasSpecialEvent = date.events?.some(e => e.category === 'corporate_culture');
        if (hasSpecialEvent) {
          classes += ' bg-success text-success-foreground';
        } else {
          classes += ' border border-accent text-foreground';
        }
      } else {
        classes += ' text-foreground hover:bg-muted';
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
      <Card ref={ref} className={cn('w-full', className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <h5 className="text-body-lg font-semibold">
              {formatMonthYear(currentDate)}
            </h5>

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
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day, index) => (
              <div
                key={index}
                className="flex h-8 w-8 items-center justify-center text-caption-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

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

          <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
            <div className="flex items-center gap-4 text-caption-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-caption-sm text-muted-foreground">Сегодня</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-caption-sm text-muted-foreground">События</span>
              </div>
            </div>

            <Button
              variant="link"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="text-caption-sm"
            >
              Сегодня
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
);

CustomCalendar.displayName = 'CustomCalendar';

export { CustomCalendar };