import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, User, Users, Crown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getSkillScoreLabel, getScoreColor, getScoreBgColor, type ScaleConfig } from '@/lib/scoreLabels';
import { CommentByEvaluator, SubSkillResult } from '@/hooks/useSkillSurveyResultsEnhanced';
import { SubSkillsDetailedReport } from './SubSkillsDetailedReport';
import { CommentsGroupedReport } from './CommentsGroupedReport';

interface ExpandableSkillCardProps {
  skill_name: string;
  skill_sub_category?: string;
  skill_description?: string;
  average_score: number;
  self_score?: number;
  supervisor_score?: number;
  colleague_score?: number;
  sub_skills: SubSkillResult[];
  comments: CommentByEvaluator[];
  /** Pass from StageTemplateConfig.scaleLabels.hard to use template labels instead of legacy defaults */
  scaleConfig?: ScaleConfig;
}

export const ExpandableSkillCard: React.FC<ExpandableSkillCardProps> = ({
  skill_name,
  skill_sub_category,
  skill_description,
  average_score,
  self_score,
  supervisor_score,
  colleague_score,
  sub_skills,
  comments,
  scaleConfig,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Группируем комментарии по типу
  const selfComments = comments.filter(c => c.evaluator_type === 'self');
  const supervisorComments = comments.filter(c => c.evaluator_type === 'supervisor');
  const colleagueComments = comments.filter(c => c.evaluator_type === 'colleague');

  return (
    <Card className="overflow-hidden">
      <div
        className={`p-6 cursor-pointer hover:bg-surface-secondary/50 transition-colors ${getScoreBgColor(average_score, 5)}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-text-primary">{skill_name}</h3>
              {skill_sub_category && (
                <Badge variant="secondary">
                  {skill_sub_category}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">Общая оценка:</span>
                <span className={`font-bold text-lg ${getScoreColor(average_score, 5)}`}>
                  {average_score.toFixed(1)}
                </span>
                <span className="text-text-tertiary text-xs">
                  ({getSkillScoreLabel(average_score, scaleConfig)})
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
            
            <div className="mt-3">
              <Progress value={(average_score / 5) * 100} className="h-2" />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {sub_skills.length > 0 && (
              <Badge variant="outline">
                {sub_skills.length} под-Hard Skills
              </Badge>
            )}
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
          {skill_description && (
            <div>
              <h4 className="font-semibold text-text-primary mb-2">Описание</h4>
              <p className="text-text-secondary text-sm leading-relaxed">{skill_description}</p>
            </div>
          )}

          {sub_skills.length > 0 && (
            <SubSkillsDetailedReport
              subSkills={sub_skills}
              selfScore={self_score}
              supervisorScore={supervisor_score}
              colleagueScore={colleague_score}
            />
          )}

          {comments.length > 0 && (
            <CommentsGroupedReport comments={comments} />
          )}
        </div>
      )}
    </Card>
  );
};