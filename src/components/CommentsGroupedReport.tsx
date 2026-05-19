import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, User, Users, Shield, ChevronDown, ChevronUp, EyeOff, EyeOffIcon } from "@/components/icons";
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { COLORS } from '@/lib/colors';

export interface CommentByEvaluator {
  evaluator_id: string;
  evaluator_name: string;
  evaluator_type: 'self' | 'supervisor' | 'colleague';
  comment: string;
  created_at: string;
  is_anonymous: boolean;
}

interface CommentsGroupedReportProps {
  comments: CommentByEvaluator[];
  showAuthors?: boolean;
  onHideComment?: () => void;
}

export const CommentsGroupedReport: React.FC<CommentsGroupedReportProps> = ({
  comments,
  showAuthors = false,
  onHideComment
}) => {
  const [expanded, setExpanded] = useState(true);
  const [hiddenCommentIds, setHiddenCommentIds] = useState<Set<string>>(new Set());

  if (!comments || comments.length === 0) {
    return null;
  }

  // Фильтруем скрытые комментарии
  const visibleComments = comments.filter((comment, index) => {
    const commentKey = `${comment.evaluator_id}-${index}`;
    return !hiddenCommentIds.has(commentKey);
  });

  // Если все комментарии скрыты - не показываем секцию
  if (visibleComments.length === 0) {
    return null;
  }

  const handleHideComment = (commentKey: string) => {
    setHiddenCommentIds(prev => new Set([...prev, commentKey]));
    onHideComment?.();
  };

  // Группируем видимые комментарии по типу оценивающего
  const selfComments = visibleComments.filter(c => c.evaluator_type === 'self');
  const supervisorComments = visibleComments.filter(c => c.evaluator_type === 'supervisor');
  const colleagueComments = visibleComments.filter(c => c.evaluator_type === 'colleague');

  const getIcon = (type: string) => {
    switch (type) {
      case 'self':
        return <User className="w-4 h-4" />;
      case 'supervisor':
        return <Shield className="w-4 h-4" />;
      case 'colleague':
        return <Users className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'self':
        return 'Самооценка';
      case 'supervisor':
        return 'Руководитель';
      case 'colleague':
        return 'Коллеги';
      default:
        return 'Другое';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'self':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'supervisor':
        return 'bg-success/20 text-success border-success/30';
      case 'colleague':
        return 'bg-chart-3/20 text-chart-3 border-chart-3/30';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  const renderCommentGroup = (groupComments: CommentByEvaluator[], type: 'self' | 'supervisor' | 'colleague', originalComments: CommentByEvaluator[]) => {
    if (groupComments.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${getTypeBadgeColor(type)}`}>
            {getIcon(type)}
          </div>
          <h5 className="font-semibold text-foreground">{getTypeLabel(type)}</h5>
          <Badge variant="outline" className="ml-auto">
            {groupComments.length} {groupComments.length === 1 ? 'комментарий' : 'комментария'}
          </Badge>
        </div>

        <div className="space-y-2">
          {groupComments.map((comment) => {
            // Находим оригинальный индекс комментария для правильного ключа
            const originalIndex = originalComments.findIndex(
              (c, idx) => c.evaluator_id === comment.evaluator_id && 
                          c.created_at === comment.created_at && 
                          c.comment === comment.comment
            );
            const commentKey = `${comment.evaluator_id}-${originalIndex}`;
            
            return (
              <Card key={commentKey} className="p-4 bg-muted border-l-4 relative group" style={{
                borderLeftColor: type === 'self' ? COLORS.brandNavy : type === 'supervisor' ? COLORS.success : COLORS.chart3
              }}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-caption-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {showAuthors ? (
                        <span className="font-medium">{comment.evaluator_name}</span>
                      ) : comment.is_anonymous ? (
                        <Badge variant="secondary" className="gap-1">
                          <EyeOff className="w-3 h-3" />
                          Анонимно
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span>
                        {new Date(comment.created_at).toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-caption-sm text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHideComment(commentKey);
                        }}
                      >
                        <EyeOffIcon className="w-3 h-3 mr-1" />
                        Скрыть
                      </Button>
                    </div>
                  </div>
                  <p className="text-body-md text-foreground leading-relaxed">
                    {comment.comment}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-accent" />
          <h4 className="text-body-lg font-semibold text-foreground">Комментарии</h4>
          <Badge variant="outline">{visibleComments.length}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              Свернуть
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />
              Развернуть
            </>
          )}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-6">
          {renderCommentGroup(selfComments, 'self', comments)}
          {selfComments.length > 0 && (supervisorComments.length > 0 || colleagueComments.length > 0) && (
            <Separator />
          )}
          {renderCommentGroup(supervisorComments, 'supervisor', comments)}
          {supervisorComments.length > 0 && colleagueComments.length > 0 && (
            <Separator />
          )}
          {renderCommentGroup(colleagueComments, 'colleague', comments)}
        </div>
      )}
    </div>
  );
};
