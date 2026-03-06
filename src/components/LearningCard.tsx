import React from 'react';

interface LearningCardProps {
  type: string;
  title: string;
  status: string;
  dates: string;
  format: string;
  mentor: string;
  progress?: string;
  progressText?: string;
  isCompleted?: boolean;
  completionDate?: string;
  currentStage?: string;
  backgroundColor?: string;
}

const LearningCard: React.FC<LearningCardProps> = ({
  type,
  title,
  status,
  dates,
  format,
  mentor,
  progress,
  progressText,
  isCompleted,
  completionDate,
  currentStage,
  backgroundColor = "bg-gradient-to-br from-purple-600 to-blue-600"
}) => {
  const cardClasses = isCompleted 
    ? "border flex min-w-60 flex-col overflow-hidden items-stretch justify-center flex-1 shrink basis-[0%] px-6 py-4 rounded-[20px] border-[rgba(241,96,0,1)] border-solid max-md:px-5"
    : `items-stretch shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)] flex min-w-60 flex-col overflow-hidden justify-center flex-1 shrink basis-[0%] px-6 py-4 rounded-[20px] max-md:px-5 ${backgroundColor}`;

  const textColor = isCompleted ? "text-[#202020]" : "text-white";

  return (
    <article className={cardClasses}>
      <div className="w-full">
        <div className="w-full">
          <div className="w-full">
            <div className="w-full">
              <div className={`w-full ${textColor} font-semibold`}>
                <div className="flex w-full gap-[40px_100px] text-xs whitespace-nowrap leading-none justify-between">
                  <div className={`${textColor} opacity-70`}>
                    {type}
                  </div>
                  <div className="flex items-center gap-2.5 text-right justify-center">
                    <div className={`${textColor} self-stretch my-auto`}>
                      {status}
                    </div>
                  </div>
                </div>
                <h3 className={`${textColor} text-2xl leading-[26px] tracking-[-0.48px] mt-1`}>
                  {title}
                </h3>
              </div>
              <div className="w-full text-xs font-normal leading-none mt-2">
                <div className="flex w-full gap-[5px]">
                  <span className={`${textColor} opacity-50`}>
                    {isCompleted ? "Дата завершения:" : "Сроки:"}
                  </span>
                  <span className={textColor}>
                    {isCompleted ? completionDate : dates}
                  </span>
                </div>
                {!isCompleted && (
                  <div className="flex w-full gap-[5px]">
                    <span className={`${textColor} opacity-50`}>Формат:</span>
                    <span className={textColor}>{format}</span>
                  </div>
                )}
                {currentStage && (
                  <div className="flex w-full gap-[5px]">
                    <span className={`${textColor} opacity-50`}>Текущий этап:</span>
                    <span className={textColor}>{currentStage}</span>
                  </div>
                )}
                {!isCompleted && (
                  <div className="flex w-full gap-[5px]">
                    <span className={`${textColor} opacity-50`}>Наставник:</span>
                    <span className={textColor}>{mentor}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {progress && (
          <div className={`flex w-full gap-2.5 ${textColor} ${isCompleted ? 'mt-8' : 'mt-4'}`}>
            <div className={`${isCompleted ? 'text-center text-2xl font-bold leading-none bg-clip-text' : `${textColor} text-center text-2xl font-bold leading-none`}`}>
              {progress}
            </div>
            <div className={`${isCompleted ? `${textColor} text-xs font-medium leading-[22px] opacity-70 w-[146px]` : `${textColor} text-xs font-medium leading-[22px] w-[146px]`}`}>
              {progressText}
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

export default LearningCard;
