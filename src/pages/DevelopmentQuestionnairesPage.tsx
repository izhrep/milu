import React from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { SurveyAccessWidget } from '@/components/SurveyAccessWidget';

const DevelopmentQuestionnairesPage = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />
      
      <div>
        <h1 className="text-heading-2 font-bold text-foreground">Обратная связь 360</h1>
        <p className="text-muted-foreground mt-1">Доступные формы для обратной связи по hard и soft-навыкам</p>
      </div>

      <SurveyAccessWidget />
    </div>
  );
};

export default DevelopmentQuestionnairesPage;
