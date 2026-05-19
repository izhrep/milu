import React, { useState } from 'react';
import { useMeetingSummaryThread } from '@/hooks/useMeetingSummaryThread';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Loader2, Send } from "@/components/icons";
import { toast } from 'sonner';
import { MeetingSummaryBubble } from '@/components/meetings/MeetingSummaryBubble';

interface MeetingSummaryThreadProps {
  meetingId: string;
  managerId?: string;
  isParticipant: boolean;
  readOnly?: boolean;
  hideHeader?: boolean;
}

export const MeetingSummaryThread: React.FC<MeetingSummaryThreadProps> = ({
  meetingId,
  managerId,
  isParticipant,
  readOnly = false,
  hideHeader = false,
}) => {
  const { user } = useAuth();
  const { comments, isLoading, sendComment, editComment, deleteComment, isSending } = useMeetingSummaryThread(meetingId);
  const [newMessage, setNewMessage] = useState('');

  const handleSend = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed) return;
    try { await sendComment(trimmed); setNewMessage(''); }
    catch { toast.error('Ошибка отправки'); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && newMessage.trim()) {
      e.preventDefault();
      handleSend();
    }
  };

  const canWrite = isParticipant && !readOnly;

  return (
    <div className="mt-1 pt-3 border-t border-border/40 w-full">
      {!hideHeader && (
        <div className="flex items-center gap-1.5 mb-3">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-caption-sm font-medium text-muted-foreground">Обсуждение этих итогов</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-1.5 text-caption-sm text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Загрузка...
        </div>
      ) : (
        <>
          {comments.length > 0 ? (
            <div className="mb-3">
              {comments.map((c, index) => {
                const prev = comments[index - 1];
                const next = comments[index + 1];
                const isFirstInGroup = !prev || prev.author_id !== c.author_id || !!prev.deleted_at;
                const isLastInGroup = !next || next.author_id !== c.author_id || !!next.deleted_at;

                return (
                  <MeetingSummaryBubble
                    key={c.id}
                    comment={c}
                    currentUserId={user?.id}
                    managerId={managerId}
                    isFirstInGroup={isFirstInGroup}
                    isLastInGroup={isLastInGroup}
                    timezone={user?.timezone}
                    readOnly={readOnly}
                    onEdit={(id, body) => editComment({ commentId: id, body })}
                    onDelete={deleteComment}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-caption-sm text-muted-foreground/60 mb-3">Пока нет сообщений</p>
          )}

          {canWrite && (
            <div className="flex gap-2 items-end mt-3 w-full">
              <textarea
                className="flex-1 min-h-[36px] max-h-[120px] w-full px-3 py-2 rounded-lg border border-border bg-background text-body-md resize-none font-[inherit] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground/50"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Дополнить итоги или задать вопрос..."
                rows={1}
              />
              <button
                type="button"
                className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 hover:opacity-90 disabled:opacity-50"
                onClick={handleSend}
                disabled={!newMessage.trim() || isSending}
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" /> : <Send className="w-4 h-4 text-primary-foreground" />}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
