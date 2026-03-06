import React, { useState, useEffect } from 'react';
import { getFullName } from '@/hooks/useUsers';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface ProfileHeaderProps {
  userData?: any;
}

const ProfileHeader = ({ userData }: ProfileHeaderProps) => {
  const [companyName, setCompanyName] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchCompany = async () => {
      if (!userData?.departments?.company_id) return;
      
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('name')
          .eq('id', userData.departments.company_id)
          .single();
        
        if (error) throw error;
        setCompanyName(data?.name || null);
      } catch (err) {
        console.error('Error fetching company:', err);
      }
    };

    fetchCompany();
  }, [userData?.departments?.company_id]);

  return (
    <header className="flex w-full gap-2.5 mt-9 pb-3 px-6 max-md:max-w-full max-md:px-5">
      <div className="flex min-w-60 w-full items-center gap-10 flex-1 shrink basis-[0%] max-md:max-w-full">
        <div className="self-stretch flex min-w-60 w-full items-center gap-[40px_150px] flex-1 shrink basis-[0%] my-auto max-md:max-w-full">
          <div className="self-stretch flex min-w-60 items-center gap-5 my-auto max-md:max-w-full">
            <div className="self-stretch flex min-w-60 flex-col items-stretch justify-center my-auto pt-2.5">
              <div className="flex gap-2.5 text-[34px] text-[#202020] font-semibold leading-none">
                <h1 className="text-[#202020]">{getFullName(userData) || 'Загрузка...'}</h1>
              </div>
              <div className="flex items-center gap-5 text-sm font-normal mt-2.5">
                <div className="text-[#8D999C] leading-none self-stretch my-auto">
                  {userData?.positions?.name || 'Должность не указана'}
                </div>
                {companyName && (
                  <Badge variant="outline" className="bg-brand-blue/10 text-brand-blue border-brand-blue/20">
                    {companyName}
                  </Badge>
                )}
                {userData?.departments?.name && (
                  <Badge variant="outline" className="bg-brand-orange/10 text-brand-orange border-brand-orange/20">
                    {userData.departments.name}
                  </Badge>
                )}
                <div className="text-[#FF8934] leading-none opacity-80 self-stretch my-auto">
                  👨‍💻 {userData?.status || 'Статус не указан'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default ProfileHeader;
