import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, Target, CheckSquare, TrendingUp, Users } from "@/components/icons";
import { useAuth } from '@/contexts/AuthContext';
import { CareerTrackDetails } from '@/components/CareerTrackDetails';
import { TasksManager } from '@/components/TasksManager';
import { SurveyAccessWidget } from '@/components/SurveyAccessWidget';
import { CareerTracksWidget } from '@/components/CareerTracksWidget';
import { useCareerTracks } from '@/hooks/useCareerTracks';
import { useCompetencyProfile } from '@/hooks/useCompetencyProfile';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';

const DevelopmentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'career-track' | 'tasks' | 'surveys' | 'recommendations'>('career-track');
  
  const { profile, loading: profileLoading } = useCompetencyProfile(currentUser?.id);
  const { tracks, loading: tracksLoading } = useCareerTracks(currentUser?.id, profile);

  const isLoading = !currentUser || profileLoading || tracksLoading;

  // Обработка параметра tab из URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'surveys' || tab === 'tasks' || tab === 'career-track' || tab === 'recommendations') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">
            {!currentUser ? 'Загрузка пользователя...' : 
             profileLoading ? 'Загрузка профиля компетенций...' : 
             'Загрузка карьерных треков...'}
          </p>
        </div>
      </div>
    );
  }

  const handleSelectTrack = async (trackId: string, stepId?: string) => {
    try {
      // Этот вызов теперь обрабатывается в CareerTracksWidget
      setActiveTab('career-track');
    } catch (error) {
      console.error('Error selecting track:', error);
    }
  };

  const handleNavigateToSurveys = () => {
    setActiveTab('surveys');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />
      
      {/* Header */}
      <div>
        <h1 className="text-heading-2 font-bold text-foreground">Мое развитие</h1>
        <p className="text-muted-foreground mt-1">Управление карьерным треком и задачами развития</p>
      </div>

      {/* Development Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setActiveTab('career-track')}
          variant={activeTab === 'career-track' ? 'default' : 'outline'}
          className="gap-2"
        >
          <Target className="w-4 h-4" />
          Карьерный трек
        </Button>
        <Button
          onClick={() => setActiveTab('tasks')}
          variant={activeTab === 'tasks' ? 'default' : 'outline'}
          className="gap-2"
        >
          <CheckSquare className="w-4 w-4" />
          Задачи
        </Button>
        <Button
          onClick={() => setActiveTab('surveys')}
          variant={activeTab === 'surveys' ? 'default' : 'outline'}
          className="gap-2"
        >
          <Users className="w-4 h-4" />
          Опросники
        </Button>
        <Button
          onClick={() => setActiveTab('recommendations')}
          variant={activeTab === 'recommendations' ? 'default' : 'outline'}
          className="gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          Рекомендации
        </Button>
      </div>

      {/* Content based on active tab */}
      <div>
        {activeTab === 'career-track' && <CareerTrackDetails onSelectTrack={handleSelectTrack} />}
        {activeTab === 'tasks' && <TasksManager onNavigateToSurveys={handleNavigateToSurveys} />}
        {activeTab === 'surveys' && <SurveyAccessWidget />}
        {activeTab === 'recommendations' && (
          <div className="space-y-6">
            <div className="mb-6">
              <h4 className="text-body-lg font-semibold text-foreground mb-2">Рекомендуемые карьерные треки</h4>
              <p className="text-muted-foreground">
                Выберите карьерный трек, соответствующий вашим целям и навыкам. 
                Каждый трек содержит детальную информацию о шагах развития, требованиях и вашем текущем прогрессе.
              </p>
            </div>
            
            <CareerTracksWidget 
              tracks={tracks} 
              loading={tracksLoading} 
              onSelectTrack={handleSelectTrack}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DevelopmentPage;
