import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, User, Shield, Users, EyeOff, EyeOffIcon } from 'lucide-react';
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
        return <User className="w-4 h-4 text-blue-600" />;
      case 'supervisor':
        return <Shield className="w-4 h-4 text-green-600" />;
      case 'colleague':
        return <Users className="w-4 h-4 text-purple-600" />;
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
        return 'bg-blue-50 border-l-blue-500';
      case 'supervisor':
        return 'bg-green-50 border-l-green-500';
      case 'colleague':
        return 'bg-purple-50 border-l-purple-500';
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
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
                  <div className="flex items-center gap-2 text-xs font-medium text-text-secondary flex-wrap">
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
                    <span className="text-xs text-text-tertiary">
                      {new Date(comment.created_at).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
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
