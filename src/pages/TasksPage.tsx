import React from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { TasksManager } from '@/components/TasksManager';

const TasksPage = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />
      
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Мои задачи</h1>
        <p className="text-text-secondary mt-1">Управление вашими задачами</p>
      </div>

      <TasksManager />
    </div>
  );
};

export default TasksPage;
