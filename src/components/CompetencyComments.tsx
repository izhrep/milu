import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, User, Shield, Users, EyeOff, EyeOffIcon } from "@/components/icons";
import { CommentByEvaluator } from '@/hooks/useSkillSurveyResultsEnhanced';

interface CompetencyCommentsProps {
  comments: CommentByEvaluator[];
  competencyName: string;
  showAuthors?: boolean;
  onHideComment?: () => void;
}

export const CompetencyComments: React.FC<CompetencyCommentsProps> = ({ comments, competencyName, showAuthors = false, onHideComment }) => {
  // Локальное состояние для скрытых комментариев (по индексу)
  const [hiddenCommentIds, setHiddenCommentIds] = useState<Set<string>>(new Set());

  if (!comments || comments.length === 0) {
    return null;
  }

  // Фильтруем скрытые комментарии
  const visibleComments = comments.filter((comment, index) => {
    const commentKey = `${comment.evaluator_id}-${index}`;
    return !hiddenCommentIds.has(commentKey);
  });

  // Если все комментарии скрыты - не показываем секцию вообще
  if (visibleComments.length === 0) {
    return null;
  }

  const handleHideComment = (commentKey: string) => {
    setHiddenCommentIds(prev => new Set([...prev, commentKey]));
    onHideComment?.();
  };

  const getIcon = (type: 'self' | 'supervisor' | 'colleague') => {
    switch (type) {
      case 'self':
        return <User className="w-4 h-4 text-primary" />;
      case 'supervisor':
        return <Shield className="w-4 h-4 text-success" />;
      case 'colleague':
        return <Users className="w-4 h-4 text-chart-3" />;
    }
  };

  const getTypeLabel = (type: 'self' | 'supervisor' | 'colleague') => {
    switch (type) {
      case 'self':
        return 'Самооценка';
      case 'supervisor':
        return 'Руководитель';
      case 'colleague':
        return 'Коллега';
    }
  };

  const getTypeBgColor = (type: 'self' | 'supervisor' | 'colleague') => {
    switch (type) {
      case 'self':
        return 'bg-primary/10 border-l-brand-navy';
      case 'supervisor':
        return 'bg-success/10 border-l-green-500';
      case 'colleague':
        return 'bg-chart-3/10 border-l-chart-3';
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 text-body-md font-medium text-foreground">
        <MessageSquare className="w-4 h-4" />
        <span>Комментарии к "{competencyName}"</span>
      </div>
      
      <div className="space-y-2">
        {comments.map((comment, index) => {
          const commentKey = `${comment.evaluator_id}-${index}`;
          
          // Пропускаем скрытые комментарии
          if (hiddenCommentIds.has(commentKey)) {
            return null;
          }
          
          return (
            <Card 
              key={commentKey} 
              className={`p-4 border-l-4 ${getTypeBgColor(comment.evaluator_type)} relative group`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-caption-sm font-medium text-muted-foreground flex-wrap">
                    {getIcon(comment.evaluator_type)}
                    <span>{getTypeLabel(comment.evaluator_type)}</span>
                    <span className="mx-1">•</span>
                    {showAuthors ? (
                      <span className="font-normal">{comment.evaluator_name}</span>
                    ) : comment.is_anonymous ? (
                      <Badge variant="secondary" className="gap-1">
                        <EyeOff className="w-3 h-3" />
                        Анонимно
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-caption-sm text-muted-foreground/70">
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
                <p className="text-body-md text-foreground leading-relaxed whitespace-pre-wrap">
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
