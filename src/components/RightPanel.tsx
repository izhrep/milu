import React from 'react';
import Calendar from './Calendar';

const RightPanel = () => {
  return (
    <aside className="max-w-[480px] items-stretch flex min-w-60 flex-col overflow-hidden w-80 bg-muted p-3 border-border border-l">
      <Calendar />
      
      {/* Event Cards */}
      <article className="shadow-card w-full bg-chart-4 mt-3 px-6 py-5 rounded-[20px] max-md:px-5">
        <div className="flex w-full items-center gap-3">
          <div className="justify-center items-center self-stretch flex flex-col overflow-hidden whitespace-nowrap tracking-[-0.5px] w-14 h-14 bg-foreground my-auto px-[11px] rounded-[120px]">
            <div className="flex flex-col items-center justify-center">
              <div className="text-white text-body-lg font-medium leading-[1.4]">25</div>
              <div className="text-muted text-center text-helpertext-xs font-light">Дек.</div>
            </div>
          </div>
          <div className="text-foreground text-body-md font-normal leading-[21px] flex-1 shrink basis-[22px] my-auto">
            Корпоратиная культура <br />и эвэнты
          </div>
        </div>
        <div className="flex w-full gap-2 justify-center mt-5">
          <div className="text-foreground flex-1 shrink basis-[0%]">
            <div className="text-foreground text-caption-sm font-normal leading-none">
              Корпоративная культура
            </div>
            <div className="w-full text-body-lg font-medium tracking-[-0.18px] leading-5 mt-[5px]">
              <h3 className="text-foreground">
                Новогодний <br />
                корпоратив
              </h3>
            </div>
          </div>
          <div className="items-stretch flex flex-col justify-center w-[84px] bg-primary/40 p-0.5 rounded-[40px]">
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/cd3a1bebb7c9e5efbf457bccea924da2a57564cb?placeholderIfAbsent=true"
              className="aspect-[2.5] object-contain w-full"
              alt="Event preview"
            />
          </div>
        </div>
      </article>
      
      <article className="shadow-card w-full bg-white mt-3 px-6 py-5 rounded-[20px] max-md:px-5">
        <div className="flex w-full items-center gap-3 whitespace-nowrap">
          <div className="justify-center items-center self-stretch flex flex-col overflow-hidden tracking-[-0.5px] w-14 h-14 bg-foreground my-auto px-[11px] rounded-[120px]">
            <div className="flex flex-col items-center justify-center">
              <div className="text-white text-body-lg font-medium leading-[1.4]">23</div>
              <div className="text-muted text-center text-helpertext-xs font-light">Дек.</div>
            </div>
          </div>
          <div className="text-foreground text-body-md font-normal self-stretch flex-1 shrink basis-[22px] my-auto">
            Важное
          </div>
        </div>
        <div className="flex w-full gap-2 justify-center mt-5">
          <div className="text-foreground flex-1 shrink basis-[0%]">
            <div className="text-foreground text-caption-sm font-normal leading-none">
              Магазин
            </div>
            <div className="w-full text-body-lg font-medium tracking-[-0.18px] leading-5 mt-[5px]">
              <h3 className="text-foreground">
                Командная встреча
              </h3>
            </div>
          </div>
          <div className="items-stretch flex flex-col justify-center w-[84px] bg-primary/40 p-0.5 rounded-[40px]">
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/cd3a1bebb7c9e5efbf457bccea924da2a57564cb?placeholderIfAbsent=true"
              className="aspect-[2.5] object-contain w-full"
              alt="Meeting preview"
            />
          </div>
        </div>
      </article>
      
      <div className="self-center flex items-center gap-2.5 text-[39px] text-foreground font-bold whitespace-nowrap text-center tracking-[-0.59px] leading-none justify-center mt-3 py-3">
        <div className="self-stretch my-auto">Milu</div>
      </div>
    </aside>
  );
};

export default RightPanel;
