import React, { useState } from 'react';
import { useMeetingSummaryThread, SummaryComment } from '@/hooks/useMeetingSummaryThread';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ExpandableTextarea } from '@/components/ui/expandable-textarea';
import { MessageSquare, Pencil, Trash2, Loader2, Send } from 'lucide-react';
import { formatMeetingDateFull } from '@/lib/meetingDateFormat';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MeetingSummaryThreadProps {
  meetingId: string;
  isParticipant: boolean;
  /** If true, thread is read-only (e.g. historical entries) */
  readOnly?: boolean;
}

const CommentBubble: React.FC<{
  comment: SummaryComment;
  isOwn: boolean;
  timezone?: string;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  readOnly?: boolean;
}> = ({ comment, isOwn, timezone, onEdit, onDelete, readOnly }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [isBusy, setIsBusy] = useState(false);

  const isDeleted = !!comment.deleted_at;

  const handleSave = async () => {
    const trimmed = editBody.trim();
    if (!trimmed || trimmed === comment.body) { setIsEditing(false); return; }
    setIsBusy(true);
    try {
      await onEdit(comment.id, trimmed);
      setIsEditing(false);
    } catch { toast.error('Ошибка сохранения'); }
    finally { setIsBusy(false); }
  };

  const handleDelete = async () => {
    setIsBusy(true);
    try { await onDelete(comment.id); }
    catch { toast.error('Ошибка удаления'); }
    finally { setIsBusy(false); }
  };

  if (isDeleted) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground italic">
        Сообщение удалено
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group rounded-lg px-3 py-2 transition-colors',
        isOwn
          ? 'bg-primary/5 border border-primary/10'
          : 'bg-muted/40 border border-border/50',
      )}
    >
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <span className="text-xs font-medium text-foreground/80">{comment.author_name}</span>
        <div className="flex items-center gap-1">
          {comment.edited_at && (
            <span className="text-[10px] text-muted-foreground/60 italic">изменено</span>
          )}
          <span className="text-[10px] text-muted-foreground/60">
            {formatMeetingDateFull(comment.created_at, timezone)}
          </span>
          {isOwn && !readOnly && !isEditing && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1 transition-opacity">
              <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setEditBody(comment.body); setIsEditing(true); }}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive/60 hover:text-destructive" onClick={handleDelete} disabled={isBusy}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
      {isEditing ? (
        <div className="space-y-1.5 mt-1">
          <ExpandableTextarea
            className="bg-background border-border shadow-sm text-sm"
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            maxCollapsedRows={4}
            autoFocus
          />
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="default" className="h-6 text-xs px-2" onClick={handleSave} disabled={isBusy || !editBody.trim()}>
              {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Сохранить'}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setIsEditing(false)} disabled={isBusy}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">{comment.body}</p>
      )}
    </div>
  );
};

export const MeetingSummaryThread: React.FC<MeetingSummaryThreadProps> = ({
  meetingId,
  isParticipant,
  readOnly = false,
}) => {
  const { user } = useAuth();
  const { comments, isLoading, sendComment, editComment, deleteComment, isSending } = useMeetingSummaryThread(meetingId);
  const [newMessage, setNewMessage] = useState('');

  const handleSend = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed) return;
    try {
      await sendComment(trimmed);
      setNewMessage('');
    } catch {
      toast.error('Ошибка отправки');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && newMessage.trim()) {
      e.preventDefault();
      handleSend();
    }
  };

  const canWrite = isParticipant && !readOnly;

  return (
    <div className="mt-1 pt-3 border-t border-border/40">
      <div className="flex items-center gap-1.5 mb-2.5">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Обсуждение этих итогов</span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Загрузка...
        </div>
      ) : (
        <>
          {comments.length > 0 ? (
            <div className="space-y-1.5 mb-3">
              {comments.map(c => (
                <CommentBubble
                  key={c.id}
                  comment={c}
                  isOwn={c.author_id === user?.id}
                  timezone={user?.timezone}
                  onEdit={(id, body) => editComment({ commentId: id, body })}
                  onDelete={deleteComment}
                  readOnly={readOnly}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60 mb-3">Пока нет сообщений</p>
          )}

          {canWrite && (
            <div className="flex gap-2 items-end">
              <ExpandableTextarea
                className="flex-1 bg-background border-border shadow-sm text-sm placeholder:text-muted-foreground/50"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Дополнить итоги или задать вопрос..."
                maxCollapsedRows={2}
                maxExpandedRows={6}
              />
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-8 px-2.5 shrink-0"
                onClick={handleSend}
                disabled={!newMessage.trim() || isSending}
              >
                {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
