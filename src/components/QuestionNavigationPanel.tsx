import React from 'react';
import { CheckCircle, Circle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

interface Question {
  id: string;
  text: string;
  category?: string;
}

interface QuestionNavigationPanelProps {
  questions: Question[];
  answeredQuestionIds: Set<string>;
  currentQuestionId?: string;
  onQuestionClick: (questionId: string) => void;
}

export const QuestionNavigationPanel: React.FC<QuestionNavigationPanelProps> = ({
  questions,
  answeredQuestionIds,
  currentQuestionId,
  onQuestionClick
}) => {
  // Группируем вопросы по категориям
  const groupedQuestions = questions.reduce((acc, question) => {
    const category = question.category || 'Другое';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(question);
    return acc;
  }, {} as Record<string, Question[]>);

  const answeredCount = answeredQuestionIds.size;
  const totalCount = questions.length;
  const progressPercent = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;

  return (
    <Card className="w-80 h-full bg-surface-primary border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-text-primary mb-2">Навигация по вопросам</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-text-secondary">
            <span>Прогресс</span>
            <span className="font-medium">{answeredCount} из {totalCount}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-brand-purple rounded-full transition-all duration-500 progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="p-4 space-y-4">
          {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
            <div key={category} className="space-y-2">
              <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                {category}
              </h4>
              <div className="space-y-1">
                {categoryQuestions.map((question, index) => {
                  const isAnswered = answeredQuestionIds.has(question.id);
                  const isCurrent = currentQuestionId === question.id;
                  
                  return (
                    <button
                      key={question.id}
                      onClick={() => onQuestionClick(question.id)}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all",
                        isCurrent && "bg-brand-purple/10 border border-brand-purple/30",
                        !isCurrent && "hover:bg-gray-100"
                      )}
                    >
                      {isAnswered ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className={cn(
                        "text-sm flex-1 line-clamp-2",
                        isCurrent ? "font-medium text-brand-purple" : "text-text-primary"
                      )}>
                        {index + 1}. {question.text.length > 50 
                          ? `${question.text.substring(0, 50)}...` 
                          : question.text}
                      </span>
                      {isCurrent && (
                        <ChevronRight className="w-4 h-4 text-brand-purple flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};
