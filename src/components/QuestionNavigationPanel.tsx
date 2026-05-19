import React from 'react';
import { CheckCircle, Circle, ChevronRight } from "@/components/icons";
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
    <Card className="w-80 h-full bg-card-primary border border-border">
      <div className="p-4 border-b border-border">
        <h3 className="text-body-lg font-semibold text-foreground mb-2">Навигация по вопросам</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-body-md text-muted-foreground">
            <span>Прогресс</span>
            <span className="font-medium">{answeredCount} из {totalCount}</span>
          </div>
          <div className="w-full bg-border rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-accent rounded-full transition-all duration-500 progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="p-4 space-y-4">
          {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
            <div key={category} className="space-y-2">
              <h4 className="text-body-md font-semibold text-muted-foreground uppercase tracking-wide">
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
                        isCurrent && "bg-accent/10 border border-accent/30",
                        !isCurrent && "hover:bg-muted"
                      )}
                    >
                      {isAnswered ? (
                        <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground/70 flex-shrink-0" />
                      )}
                      <span className={cn(
                        "text-body-md flex-1 line-clamp-2",
                        isCurrent ? "font-medium text-accent" : "text-foreground"
                      )}>
                        {index + 1}. {question.text.length > 50 
                          ? `${question.text.substring(0, 50)}...` 
                          : question.text}
                      </span>
                      {isCurrent && (
                        <ChevronRight className="w-4 h-4 text-accent flex-shrink-0" />
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
