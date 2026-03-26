import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { TimePicker } from '@/components/ui/time-picker';
import { Label } from '@/components/ui/label';
import { Loader2, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  buildLocalDateTimeString,
  normalizeMeetingDateToUtcIso,
  parseMeetingDateTime,
} from '@/lib/meetingDateTime';

interface RescheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  currentMeetingDate: string;
  onReschedule: (params: { meetingId: string; previousDate: string; newDateIso: string }) => Promise<void>;
}

export const RescheduleMeetingDialog: React.FC<RescheduleMeetingDialogProps> = ({
  open,
  onOpenChange,
  meetingId,
  currentMeetingDate,
  onReschedule,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('10:00');
  const [isSaving, setIsSaving] = useState(false);

  const isValid = useMemo(() => {
    if (!selectedDate || !selectedTime) return false;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const localStr = buildLocalDateTimeString(dateStr, selectedTime);
    const dt = parseMeetingDateTime(localStr);
    if (!dt) return false;
    return dt > new Date();
  }, [selectedDate, selectedTime]);

  const summaryLabel = useMemo(() => {
    if (selectedDate && selectedTime) {
      return format(selectedDate, 'd MMMM yyyy', { locale: ru }) + ', ' + selectedTime;
    }
    return null;
  }, [selectedDate, selectedTime]);

  const missingHint = useMemo(() => {
    if (!selectedDate && !selectedTime) return 'Выберите дату и время';
    if (!selectedDate) return 'Выберите дату';
    if (!selectedTime) return 'Выберите время';
    return null;
  }, [selectedDate, selectedTime]);

  const handleConfirm = async () => {
    if (!isValid || !selectedDate) return;
    setIsSaving(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const localStr = buildLocalDateTimeString(dateStr, selectedTime);
      const newDateIso = normalizeMeetingDateToUtcIso(localStr);
      await onReschedule({ meetingId, previousDate: currentMeetingDate, newDateIso });
      onOpenChange(false);
      setSelectedDate(undefined);
      setSelectedTime('10:00');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSelectedDate(undefined);
      setSelectedTime('10:00');
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[360px] p-5">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Перенести встречу
          </DialogTitle>
          <DialogDescription className="sr-only">
            Выберите новую дату и время для встречи
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={(d) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return d < today;
            }}
            className="pointer-events-auto rounded-md border mx-auto"
          />

          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground shrink-0">Время</Label>
            <TimePicker
              value={selectedTime}
              onChange={setSelectedTime}
            />
            {summaryLabel && (
              <span className="text-sm font-medium text-foreground truncate ml-auto">
                {summaryLabel}
              </span>
            )}
          </div>

          {selectedDate && selectedTime && !isValid && (
            <p className="text-xs text-destructive">
              Выбранное время уже прошло.
            </p>
          )}
        </div>

        <DialogFooter className="flex flex-row gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            Отмена
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!isValid || isSaving} className="min-w-[140px]">
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {!isValid && !isSaving ? (missingHint || 'Перенести') : 'Перенести'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
