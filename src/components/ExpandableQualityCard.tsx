import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, User, Users, Crown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getQualityScoreLabel, getScoreColor, getScoreBgColor, type ScaleConfig } from '@/lib/scoreLabels';
import { CommentByEvaluator } from '@/hooks/useSurvey360ResultsEnhanced';
import { CommentsGroupedReport } from './CommentsGroupedReport';

interface ExpandableQualityCardProps {
  quality_name: string;
  quality_description?: string;
  behavioral_indicators?: string;
  category?: string;
  sub_category?: string;
  average_score: number;
  self_score?: number;
  supervisor_score?: number;
  colleague_score?: number;
  comments: CommentByEvaluator[];
  /** Pass from StageTemplateConfig.scaleLabels.soft to use template labels instead of legacy defaults */
  scaleConfig?: ScaleConfig;
}

export const ExpandableQualityCard: React.FC<ExpandableQualityCardProps> = ({
  quality_name,
  quality_description,
  behavioral_indicators,
  category,
  sub_category,
  average_score,
  self_score,
  supervisor_score,
  colleague_score,
  comments,
  scaleConfig,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getEvaluatorIcon = (type: 'self' | 'supervisor' | 'colleague') => {
    switch (type) {
      case 'self': return <User className="w-4 h-4" />;
      case 'supervisor': return <Crown className="w-4 h-4" />;
      case 'colleague': return <Users className="w-4 h-4" />;
    }
  };

  const getEvaluatorLabel = (type: 'self' | 'supervisor' | 'colleague') => {
    switch (type) {
      case 'self': return 'Самооценка';
      case 'supervisor': return 'Руководитель';
      case 'colleague': return 'Коллега';
    }
  };

  // Группируем комментарии по типу
  const selfComments = comments.filter(c => c.evaluator_type === 'self');
  const supervisorComments = comments.filter(c => c.evaluator_type === 'supervisor');
  const colleagueComments = comments.filter(c => c.evaluator_type === 'colleague');

  return (
    <Card className="overflow-hidden">
      <div
        className={`p-6 cursor-pointer hover:bg-surface-secondary/50 transition-colors ${getScoreBgColor(average_score, 4)}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-text-primary">{quality_name}</h3>
              {category && (
                <Badge variant="secondary">
                  {category}
                  {sub_category && ` → ${sub_category}`}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">Общая оценка:</span>
                <span className={`font-bold text-lg ${getScoreColor(average_score, 4)}`}>
                  {average_score.toFixed(1)}
                </span>
                <span className="text-text-tertiary text-xs">
                  ({getQualityScoreLabel(average_score, scaleConfig)})
                </span>
              </div>
              {self_score !== undefined && (
                <div className="flex items-center gap-1 text-text-secondary">
                  <User className="w-4 h-4" />
                  <span>{self_score.toFixed(1)}</span>
                </div>
              )}
              {supervisor_score !== undefined && (
                <div className="flex items-center gap-1 text-text-secondary">
                  <Crown className="w-4 h-4" />
                  <span>{supervisor_score.toFixed(1)}</span>
                </div>
              )}
              {colleague_score !== undefined && (
                <div className="flex items-center gap-1 text-text-secondary">
                  <Users className="w-4 h-4" />
                  <span>{colleague_score.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {comments.length > 0 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {comments.length}
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-text-secondary" />
            ) : (
              <ChevronDown className="w-5 h-5 text-text-secondary" />
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border p-6 space-y-6 bg-surface">
          {quality_description && (
            <div>
              <h4 className="font-semibold text-text-primary mb-2">Описание</h4>
              <p className="text-text-secondary text-sm leading-relaxed">{quality_description}</p>
            </div>
          )}

          {behavioral_indicators && (
            <div>
              <h4 className="font-semibold text-text-primary mb-2">Поведенческие индикаторы</h4>
              <div className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
                {behavioral_indicators}
              </div>
            </div>
          )}

          {comments.length > 0 && (
            <CommentsGroupedReport comments={comments} />
          )}
        </div>
      )}
    </Card>
  );
};