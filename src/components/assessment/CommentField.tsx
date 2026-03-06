import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface CommentFieldProps {
  questionId: string;
  comment: string;
  isAnonymous: boolean;
  evaluatorType: 'self' | 'manager' | 'peer';
  onCommentChange: (value: string) => void;
  onAnonymousChange: (value: boolean) => void;
  disabled?: boolean;
  required?: boolean;
}

export const CommentField: React.FC<CommentFieldProps> = ({
  questionId,
  comment,
  isAnonymous,
  evaluatorType,
  onCommentChange,
  onAnonymousChange,
  disabled = false,
  required = false
}) => {
  const maxLength = 2000;
  
  // Определяем текст подсказки в зависимости от типа оценивающего
  const getCommentLabelText = () => {
    if (evaluatorType === 'self') {
      return 'Пожалуйста, приведите конкретный пример или ситуацию, которые иллюстрируют ваш выбор.';
    } else if (evaluatorType === 'manager') {
      return 'Пожалуйста, приведите конкретный пример или ситуацию, которые иллюстрируют ваш выбор. Это поможет вашему сотруднику понять контекст и сделать выводы для развития.';
    } else {
      return 'Пожалуйста, приведите конкретный пример или ситуацию, которые иллюстрируют ваш выбор. Это поможет вашему коллеге понять контекст и сделать выводы для развития.';
    }
  };

  const getAnonymityText = () => {
    if (evaluatorType === 'self') {
      return 'Ваш ответ не анонимен для вас самих';
    } else if (evaluatorType === 'manager') {
      return 'Ваш ответ не анонимен для сотрудника, о котором вы оставляете фидбек';
    } else {
      return 'Ваши ответы являются анонимными для сотрудника, о котором вы оставляете фидбек';
    }
  };
  
  return (
    <div className="mt-4 space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`comment-${questionId}`} className="text-sm">
          {getCommentLabelText()}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Textarea
          id={`comment-${questionId}`}
          placeholder="Оставьте свой комментарий к фидбеку"
          value={comment}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= maxLength) {
              onCommentChange(value);
            }
          }}
          disabled={disabled}
          className="min-h-[80px] resize-y"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{comment.length} / {maxLength} символов</span>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {getAnonymityText()}
      </div>
    </div>
  );
};
