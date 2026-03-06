import React from 'react';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import RightPanel from './RightPanel';

const ProfileDashboard = () => {
  return (
    <div className="items-stretch border shadow-[2px_4px_16px_0_rgba(248,248,248,0.06)_inset,0_54px_32px_-16px_rgba(5,5,5,0.05),0_24px_24px_-16px_rgba(5,5,5,0.09),0_6px_12px_0_rgba(5,5,5,0.10),0_4px_4px_-4px_rgba(5,5,5,0.10),0_0.5px_1.5px_-4px_rgba(5,5,5,0.50)] flex overflow-hidden flex-wrap rounded-[32px] border-solid border-[rgba(255,255,255,0.40)]">
      <Sidebar />
      <MainContent />
      <RightPanel />
    </div>
  );
};

export default ProfileDashboard;
