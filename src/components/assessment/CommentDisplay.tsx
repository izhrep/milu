import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, UserCheck, Users, EyeOff } from 'lucide-react';

export interface AssessmentComment {
  id: string;
  comment: string;
  evaluatorType: 'self' | 'manager' | 'peer';
  evaluatorName?: string;
  isAnonymous: boolean;
  createdAt: string;
}

interface CommentDisplayProps {
  comments: AssessmentComment[];
  competencyName: string;
  competencyType: 'skill' | 'quality';
}

const roleLabels: Record<string, string> = {
  self: 'Самооценка',
  manager: 'Руководитель',
  peer: 'Коллега',
};

const roleIcons: Record<string, React.ReactNode> = {
  self: <User className="w-4 h-4" />,
  manager: <UserCheck className="w-4 h-4" />,
  peer: <Users className="w-4 h-4" />,
};

const roleColors: Record<string, string> = {
  self: 'hsl(259 100% 52%)',
  manager: 'hsl(217 100% 50%)',
  peer: 'hsl(20 100% 60%)',
};

export const CommentDisplay: React.FC<CommentDisplayProps> = ({
  comments,
  competencyName,
  competencyType,
}) => {
  if (!comments || comments.length === 0) {
    return null;
  }

  // Фильтруем комментарии: убираем пустые и null
  const validComments = comments.filter(c => c.comment && c.comment.trim().length > 0);

  if (validComments.length === 0) {
    return null;
  }

  // Группируем по типу оценщика
  const groupedComments = validComments.reduce((acc, comment) => {
    const type = comment.evaluatorType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(comment);
    return acc;
  }, {} as Record<string, AssessmentComment[]>);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2">
        <h4 className="font-semibold text-foreground">
          Комментарии по {competencyType === 'skill' ? 'навыку' : 'качеству'} "{competencyName}"
        </h4>
        <Badge variant="secondary" className="text-xs">
          {validComments.length}
        </Badge>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedComments).map(([type, typeComments]) => (
          <div key={type} className="space-y-2">
            {typeComments.map((comment, index) => {
              return (
                <Card key={`${comment.id}-${index}`} className="border-l-4" style={{ borderLeftColor: roleColors[type] }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {roleIcons[type]}
                        <CardTitle className="text-sm font-medium">
                          {roleLabels[type]}
                        </CardTitle>
                      </div>
                      {comment.isAnonymous ? (
                        <Badge variant="secondary" className="gap-1">
                          <EyeOff className="w-3 h-3" />
                          Анонимно
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {comment.evaluatorName || 'Неизвестно'}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {comment.comment}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
