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
  localDateTimeToUtcIso,
  getEffectiveTimezone,
  getTimezoneOffsetLabel,
  getMinTimeForDate,
  getNowInTimezone,
} from '@/lib/meetingDateTime';
import { validateMeetingDateTime } from '@/lib/meetingValidation';
import { parseRpcErrorCode } from '@/hooks/useMeetingFormAutoSave';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveNow } from '@/hooks/useLiveNow';

interface RescheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  currentMeetingDate: string;
  /** Called with RPC-compatible params. Server handles conflict check & atomicity. */
  onReschedule: (params: { p_meeting_id: string; p_new_date: string }) => Promise<void>;
}

export const RescheduleMeetingDialog: React.FC<RescheduleMeetingDialogProps> = ({
  open,
  onOpenChange,
  meetingId,
  currentMeetingDate,
  onReschedule,
}) => {
  const { user } = useAuth();
  const userTz = getEffectiveTimezone(user?.timezone);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('10:00');
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const liveNow = useLiveNow(30_000);

  const isValid = useMemo(() => {
    if (!selectedDate || !selectedTime) return false;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const errors = validateMeetingDateTime(dateStr, selectedTime, { timezone: userTz });
    return errors.length === 0;
  }, [selectedDate, selectedTime, liveNow, userTz]);

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
    if (!selectedDate) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const finalErrors = validateMeetingDateTime(dateStr, selectedTime, { timezone: userTz });
    if (finalErrors.length > 0) return;

    setIsSaving(true);
    setServerError(null);
    try {
      const newDateIso = localDateTimeToUtcIso(dateStr, selectedTime, userTz);
      await onReschedule({ p_meeting_id: meetingId, p_new_date: newDateIso });
      onOpenChange(false);
      setSelectedDate(undefined);
      setSelectedTime('10:00');
    } catch (err: any) {
      const msg = err?.message || '';
      const code = parseRpcErrorCode(msg);
      if (code === 'CONFLICT') {
        setServerError('У сотрудника уже есть активная встреча на выбранные дату и время.');
      } else if (code === 'PAST_DATE') {
        setServerError('Выбранное время уже прошло.');
      } else if (code === 'FORBIDDEN') {
        setServerError('Недостаточно прав для переноса встречи.');
      } else {
        setServerError('Ошибка переноса. Попробуйте ещё раз.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSelectedDate(undefined);
      setSelectedTime('10:00');
      setServerError(null);
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
            onSelect={(d) => { setSelectedDate(d); setServerError(null); }}
            disabled={(d) => {
              const { date: todayStr } = getNowInTimezone(userTz);
              const dStr = format(d, 'yyyy-MM-dd');
              return dStr < todayStr;
            }}
            className="pointer-events-auto rounded-md border mx-auto"
          />

          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground shrink-0">
              Время <span className="text-xs">({getTimezoneOffsetLabel(userTz)})</span>
            </Label>
            <TimePicker
              value={selectedTime}
              onChange={(t) => { setSelectedTime(t); setServerError(null); }}
              minTime={selectedDate ? getMinTimeForDate(format(selectedDate, 'yyyy-MM-dd'), userTz) : null}
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

          {serverError && (
            <p className="text-xs text-destructive">
              {serverError}
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
