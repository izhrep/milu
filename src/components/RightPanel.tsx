import React from 'react';
import Calendar from './Calendar';

const RightPanel = () => {
  return (
    <aside className="max-w-[480px] items-stretch flex min-w-60 flex-col overflow-hidden w-80 bg-[#F6F6F6] p-3 border-[rgba(32,32,32,0.1)] border-l">
      <Calendar />
      
      {/* Event Cards */}
      <article className="shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)] w-full bg-[#89F4C7] mt-3 px-6 py-5 rounded-[20px] max-md:px-5">
        <div className="flex w-full items-center gap-3">
          <div className="justify-center items-center self-stretch flex flex-col overflow-hidden whitespace-nowrap tracking-[-0.5px] w-14 h-14 bg-[#030527] my-auto px-[11px] rounded-[120px]">
            <div className="flex flex-col items-center justify-center">
              <div className="text-white text-lg font-medium leading-[1.4]">25</div>
              <div className="text-[#EFF2F6] text-center text-[10px] font-light">Дек.</div>
            </div>
          </div>
          <div className="text-[#030527] text-sm font-normal leading-[21px] flex-1 shrink basis-[22px] my-auto">
            Корпоратиная культура <br />и эвэнты
          </div>
        </div>
        <div className="flex w-full gap-2 justify-center mt-5">
          <div className="text-[#030527] flex-1 shrink basis-[0%]">
            <div className="text-[#030527] text-xs font-normal leading-none">
              Корпоративная культура
            </div>
            <div className="w-full text-lg font-medium tracking-[-0.18px] leading-5 mt-[5px]">
              <h3 className="text-[#030527]">
                Новогодний <br />
                корпоратив
              </h3>
            </div>
          </div>
          <div className="items-stretch flex flex-col justify-center w-[84px] bg-[rgba(3,5,39,0.40)] p-0.5 rounded-[40px]">
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/cd3a1bebb7c9e5efbf457bccea924da2a57564cb?placeholderIfAbsent=true"
              className="aspect-[2.5] object-contain w-full"
              alt="Event preview"
            />
          </div>
        </div>
      </article>
      
      <article className="shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)] w-full bg-white mt-3 px-6 py-5 rounded-[20px] max-md:px-5">
        <div className="flex w-full items-center gap-3 whitespace-nowrap">
          <div className="justify-center items-center self-stretch flex flex-col overflow-hidden tracking-[-0.5px] w-14 h-14 bg-[#030527] my-auto px-[11px] rounded-[120px]">
            <div className="flex flex-col items-center justify-center">
              <div className="text-white text-lg font-medium leading-[1.4]">23</div>
              <div className="text-[#EFF2F6] text-center text-[10px] font-light">Дек.</div>
            </div>
          </div>
          <div className="text-[#030527] text-sm font-normal self-stretch flex-1 shrink basis-[22px] my-auto">
            Важное
          </div>
        </div>
        <div className="flex w-full gap-2 justify-center mt-5">
          <div className="text-[#030527] flex-1 shrink basis-[0%]">
            <div className="text-[#030527] text-xs font-normal leading-none">
              Магазин
            </div>
            <div className="w-full text-lg font-medium tracking-[-0.18px] leading-5 mt-[5px]">
              <h3 className="text-[#030527]">
                Командная встреча
              </h3>
            </div>
          </div>
          <div className="items-stretch flex flex-col justify-center w-[84px] bg-[rgba(3,5,39,0.40)] p-0.5 rounded-[40px]">
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/cd3a1bebb7c9e5efbf457bccea924da2a57564cb?placeholderIfAbsent=true"
              className="aspect-[2.5] object-contain w-full"
              alt="Meeting preview"
            />
          </div>
        </div>
      </article>
      
      <div className="self-center flex items-center gap-2.5 text-[39px] text-[#202020] font-bold whitespace-nowrap text-center tracking-[-0.59px] leading-none justify-center mt-3 py-3">
        <div className="self-stretch my-auto">Milu</div>
      </div>
    </aside>
  );
};

export default RightPanel;
