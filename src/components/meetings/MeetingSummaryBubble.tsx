import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { LinkedText } from '@/components/ui/linked-text';
import { ExpandableTextarea } from '@/components/ui/expandable-textarea';
import { MoreHorizontal, Pencil, Trash2 } from "@/components/icons";
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatMeetingDateFull } from '@/lib/meetingDateFormat';
import type { SummaryComment } from '@/hooks/useMeetingSummaryThread';
import { COLORS } from '@/lib/colors';

// Deterministic palette for per-author avatar colors (used when manager unknown).
const AVATAR_PALETTE = [
  COLORS.brandNavy,    // brand dark (было #0a1a3e)
  COLORS.brandTeal,    // brand teal (было #1DB9A6)
  COLORS.chart3,       // violet (было #7c3aed)
  COLORS.warning,      // amber (было #d97706)
  COLORS.brandTeal,    // cyan (было #0891b2) — близко к teal
  COLORS.chart3,       // pink (было #be185d) — категориальный
  COLORS.success,      // green (было #15803d)
  COLORS.error,        // red (было #b91c1c)
];

const colorForAuthor = (authorId: string): string => {
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) {
    hash = ((hash << 5) - hash + authorId.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

export interface MeetingSummaryBubbleProps {
  comment: SummaryComment;
  currentUserId: string | undefined;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  /** Optional manager id — if known, manager messages get brand-dark, others get brand-teal. */
  managerId?: string;
  timezone?: string;
  readOnly?: boolean;
  onEdit?: (id: string, body: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

/**
 * Single source of truth for rendering a chat bubble in the 1:1 meeting summary discussion.
 * Used both in the live thread (MeetingSummaryThread) and in historical entries
 * (MeetingSummaryHistory via MeetingSummaryThread in readOnly mode).
 */
export const MeetingSummaryBubble: React.FC<MeetingSummaryBubbleProps> = ({
  comment,
  currentUserId,
  isFirstInGroup,
  isLastInGroup,
  managerId,
  timezone,
  readOnly,
  onEdit,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [isBusy, setIsBusy] = useState(false);

  if (comment.deleted_at) return null;

  const isOwn = !!currentUserId && comment.author_id === currentUserId;
  const knownManager = !!managerId;
  const isAuthorManager = knownManager && comment.author_id === managerId;

  const avatarColor = knownManager
    ? (isAuthorManager ? COLORS.brandNavy : COLORS.brandTeal)
    : colorForAuthor(comment.author_id);
  const bubbleBg = isAuthorManager ? 'rgba(10,26,62,0.05)' : 'rgba(29,185,166,0.06)';
  const bubbleBorder = isAuthorManager
    ? '1px solid rgba(10,26,62,0.1)'
    : '1px solid rgba(29,185,166,0.15)';

  const firstLetter = (comment.author_name || '?').charAt(0).toUpperCase();
  const spacing = isLastInGroup ? 'mb-4' : 'mb-1';
  const isEdited = !!comment.edited_at;

  const handleSaveEdit = async () => {
    const trimmed = editBody.trim();
    if (!trimmed || trimmed === comment.body) {
      setIsEditing(false);
      return;
    }
    if (!onEdit) return;
    setIsBusy(true);
    try {
      await onEdit(comment.id, trimmed);
      setIsEditing(false);
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsBusy(true);
    try {
      await onDelete(comment.id);
    } catch {
      toast.error('Ошибка удаления');
    } finally {
      setIsBusy(false);
    }
  };

  const showActions = isOwn && !readOnly && !isEditing && !!onEdit && !!onDelete;

  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={() => { setEditBody(comment.body); setIsEditing(true); }}>
          <Pencil className="w-3.5 h-3.5 mr-2" /> Изменить
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDelete}
          disabled={isBusy}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5 mr-2" /> Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const avatar = (
    <div
      className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold text-white mt-0.5"
      style={{ backgroundColor: avatarColor }}
    >
      {firstLetter}
    </div>
  );

  const editor = (
    <div className="w-full space-y-1.5">
      <ExpandableTextarea
        className="bg-background border-border shadow-sm text-body-md"
        value={editBody}
        onChange={e => setEditBody(e.target.value)}
        maxCollapsedRows={4}
        autoFocus
      />
      <div className="flex gap-1.5 justify-end">
        <button
          type="button"
          className="h-6 px-2 text-caption-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          onClick={handleSaveEdit}
          disabled={isBusy || !editBody.trim()}
        >
          {isBusy ? '...' : 'Сохранить'}
        </button>
        <button
          type="button"
          className="h-6 px-2 text-caption-sm rounded text-muted-foreground hover:text-foreground"
          onClick={() => setIsEditing(false)}
          disabled={isBusy}
        >
          Отмена
        </button>
      </div>
    </div>
  );

  const bubbleStyle: React.CSSProperties = {
    backgroundColor: bubbleBg,
    border: bubbleBorder,
    wordBreak: 'break-word',
    width: 'fit-content',
  };

  // ===== OWN message — RIGHT aligned =====
  if (isOwn) {
    if (!isFirstInGroup) {
      // Continuation
      return (
        <div className={cn('group/msg flex items-center justify-end gap-1', spacing)} style={{ paddingRight: '36px' }}>
          {isEditing ? (
            <div className="max-w-[80%] w-full">{editor}</div>
          ) : (
            <>
              <div
                className="rounded-2xl px-2.5 py-1.5 text-body-md leading-relaxed inline-block"
                style={{ ...bubbleStyle, maxWidth: '80%' }}
              >
                <LinkedText text={comment.body} />
              </div>
              {showActions && (
                <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex-shrink-0">
                  {actionsMenu}
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    // First in group
    return (
      <div className={cn('flex items-start gap-2 justify-end', spacing)}>
        <div className="flex flex-col gap-1 items-end" style={{ maxWidth: '80%' }}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {formatMeetingDateFull(comment.created_at, timezone)}
            </span>
            {isEdited && <span className="text-helpertext-xs text-muted-foreground/60 italic">изм.</span>}
            <span className="text-caption-sm font-semibold text-foreground">{comment.author_name}</span>
          </div>
          {isEditing ? editor : (
            <div className="group/msg flex items-center gap-1">
              <div
                className="rounded-2xl rounded-tr-sm px-2.5 py-1.5 text-body-md leading-relaxed inline-block"
                style={bubbleStyle}
              >
                <LinkedText text={comment.body} />
              </div>
              {showActions && (
                <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex-shrink-0">
                  {actionsMenu}
                </div>
              )}
            </div>
          )}
        </div>
        {avatar}
      </div>
    );
  }

  // ===== OTHER's message — LEFT aligned =====
  if (!isFirstInGroup) {
    return (
      <div className={cn('flex justify-start', spacing)} style={{ paddingLeft: '36px' }}>
        <div
          className="rounded-2xl px-2.5 py-1.5 text-body-md leading-relaxed inline-block"
          style={{ ...bubbleStyle, maxWidth: '80%' }}
        >
          <LinkedText text={comment.body} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-start gap-2', spacing)}>
      {avatar}
      <div className="flex flex-col gap-1" style={{ maxWidth: '80%' }}>
        <div className="flex items-center gap-2">
          <span className="text-caption-sm font-semibold text-foreground">{comment.author_name}</span>
          <span className="text-[11px] text-muted-foreground">
            {formatMeetingDateFull(comment.created_at, timezone)}
          </span>
          {isEdited && <span className="text-helpertext-xs text-muted-foreground/60 italic">изменено</span>}
        </div>
        <div
          className="rounded-2xl rounded-tl-sm px-2.5 py-1.5 text-body-md leading-relaxed inline-block"
          style={bubbleStyle}
        >
          <LinkedText text={comment.body} />
        </div>
      </div>
    </div>
  );
};
