import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LinkedText } from '@/components/ui/linked-text';
import { MessageSquare, ChevronDown, ChevronRight } from "@/components/icons";
import { useAuth } from '@/contexts/AuthContext';
import { formatMeetingDateFull } from '@/lib/meetingDateFormat';
import { useMeetingSummaryCommentCounts } from '@/hooks/useMeetingSummaryThread';
import { MeetingSummaryThread } from '@/components/MeetingSummaryThread';

const TRUNCATE_LIMIT = 200;

interface MeetingSummaryHistoryProps {
  employeeId: string;
  managerId: string;
  currentMeetingId: string;
  currentMeetingDate: string;
}

interface HistoryEntry {
  id: string;
  meeting_date: string | null;
  meeting_summary: string;
  summary_saved_by: string | null;
  manager_id: string;
  employee_id: string;
  created_at: string;
}

export const MeetingSummaryHistory: React.FC<MeetingSummaryHistoryProps> = ({
  employeeId,
  managerId,
  currentMeetingId,
  currentMeetingDate,
}) => {
  const { user } = useAuth();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: history } = useQuery({
    queryKey: ['meeting-summary-history', employeeId, managerId, currentMeetingId],
    queryFn: async () => {
      let query = supabase
        .from('one_on_one_meetings')
        .select('id, meeting_date, meeting_summary, summary_saved_by, manager_id, employee_id, created_at')
        .eq('employee_id', employeeId)
        .eq('manager_id', managerId)
        .neq('id', currentMeetingId)
        .not('meeting_summary', 'is', null);

      // Use meeting_date for ordering if available
      query = query.lt('meeting_date', currentMeetingDate)
        .order('meeting_date', { ascending: true });

      const { data, error } = await query;
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

  return (
    <div>
      <ScrollArea className="max-h-[400px] rounded-md border border-border/50 bg-muted/10">
        <div className="divide-y divide-border/40">
          {displayed.map((entry) => {
            const isExpanded = expandedIds.has(entry.id);
            const isLong = entry.meeting_summary.length > TRUNCATE_LIMIT;

            const dateStr = entry.meeting_date
              ? formatMeetingDateFull(entry.meeting_date, user?.timezone)
              : formatMeetingDateFull(entry.created_at, user?.timezone);

            const authorName = entry.summary_saved_by && authors?.[entry.summary_saved_by];
            const threadCount = commentCounts?.[entry.id] || 0;

            return (
              <div key={entry.id} className="px-3.5 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <button
                    type="button"
                    className="p-0 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => toggleExpand(entry.id)}
                  >
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5" />
                      : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  <p className="text-[11px] text-muted-foreground/80 leading-tight tracking-wide uppercase">
                    Встреча №{entry.number} · {dateStr}
                    {authorName && <span className="normal-case tracking-normal"> · {authorName}</span>}
                  </p>
                </div>

                {!isExpanded && (
                  <p className="text-body-md text-foreground whitespace-pre-line leading-relaxed pl-5">
                    <LinkedText text={entry.meeting_summary.slice(0, TRUNCATE_LIMIT) + (isLong ? '…' : '')} />
                  </p>
                )}

                {isExpanded && (
                  <div className="pl-5">
                    <p className="text-body-md text-foreground whitespace-pre-line leading-relaxed">
                      <LinkedText text={entry.meeting_summary} />
                    </p>

                    {/* Thread inside expanded view */}
                    <div className="mt-3">
                      <div className="flex items-center gap-1 text-caption-sm text-muted-foreground mb-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>Обсуждение{threadCount > 0 ? ` · ${threadCount}` : ''}</span>
                      </div>
                      <MeetingSummaryThread
                        meetingId={entry.id}
                        isParticipant={false}
                        readOnly
                        hideHeader
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
