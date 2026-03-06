import React, { useState } from 'react';

const Calendar = () => {
  const [currentMonth, setCurrentMonth] = useState('Декабрь 2024');
  
  const weekDays = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
  const calendarData = [
    [1, 2, 3, 4, 5, 6, 7],
    [8, 9, 10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19, 20, 21],
    [22, 23, 24, 25, 26, 27, 28],
    [29, 30, 31, 1, 2, 3, 4]
  ];

  const getDateClasses = (date: number, weekIndex: number, dayIndex: number) => {
    const isNextMonth = weekIndex === 4 && date <= 4;
    const isToday = date === 25 && weekIndex === 3 && dayIndex === 3;
    const isSpecialDate = date === 26 && weekIndex === 3 && dayIndex === 4;
    const isBordered = date === 21 && weekIndex === 2 && dayIndex === 6;
    
    let classes = "flex min-h-[30px] w-[30px] items-center justify-center rounded-[100px]";
    
    if (isToday) {
      classes += " bg-[#6717FF] text-white";
    } else if (isSpecialDate) {
      classes += " bg-[#F8B5E5] text-[#030527]";
    } else if (isBordered) {
      classes += " border border-solid border-[#6717FF] text-[#030527]";
    } else if (isNextMonth) {
      classes += " text-[#B8C2CC]";
    } else {
      classes += " text-[#030527]";
    }
    
    return classes;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    // In a real implementation, this would update the calendar data
    console.log(`Navigate ${direction}`);
  };

  return (
    <div className="shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)] w-full bg-white px-6 py-5 rounded-[20px] max-md:px-5">
      <header className="flex w-full items-center gap-[40px_92px] justify-between">
        <h2 className="text-[#030527] text-center text-sm font-medium leading-none self-stretch my-auto">
          {currentMonth}
        </h2>
        <div className="self-stretch flex items-center gap-2 my-auto">
          <button 
            onClick={() => navigateMonth('prev')}
            className="items-center self-stretch flex gap-2 w-6 h-6 bg-[#F7F8FA] my-auto p-1.5 rounded-[40px] hover:bg-gray-200 transition-colors"
            aria-label="Previous month"
          >
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/a3988b6b22aaafec7f6724f63cc2b4f638de82bc?placeholderIfAbsent=true"
              className="aspect-[1] object-contain w-3 self-stretch my-auto"
              alt=""
            />
          </button>
          <button 
            onClick={() => navigateMonth('next')}
            className="items-center self-stretch flex gap-2 w-6 h-6 bg-[#F7F8FA] my-auto p-1.5 rounded-[40px] hover:bg-gray-200 transition-colors"
            aria-label="Next month"
          >
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/813205895cf872aa23bf38f1543933b363f667ac?placeholderIfAbsent=true"
              className="aspect-[1] object-contain w-3 self-stretch my-auto"
              alt=""
            />
          </button>
        </div>
      </header>
      
      <div className="w-full text-sm text-[#030527] whitespace-nowrap text-center leading-none mt-[19px]">
        <div className="flex w-full items-center gap-[15px] font-medium justify-between">
          {weekDays.map((day, index) => (
            <div key={index} className="self-stretch flex min-h-[30px] items-center justify-center w-[23px] my-auto rounded-[100px]">
              <div className="text-[#030527] self-stretch w-4 my-auto">{day}</div>
            </div>
          ))}
        </div>
        
        <div className="flex w-full items-center gap-[19px] font-light mt-2">
          {Array.from({ length: 7 }, (_, dayIndex) => (
            <div key={dayIndex} className="self-stretch flex flex-col items-center justify-center flex-1 shrink basis-[0%] my-auto">
              {calendarData.map((week, weekIndex) => (
                <button
                  key={`${weekIndex}-${dayIndex}`}
                  className={`${getDateClasses(week[dayIndex], weekIndex, dayIndex)} ${weekIndex > 0 ? 'mt-2' : ''} hover:bg-opacity-80 transition-colors`}
                  onClick={() => console.log(`Selected date: ${week[dayIndex]}`)}
                >
                  <div className="self-stretch w-[18px] my-auto">
                    {week[dayIndex]}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Calendar;
