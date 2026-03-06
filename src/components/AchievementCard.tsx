import React from 'react';

interface AchievementCardProps {
  title: string;
  description: string;
}

const AchievementCard: React.FC<AchievementCardProps> = ({ title, description }) => {
  return (
    <div className="flex min-w-60 items-center gap-2.5 flex-1 shrink basis-[0%] max-md:max-w-full">
      <div className="self-stretch flex min-w-60 w-[507px] flex-col items-stretch justify-center flex-1 shrink basis-[0%] my-auto">
        <h3 className="text-[#202020] text-xl font-medium leading-[1.2] max-md:max-w-full">
          {title}
        </h3>
        <p className="text-[#FF8934] text-xs font-normal leading-none max-md:max-w-full">
          {description}
        </p>
      </div>
    </div>
  );
};

export default AchievementCard;
