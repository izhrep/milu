import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Target } from "@/components/icons";
import { useAuth } from '@/contexts/AuthContext';
import { CareerTrackDetails } from '@/components/CareerTrackDetails';
import { CareerTracksWidget } from '@/components/CareerTracksWidget';
import { useCareerTracks } from '@/hooks/useCareerTracks';
import { useCompetencyProfile } from '@/hooks/useCompetencyProfile';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';

const DevelopmentCareerTrackPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { profile, loading: profileLoading } = useCompetencyProfile(currentUser?.id);
  const { tracks, loading: tracksLoading } = useCareerTracks(currentUser?.id, profile);

  // Временно: карьерный трек доступен только для admin
  if (currentUser && currentUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const isLoading = !currentUser || profileLoading || tracksLoading;

  const handleSelectTrack = async (trackId: string, stepId?: string) => {
    // Track selection is handled in CareerTracksWidget
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">
            {!currentUser ? 'Загрузка пользователя...' : 
             profileLoading ? 'Загрузка профиля компетенций...' : 
             'Загрузка карьерных треков...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-2 font-bold text-foreground">Карьерный трек</h1>
          <p className="text-muted-foreground mt-1">Ваш путь профессионального развития</p>
        </div>
        <Button
          onClick={() => navigate('/development/career-track/recommendations')}
          variant="outline"
          className="gap-2"
        >
          <Target className="w-4 h-4" />
          Рекомендации
        </Button>
      </div>

      <div className="space-y-6">
        {/* Current Career Track */}
        <CareerTrackDetails onSelectTrack={handleSelectTrack} />

        {/* Recommended Career Tracks */}
        <div className="mt-8">
          <h2 className="text-heading-3 font-semibold text-foreground mb-4">Рекомендуемые карьерные треки</h2>
          <p className="text-muted-foreground mb-6">
            Выберите карьерный трек, соответствующий вашим целям и навыкам. 
            Каждый трек содержит детальную информацию о шагах развития, требованиях и вашем текущем прогрессе.
          </p>
          <CareerTracksWidget 
            tracks={tracks} 
            loading={tracksLoading} 
            onSelectTrack={handleSelectTrack}
          />
        </div>
      </div>
    </div>
  );
};

export default DevelopmentCareerTrackPage;
