import React from 'react';

const Sidebar = () => {
  return (
    <aside className="max-w-40 overflow-hidden w-[79px] bg-muted border-r-foreground/10 border-r border-solid max-md:hidden">
      <div className="w-full flex-1 pb-[938px] max-md:hidden max-md:pb-[100px]">
        <div className="flex mb-[-188px] w-full flex-col items-stretch max-md:mb-2.5">
          <div className="self-center flex min-h-[68px] w-[72px] items-center justify-center px-2 py-3">
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/da1e85c8fed6793e00cd4e6b579240bab7e5a2b8?placeholderIfAbsent=true"
              className="aspect-[1] object-contain w-11 self-stretch my-auto rounded-[32px]"
              alt="Logo"
            />
          </div>
          <div className="w-full px-3">
            <div className="w-full">
              <div className="justify-center items-center backdrop-blur-lg bg-background/10 flex w-full gap-3 overflow-hidden p-1.5 rounded-3xl">
                <div className="self-stretch flex w-9 flex-col items-stretch justify-center my-auto">
                  <div className="justify-center items-center flex min-h-9 w-9 gap-2.5 h-9 bg-foreground px-1 rounded-3xl">
                    <img
                      src="https://api.builder.io/api/v1/image/assets/TEMP/126c8903340c81df7b3554a98cd4ad1743cf812b?placeholderIfAbsent=true"
                      className="aspect-[1] object-contain w-6 self-stretch my-auto"
                      alt="Active icon"
                    />
                  </div>
                  <div className="flex min-h-9 w-9 items-center gap-2.5 justify-center mt-1 px-1 py-1.5 rounded-3xl">
                    <img
                      src="https://api.builder.io/api/v1/image/assets/TEMP/ea0df604ecd47b13ad87fbf9c4cdf87cece0d902?placeholderIfAbsent=true"
                      className="aspect-[1] object-contain w-6 self-stretch my-auto"
                      alt="Secondary icon"
                    />
                  </div>
                </div>
              </div>
              <div className="w-full mt-5">
                <div className="justify-center items-center backdrop-blur-lg bg-background/5 flex min-h-12 w-full gap-3 text-helpertext-xs text-muted font-semibold whitespace-nowrap leading-[1.2] px-1.5 py-2 rounded-xl">
                  <div className="self-stretch flex w-full items-center justify-center flex-1 shrink basis-[0%] my-auto">
                    <div className="self-stretch flex items-center gap-2.5 justify-center my-auto pl-1 py-1 rounded-[32px]">
                      <div className="justify-center items-center shadow-md backdrop-blur-[50px] self-stretch flex gap-2 overflow-hidden w-5 h-5 my-auto px-1 rounded-[36px] border-[1.5px] border-solid border-background/40">
                        <div className="self-stretch my-auto">12</div>
                      </div>
                    </div>
                  </div>
                </div>
                {[
                  "https://api.builder.io/api/v1/image/assets/TEMP/9f63f46f4d0e01febf34be43a988e65c2ffe4679?placeholderIfAbsent=true",
                  "https://api.builder.io/api/v1/image/assets/TEMP/9f8c634bd20e4911b68efbb84bd753809debd371?placeholderIfAbsent=true",
                  "https://api.builder.io/api/v1/image/assets/TEMP/b9f5f7ce0ba446580caffd180663a25588ed4506?placeholderIfAbsent=true",
                  "https://api.builder.io/api/v1/image/assets/TEMP/649e7c8d18085efc78435ddb22f1b670562aabb7?placeholderIfAbsent=true",
                  "https://api.builder.io/api/v1/image/assets/TEMP/3e5f309232b3c00760dc0023e76f3286b20fc53b?placeholderIfAbsent=true",
                  "https://api.builder.io/api/v1/image/assets/TEMP/fbdb2afc2e14271c1df9d2e6986b431b8a560b25?placeholderIfAbsent=true"
                ].map((src, index) => (
                  <div key={index} className="justify-center items-center backdrop-blur-lg flex min-h-12 w-full gap-3 overflow-hidden bg-transparent mt-1 px-1.5 py-2 rounded-xl">
                    <div className="self-stretch flex w-full items-center justify-center flex-1 shrink basis-[0%] my-auto">
                      <div className="self-stretch flex w-8 items-center gap-2.5 justify-center my-auto p-1 rounded-[32px]">
                        <img
                          src={src}
                          className="aspect-[1] object-contain w-6 self-stretch my-auto"
                          alt={`Navigation icon ${index + 1}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex w-full flex-col items-stretch p-3">
        <div className="justify-between items-center backdrop-blur-lg flex min-h-12 w-full overflow-hidden bg-transparent px-1.5 py-2 rounded-[48px]">
          <div className="self-stretch flex w-full items-center gap-3 justify-center flex-1 shrink basis-[0%] my-auto">
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/60c23dd65a87f56d2bb4ce56422e61edeed97143?placeholderIfAbsent=true"
              className="aspect-[1] object-contain w-8 self-stretch my-auto"
              alt="User avatar"
            />
          </div>
        </div>
        <div className="justify-center items-center shadow-md backdrop-blur-[50px] self-center flex w-11 gap-2.5 overflow-hidden h-11 bg-foreground mt-2 px-2.5 rounded-[32px] border-[1.5px] border-solid border-background/40">
          <img
            src="https://api.builder.io/api/v1/image/assets/TEMP/0cbf0c1488e90cd0d0d0be1bc5e04db36d7939fa?placeholderIfAbsent=true"
            className="aspect-[1] object-contain w-6 self-stretch my-auto"
            alt="Bottom action"
          />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
