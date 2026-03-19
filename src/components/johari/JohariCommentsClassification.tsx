import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageSquareText,
  ChevronDown,
  EyeOff,
  ArrowRightLeft,
  Lightbulb,
  Heart,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import type {
  CommentsClassification,
  ClassifiedComment,
  ZoneCommentGroup,
} from '@/hooks/useJohariReport';
import type { JohariZone } from '@/lib/johariConfig';

interface JohariCommentsClassificationProps {
  data: CommentsClassification | null;
  canReview: boolean;
  isExternalOnly: boolean;
}

type DisplayZone = JohariZone | 'grey';

const ZONE_ORDER: DisplayZone[] = ['arena', 'blind_spot', 'hidden_strength', 'unknown', 'grey'];

const ZONE_CONFIG: Record<DisplayZone, { label: string; emoji: string; headerClass: string; badgeClass: string }> = {
  arena: {
    label: 'Открытая зона',
    emoji: '🟢',
    headerClass: 'bg-success/10 border-success/30 text-success',
    badgeClass: 'bg-success/10 text-success border-success/20',
  },
  blind_spot: {
    label: 'Слепая зона',
    emoji: '🟠',
    headerClass: 'bg-warning/10 border-warning/30 text-warning',
    badgeClass: 'bg-warning/10 text-warning border-warning/20',
  },
  hidden_strength: {
    label: 'Скрытая зона',
    emoji: '🔵',
    headerClass: 'bg-primary/10 border-primary/30 text-primary',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
  },
  unknown: {
    label: 'Чёрный ящик',
    emoji: '⚪',
    headerClass: 'bg-muted border-border text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
  grey: {
    label: 'Серая зона',
    emoji: '🔘',
    headerClass: 'bg-muted/50 border-border text-muted-foreground',
    badgeClass: 'bg-muted/50 text-muted-foreground border-border',
  },
};

export const JohariCommentsClassification: React.FC<JohariCommentsClassificationProps> = ({
  data,
  canReview,
  isExternalOnly,
}) => {
  const [hiddenComments, setHiddenComments] = useState<Set<string>>(new Set());

  if (!data) return null;

  const zone_comment_groups = data.zone_comment_groups || [];
  const out_of_matrix_comments = data.out_of_matrix_comments || [];
  const gratitude_comments = data.gratitude_comments || [];
  const problem_comments = data.problem_comments || [];

  const hasAnyContent =
    zone_comment_groups.length > 0 ||
    out_of_matrix_comments.length > 0 ||
    gratitude_comments.length > 0 ||
    problem_comments.length > 0;

  if (!hasAnyContent) return null;

  const toggleHide = (commentId: string) => {
    setHiddenComments(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  // Sort zone groups by defined order
  const sortedGroups = [...zone_comment_groups].sort((a, b) => {
    const ai = ZONE_ORDER.indexOf(a.zone as DisplayZone);
    const bi = ZONE_ORDER.indexOf(b.zone as DisplayZone);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const totalComments = data.notes?.comments_used || 0;

  const renderComment = (comment: ClassifiedComment) => {
    const isHidden = hiddenComments.has(comment.comment_id);

    return (
      <div
        key={comment.comment_id}
        className={`text-sm p-3 rounded-lg border transition-opacity ${
          isHidden ? 'opacity-40 bg-muted/20' : 'bg-card'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className={isHidden ? 'line-through text-muted-foreground' : 'text-foreground'}>
            {comment.comment_text}
          </p>
          {canReview && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => toggleHide(comment.comment_id)}
                title={isHidden ? 'Показать' : 'Скрыть'}
              >
                <EyeOff className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
        {comment.source_skill_name && (
          <span className="text-xs text-muted-foreground mt-1 block">
            Навык: {comment.source_skill_name}
          </span>
        )}
        {comment.reassignment_suggestion && !isHidden && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
            <Lightbulb className="w-3 h-3 shrink-0" />
            <span>
              AI-предложение: → <strong>{comment.reassignment_suggestion.suggested_skill_name}</strong>
              {' '}({comment.reassignment_suggestion.confidence})
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderZoneGroup = (group: ZoneCommentGroup) => {
    const config = ZONE_CONFIG[group.zone as DisplayZone] || ZONE_CONFIG.unknown;
    const visibleSkills = group.skills.filter(s => s.comments.length > 0);
    if (visibleSkills.length === 0) return null;

    return (
      <div key={group.zone} className="space-y-2">
        {/* Zone header */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.headerClass}`}>
          <span>{config.emoji}</span>
          <span className="font-semibold text-sm">{config.label}</span>
          <Badge variant="outline" className={`text-[10px] ml-auto ${config.badgeClass}`}>
            {visibleSkills.reduce((sum, s) => sum + s.comments.length, 0)} комм.
          </Badge>
        </div>

        {/* Zone summary */}
        {group.zone_summary && (
          <p className="text-sm text-muted-foreground px-1 italic">
            {group.zone_summary}
          </p>
        )}

        {/* Skill sub-groups */}
        {visibleSkills.map(skillGroup => (
          <Collapsible key={skillGroup.skill_name} defaultOpen>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sm font-medium h-8 px-2"
              >
                <ChevronDown className="w-3.5 h-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
                {skillGroup.skill_name}
                <span className="text-xs text-muted-foreground ml-auto">
                  {skillGroup.comments.length}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1.5 pl-4 pt-1">
                {skillGroup.comments.map(renderComment)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareText className="w-4 h-4 text-primary" />
          {isExternalOnly ? 'Классификация комментариев внешних' : 'Классификация комментариев'}
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{isExternalOnly ? 'Только внешние респонденты' : 'Все респонденты'}</span>
          {totalComments > 0 && (
            <Badge variant="secondary" className="text-xs">
              💬 {totalComments} комментариев
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Zone comment groups */}
        {sortedGroups.map(renderZoneGroup)}

        {/* Out of matrix */}
        {out_of_matrix_comments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <HelpCircle className="w-4 h-4" />
              Комментарии по навыкам вне матрицы
            </div>
            <div className="space-y-1.5">
              {out_of_matrix_comments.map(c => (
                <div key={c.comment_id} className="text-sm p-3 rounded-lg border bg-card">
                  <p>{c.comment_text}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>Навык: {c.source_skill_name}</span>
                    <span>·</span>
                    <span>Тема: {c.inferred_topic}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gratitude */}
        {gratitude_comments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Heart className="w-4 h-4" />
              Благодарности коллег
            </div>
            <div className="space-y-1.5">
              {gratitude_comments.map(c => (
                <div key={c.comment_id} className="text-sm p-3 rounded-lg border bg-card">
                  <p>{c.comment_text}</p>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Навык: {c.source_skill_name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Problem comments */}
        {problem_comments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-error">
              <AlertTriangle className="w-4 h-4" />
              Проблемные комментарии
            </div>
            <div className="space-y-1.5">
              {problem_comments.map(c => (
                <div key={c.comment_id} className="text-sm p-3 rounded-lg border border-error/20 bg-error/5">
                  <p>{c.comment_text}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <span>Навык: {c.source_skill_name}</span>
                    <span>·</span>
                    <span>Причина: {c.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
