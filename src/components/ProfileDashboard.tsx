import React from 'react';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import RightPanel from './RightPanel';

const ProfileDashboard = () => {
  return (
    <div className="items-stretch border shadow-lg flex overflow-hidden flex-wrap rounded-[32px] border-solid border-background/40">
      <Sidebar />
      <MainContent />
      <RightPanel />
    </div>
  );
};

export default ProfileDashboard;
