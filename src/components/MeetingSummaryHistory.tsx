import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ExpandableTextarea } from '@/components/ui/expandable-textarea';
import { LinkedText } from '@/components/ui/linked-text';
import { History, Pencil, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatMeetingDateFull } from '@/lib/meetingDateFormat';

const TRUNCATE_LIMIT = 200;

interface MeetingSummaryHistoryProps {
  employeeId: string;
  currentMeetingId: string;
  currentMeetingCreatedAt: string;
  currentMeetingSummary?: string | null;
  currentMeetingDate?: string | null;
  currentSummarySavedBy?: string | null;
  canEditCurrent?: boolean;
  /** Inline editing state & handlers */
  isEditingCurrent?: boolean;
  editValue?: string;
  onEditValueChange?: (value: string) => void;
  onStartEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
  isSaveDirty?: boolean;
}

interface HistoryEntry {
  id: string;
  meeting_date: string | null;
  meeting_summary: string;
  summary_saved_by: string | null;
  created_at: string;
}

export const MeetingSummaryHistory: React.FC<MeetingSummaryHistoryProps> = ({
  employeeId,
  currentMeetingId,
  currentMeetingCreatedAt,
  currentMeetingSummary,
  currentMeetingDate,
  currentSummarySavedBy,
  canEditCurrent,
  isEditingCurrent,
  editValue,
  onEditValueChange,
  onStartEdit,
  onSave,
  onCancel,
  isSaving,
  isSaveDirty,
}) => {
  const { user } = useAuth();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: history } = useQuery({
    queryKey: ['meeting-summary-history', employeeId, currentMeetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('one_on_one_meetings')
        .select('id, meeting_date, meeting_summary, summary_saved_by, created_at')
        .eq('employee_id', employeeId)
        .neq('id', currentMeetingId)
        .lt('created_at', currentMeetingCreatedAt)
        .not('meeting_summary', 'is', null)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []).filter((m: any) => m.meeting_summary?.trim()) as HistoryEntry[];
    },
  });

  // Build full list: history + current (if saved)
  const allEntries = React.useMemo(() => {
    const pastEntries = history || [];
    if (currentMeetingSummary?.trim()) {
      return [
        ...pastEntries,
        {
          id: currentMeetingId,
          meeting_date: currentMeetingDate || null,
          meeting_summary: currentMeetingSummary,
          summary_saved_by: currentSummarySavedBy || null,
          created_at: currentMeetingCreatedAt,
        } as HistoryEntry,
      ];
    }
    return pastEntries;
  }, [history, currentMeetingSummary, currentMeetingId, currentMeetingDate, currentSummarySavedBy, currentMeetingCreatedAt]);

  // Fetch author names
  const authorIds = [...new Set(allEntries.map(h => h.summary_saved_by).filter(Boolean))] as string[];

  const { data: authors } = useQuery({
    queryKey: ['meeting-summary-authors', authorIds.join(',')],
    queryFn: async () => {
      if (!authorIds.length) return {};
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', authorIds);
      const map: Record<string, string> = {};
      (data || []).forEach((u: any) => {
        map[u.id] = [u.last_name, u.first_name].filter(Boolean).join(' ');
      });
      return map;
    },
    enabled: authorIds.length > 0,
  });

  if (!allEntries.length) return null;

  // Entries numbered ascending (1,2,3...) but displayed newest first
  const numbered = allEntries.map((entry, idx) => ({ ...entry, number: idx + 1 }));
  const displayed = [...numbered].reverse();

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-2">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">История итогов</span>
      </div>
      <ScrollArea className="max-h-[300px] rounded-md border border-border/50 bg-muted/10">
        <div className="divide-y divide-border/40">
          {displayed.map((entry) => {
            const isCurrent = entry.id === currentMeetingId;
            const isEditing = isCurrent && isEditingCurrent;
            const isExpanded = expandedIds.has(entry.id);
            const isLong = entry.meeting_summary.length > TRUNCATE_LIMIT;
            const displayText = isLong && !isExpanded
              ? entry.meeting_summary.slice(0, TRUNCATE_LIMIT) + '…'
              : entry.meeting_summary;

            const dateStr = entry.meeting_date
              ? formatMeetingDateFull(entry.meeting_date, user?.timezone)
              : formatMeetingDateFull(entry.created_at, user?.timezone);

            const authorName = entry.summary_saved_by && authors?.[entry.summary_saved_by];

            return (
              <div key={entry.id} className="px-3.5 py-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-[11px] text-muted-foreground/80 leading-tight tracking-wide uppercase">
                    Встреча №{entry.number} · {dateStr}
                    {isCurrent && <span className="ml-1.5 text-primary font-semibold normal-case tracking-normal">(текущая)</span>}
                    {authorName && <span className="normal-case tracking-normal"> · {authorName}</span>}
                  </p>
                  {isCurrent && canEditCurrent && !isEditing && onStartEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                      onClick={onStartEdit}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Изменить
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <ExpandableTextarea
                      className="bg-white border-[hsl(var(--field-border))] shadow-sm"
                      value={editValue ?? ''}
                      onChange={(e) => onEditValueChange?.(e.target.value)}
                      placeholder="Зафиксируйте ключевые итоги встречи..."
                      maxCollapsedRows={6}
                      maxExpandedRows={20}
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Button type="button" variant={(isSaveDirty && editValue?.trim()) ? 'default' : 'outline'} size="sm" onClick={onSave} disabled={!isSaveDirty || !editValue?.trim() || isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        {isSaving ? 'Сохранение...' : 'Сохранить итоги'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                      <LinkedText text={displayText} />
                    </p>
                    {isLong && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-primary/70 hover:text-primary mt-1"
                        onClick={() => toggleExpand(entry.id)}
                      >
                        {isExpanded ? 'Свернуть' : 'Показать еще'}
                      </Button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
