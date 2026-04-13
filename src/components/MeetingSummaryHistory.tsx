import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { LinkedText } from '@/components/ui/linked-text';
import { History, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatMeetingDateFull } from '@/lib/meetingDateFormat';
import { useMeetingSummaryCommentCounts } from '@/hooks/useMeetingSummaryThread';
import { MeetingSummaryThread } from '@/components/MeetingSummaryThread';

const TRUNCATE_LIMIT = 200;

interface MeetingSummaryHistoryProps {
  employeeId: string;
  currentMeetingId: string;
  currentMeetingCreatedAt: string;
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
}) => {
  const { user } = useAuth();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [threadOpenIds, setThreadOpenIds] = useState<Set<string>>(new Set());

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

  // Author names
  const authorIds = [...new Set((history || []).map(h => h.summary_saved_by).filter(Boolean))] as string[];
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

  // Comment counts for all historical entries
  const historicalIds = (history || []).map(e => e.id);
  const { data: commentCounts } = useMeetingSummaryCommentCounts(historicalIds);

  if (!history || history.length === 0) return null;

  const numbered = history.map((entry, idx) => ({ ...entry, number: idx + 1 }));
  const displayed = [...numbered].reverse();

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleThread = (id: string) => {
    setThreadOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="mt-2 pt-3 border-t border-border/30">
      <div className="flex items-center gap-1.5 mb-2">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">История итогов прошлых встреч</span>
      </div>
      <ScrollArea className="max-h-[300px] rounded-md border border-border/50 bg-muted/10">
        <div className="divide-y divide-border/40">
          {displayed.map((entry) => {
            const isExpanded = expandedIds.has(entry.id);
            const isLong = entry.meeting_summary.length > TRUNCATE_LIMIT;
            const displayText = isLong && !isExpanded
              ? entry.meeting_summary.slice(0, TRUNCATE_LIMIT) + '…'
              : entry.meeting_summary;

            const dateStr = entry.meeting_date
              ? formatMeetingDateFull(entry.meeting_date, user?.timezone)
              : formatMeetingDateFull(entry.created_at, user?.timezone);

            const authorName = entry.summary_saved_by && authors?.[entry.summary_saved_by];
            const threadCount = commentCounts?.[entry.id] || 0;
            const isThreadOpen = threadOpenIds.has(entry.id);

            return (
              <div key={entry.id} className="px-3.5 py-3">
                <p className="text-[11px] text-muted-foreground/80 leading-tight tracking-wide uppercase mb-1.5">
                  Встреча №{entry.number} · {dateStr}
                  {authorName && <span className="normal-case tracking-normal"> · {authorName}</span>}
                </p>

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

                {/* Collapsible thread for historical entry */}
                <div className="mt-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => toggleThread(entry.id)}
                  >
                    {isThreadOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <MessageSquare className="h-3 w-3" />
                    <span>Обсуждение этих итогов{threadCount > 0 ? ` · ${threadCount}` : ''}</span>
                  </button>
                  {isThreadOpen && (
                    <MeetingSummaryThread
                      meetingId={entry.id}
                      isParticipant={false}
                      readOnly
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
