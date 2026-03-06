import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileHeader from './ProfileHeader';
import AchievementCard from './AchievementCard';
import LearningCard from './LearningCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSupervisors, getFullName as getSupervisorFullName } from '@/hooks/useSupervisors';
import { useUserSkills } from '@/hooks/useUserSkills';
import { useUserQualities } from '@/hooks/useUserQualities';
import { useUserAssessmentResults } from '@/hooks/useUserAssessmentResults';
import { useSurvey360Assignments } from '@/hooks/useSurvey360Assignments';
import { useSurvey360Results } from '@/hooks/useSurvey360Results';
import { useSkillAssessmentResults } from '@/hooks/useSkillAssessmentResults';
import { useCompetencyProfile } from '@/hooks/useCompetencyProfile';
import { useCareerTracks } from '@/hooks/useCareerTracks';
import { CompetencyProfileWidget } from './CompetencyProfileWidget';
import { DevelopmentTasksWidget } from './GapAnalysisWidget';
import { CareerTracksWidget } from './CareerTracksWidget';
import { CareerProgressWidget } from './CareerProgressWidget';
import MapDialog from './MapDialog';

const MainContent = () => {
  const navigate = useNavigate();

  // Функция для получения инициалов из полного имени
  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(name => name.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };
  const [activeTab, setActiveTab] = useState('profile');
  const [expandedSections, setExpandedSections] = useState({
    personal: false,
    skills: false,
    achievements: false,
    career: true,
    learning: false
  });
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const { user: currentUser } = useAuth();
  const { supervisors, loading: supervisorsLoading, getFullName } = useSupervisors();
  const { skills, loading: skillsLoading } = useUserSkills();
  const { qualities, loading: qualitiesLoading } = useUserQualities();
  const { qualityResults, skillResults, loading: assessmentResultsLoading } = useUserAssessmentResults(currentUser?.id || '');
  const { qualityResults: assessmentQualities, skillResults: assessmentSkills, loading: assessmentLoading } = useUserAssessmentResults(currentUser?.id || '');
  const { assignments: survey360Assignments, loading: survey360AssignmentsLoading } = useSurvey360Assignments(currentUser?.id);
  const { aggregatedResults: survey360AggregatedResults, loading: survey360Loading } = useSurvey360Results(currentUser?.id);
  const { aggregatedResults: skillAggregatedResults, loading: skillAssessmentLoading } = useSkillAssessmentResults(currentUser?.id);
  const { profile: competencyProfile, loading: competencyLoading } = useCompetencyProfile(currentUser?.id);
  const { tracks: careerTracks, loading: tracksLoading, selectTrack } = useCareerTracks(currentUser?.id, competencyProfile || undefined);
  
  // Helper functions to check if buttons should be enabled
  const canStart360Survey = () => {
    if (!currentUser?.id || survey360AssignmentsLoading) return false;
    return survey360Assignments.some(assignment => 
      assignment.evaluating_user_id === currentUser.id && 
      assignment.status === 'отправлен запрос'
    );
  };

  const canStartSkillSurvey = () => {
    // Skill surveys are now part of unified diagnostic process via survey_360_assignments
    return true;
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;
      
      try {
        const { data: user } = await supabase
          .from('users')
          .select(`
            *,
            departments(name),
            positions(name)
          `)
          .eq('email', currentUser.email)
          .eq('status', true)
          .maybeSingle();
        
        console.log('Raw user data from DB:', user);
        
        if (user) {
          // Получаем профиль пользователя отдельным запросом
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          
          setUserData({ ...user, user_profiles: profile });
          console.log('User data loaded:', { ...user, user_profiles: profile });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const tabs = [
    { id: 'profile', label: 'Профиль', active: true },
    { id: 'development', label: 'Мое развитие', active: false },
    { id: 'learning', label: 'Обучение', active: false }
  ];

  return (
    <>
      <main className="min-w-60 overflow-hidden flex-1 shrink basis-6 bg-[#F6F6F6] pb-6 max-md:max-w-full">
      <div className="flex min-h-[70px] w-full items-center justify-center text-3xl text-[#202020] font-bold whitespace-nowrap text-center tracking-[-0.45px] leading-none py-[15px] max-md:max-w-full">
        <h1 className="text-[#202020] self-stretch my-auto">Milu</h1>
      </div>
      
      <ProfileHeader userData={userData} />
      
      <div className="w-full mt-9 px-3 max-md:max-w-full">
        <nav className="flex w-full items-center gap-5 text-2xl text-[#202020] font-medium leading-none px-3 py-2.5 max-md:max-w-full">
          <div className="self-stretch flex min-w-60 w-full gap-[40px_60px] flex-1 shrink basis-[0%] my-auto max-md:max-w-full">
            <div className="flex min-w-60 w-full items-center gap-5 flex-wrap flex-1 shrink basis-[0%] max-md:max-w-full">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`text-[#202020] self-stretch my-auto transition-opacity hover:opacity-100 ${
                    activeTab === tab.id ? 'opacity-80' : 'opacity-40'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
        
        <div className="w-full mt-3 max-md:max-w-full">
          <div className="w-full max-md:max-w-full">
            <div className="flex w-full items-center gap-2.5 text-lg text-[#202020] font-medium tracking-[-0.18px] leading-none justify-center pt-5 pb-2.5 px-3 max-md:max-w-full">
              <h2 className="text-[#202020] self-stretch flex-1 shrink basis-[0%] my-auto max-md:max-w-full">
                Общая информация
              </h2>
            </div>
            
            <section className="w-full max-md:max-w-full">
              <div className="shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)] flex w-full gap-6 flex-wrap bg-white p-6 rounded-[20px] max-md:max-w-full max-md:px-5">
                
                <div className="min-w-60 flex-1 shrink basis-[0%] max-md:max-w-full">
                  <h3 className="text-[#202020] text-sm font-medium leading-none">
                    Руководители
                  </h3>
                  <div className="flex w-full flex-col leading-[1.4] mt-2.5 max-md:max-w-full">
                    {supervisorsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <p className="text-[#718096] text-xs">Загрузка...</p>
                      </div>
                    ) : supervisors.length > 0 ? (
                      supervisors.map((supervisor, index) => (
                         <div key={supervisor.id} className={`flex items-center gap-[19px] ${index > 0 ? 'mt-5' : ''}`}>
                           <div className="aspect-[1] w-10 h-10 bg-[#FF8934] rounded-full flex items-center justify-center text-white text-sm font-semibold">
                             {getInitials(getFullName(supervisor))}
                           </div>
                           <div className="self-stretch flex flex-col w-[214px] my-auto pr-9 rounded-[0px_0px_0px_0px]">
                             <div className="text-[#202020] text-sm font-medium">
                               {getFullName(supervisor)}
                             </div>
                             <div className="text-[#718096] text-xs font-normal mt-1.5">
                               {supervisor.role}
                             </div>
                           </div>
                         </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center py-4">
                        <p className="text-[#718096] text-xs">Руководители не найдены</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Personal Information Section */}
              <Collapsible open={expandedSections.personal} onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, personal: open }))}>
                <div className="w-full mt-2.5 pb-3 px-3 max-md:max-w-full">
                  <CollapsibleTrigger className="flex w-full items-center gap-[40px_100px] justify-between flex-wrap max-md:max-w-full hover:opacity-80 transition-opacity">
                    <h3 className="text-[#202020] text-lg font-medium leading-none tracking-[-0.18px] self-stretch my-auto">
                      Личная информация
                    </h3>
                    <div className="self-stretch flex items-center text-xs text-[#FF8934] font-normal whitespace-nowrap leading-none my-auto">
                      <span className="text-[#FF8934] self-stretch w-[68px] my-auto">
                        {expandedSections.personal ? 'Свернуть' : 'Развернуть'}
                      </span>
                      <ChevronDown className={`w-6 h-6 text-[#FF8934] transition-transform ${expandedSections.personal ? 'rotate-180' : ''}`} />
                    </div>
                  </CollapsibleTrigger>
                </div>
                
                <CollapsibleContent className="w-full">
                  <div className="shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)] flex w-full gap-6 flex-wrap bg-white p-6 mx-3 rounded-[20px] max-md:max-w-full max-md:px-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                      <div>
                        <h4 className="text-[#202020] text-sm font-medium mb-3">Контактная информация</h4>
                        <div className="space-y-2 text-xs">
                          <p className="text-[#718096]">Email: {userData?.email || 'Не указан'}</p>
                          <p className="text-[#718096]">Телефон: {userData?.user_profiles?.phone || 'Не указан'}</p>
                          <p className="text-[#718096]">Дата рождения: {userData?.user_profiles?.birth_date ? new Date(userData.user_profiles.birth_date).toLocaleDateString() : 'Не указана'}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[#202020] text-sm font-medium mb-3">Рабочая информация</h4>
                        <div className="space-y-2 text-xs">
                          <p className="text-[#718096]">Табельный номер: {userData?.employee_number || 'Не указан'}</p>
                          <p className="text-[#718096]">Дата принятия: {userData?.start_date ? new Date(userData.start_date).toLocaleDateString() : 'Не указана'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              {/* Skills and Qualities Section */}
              <Collapsible open={expandedSections.skills} onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, skills: open }))}>
                <div className="w-full mt-2.5 pb-3 px-3 max-md:max-w-full">
                  <CollapsibleTrigger className="flex w-full items-center gap-[40px_100px] justify-between flex-wrap max-md:max-w-full hover:opacity-80 transition-opacity">
                    <h3 className="text-[#202020] text-lg font-medium leading-none tracking-[-0.18px] self-stretch my-auto">
                      Мои Soft Skills и Hard Skills
                    </h3>
                    <div className="self-stretch flex items-center text-xs text-[#FF8934] font-normal whitespace-nowrap leading-none my-auto">
                      <span className="text-[#FF8934] self-stretch w-[68px] my-auto">
                        {expandedSections.skills ? 'Свернуть' : 'Развернуть'}
                      </span>
                      <ChevronDown className={`w-6 h-6 text-[#FF8934] transition-transform ${expandedSections.skills ? 'rotate-180' : ''}`} />
                    </div>
                  </CollapsibleTrigger>
                </div>
                
                <CollapsibleContent className="w-full">
                  <div className="space-y-6 mx-3">
                    {/* Виджеты агрегированных результатов */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Виджет результатов оценки 360 */}
                      <div className="bg-white p-6 rounded-[20px] shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)]">
                        <h4 className="text-[#202020] text-base font-semibold mb-4">Результаты оценки 360</h4>
                        {survey360Loading ? (
                          <div className="flex items-center justify-center py-4">
                            <p className="text-[#718096] text-xs">Загрузка...</p>
                          </div>
                        ) : survey360AggregatedResults ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <div className="text-blue-600 text-lg font-bold">
                                  {survey360AggregatedResults.overall_summary.average_self_score.toFixed(1)}
                                </div>
                                <div className="text-[#718096] text-xs">Самооценка</div>
                              </div>
                              <div className="p-3 bg-green-50 rounded-lg">
                                <div className="text-green-600 text-lg font-bold">
                                  {survey360AggregatedResults.overall_summary.average_supervisor_score.toFixed(1)}
                                </div>
                                <div className="text-[#718096] text-xs">Руководитель</div>
                              </div>
                              <div className="p-3 bg-purple-50 rounded-lg">
                                <div className="text-purple-600 text-lg font-bold">
                                  {survey360AggregatedResults.overall_summary.average_colleague_score.toFixed(1)}
                                </div>
                                <div className="text-[#718096] text-xs">Коллеги</div>
                              </div>
                            </div>
                            <div className="p-3 bg-orange-50 rounded-lg text-center">
                              <div className="text-[#FF8934] text-xl font-bold">
                                {survey360AggregatedResults.overall_summary.overall_average.toFixed(1)}
                              </div>
                              <div className="text-[#718096] text-xs">Общий балл</div>
                            </div>
                            <div className="text-[#718096] text-xs text-center">
                              Soft Skills оценено: {survey360AggregatedResults.overall_summary.total_qualities}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-[#718096] text-xs">Нет результатов оценки 360</p>
                          </div>
                        )}
                      </div>

                      {/* Виджет результатов оценки навыков */}
                      <div className="bg-white p-6 rounded-[20px] shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)]">
                        <h4 className="text-[#202020] text-base font-semibold mb-4">Результаты оценки Hard Skills</h4>
                        {skillAssessmentLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <p className="text-[#718096] text-xs">Загрузка...</p>
                          </div>
                        ) : skillAggregatedResults ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <div className="text-blue-600 text-lg font-bold">
                                  {skillAggregatedResults.overall_summary.average_self_score.toFixed(1)}
                                </div>
                                <div className="text-[#718096] text-xs">Самооценка</div>
                              </div>
                              <div className="p-3 bg-green-50 rounded-lg">
                                <div className="text-green-600 text-lg font-bold">
                                  {skillAggregatedResults.overall_summary.average_supervisor_score.toFixed(1)}
                                </div>
                                <div className="text-[#718096] text-xs">Руководитель</div>
                              </div>
                            </div>
                            <div className="p-3 bg-orange-50 rounded-lg text-center">
                              <div className="text-[#FF8934] text-xl font-bold">
                                {skillAggregatedResults.overall_summary.overall_average.toFixed(1)}
                              </div>
                              <div className="text-[#718096] text-xs">Общий балл</div>
                            </div>
                            <div className="text-[#718096] text-xs text-center">
                              Hard Skills оценено: {skillAggregatedResults.overall_summary.total_skills}
                            </div>
                            {skillAggregatedResults.overall_summary.priority_skills.length > 0 && (
                              <div className="mt-3">
                                <div className="text-[#202020] text-xs font-medium mb-2">Приоритетные для развития:</div>
                                <div className="space-y-1">
                                  {skillAggregatedResults.overall_summary.priority_skills.slice(0, 3).map((skill) => (
                                    <div key={skill.skill_id} className="flex justify-between items-center text-xs">
                                      <span className="text-[#718096]">{skill.skill_name}</span>
                                      <span className="text-red-500 font-medium">-{skill.gap_analysis.toFixed(1)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-[#718096] text-xs">Нет результатов оценки Hard Skills</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Детальная информация о Hard Skills и Soft Skills */}
                    <div className="shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)] flex w-full gap-6 flex-wrap bg-white p-6 rounded-[20px] max-md:max-w-full max-md:px-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                        {/* Навыки */}
                        <div>
                          <h4 className="text-[#202020] text-base font-semibold mb-4">Навыки</h4>
                          {assessmentResultsLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <p className="text-[#718096] text-xs">Загрузка...</p>
                            </div>
                          ) : skillResults.length > 0 ? (
                            <div className="space-y-3">
                              {skillResults.slice(0, 5).map((skill) => (
                                <div key={skill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex-1">
                                    <h5 className="text-[#202020] text-sm font-medium">{skill.skill_name}</h5>
                                    <p className="text-[#718096] text-xs mt-1">
                                      Оценка от {new Date(skill.assessment_date).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <div className="text-[#FF8934] text-lg font-bold">{skill.skill_average?.toFixed(1)}</div>
                                    <div className="text-[#718096] text-xs">из 5</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : skills.length > 0 ? (
                            <div className="space-y-3">
                              {skills.slice(0, 5).map((skill) => (
                                 <div key={skill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex-1">
                                    <h5 className="text-[#202020] text-sm font-medium">{skill.hard_skills.name}</h5>
                                    {skill.hard_skills.description && (
                                      <p className="text-[#718096] text-xs mt-1">{skill.hard_skills.description}</p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <div className="text-[#FF8934] text-lg font-bold">{skill.current_level}</div>
                                    <div className="text-[#718096] text-xs">из 5</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-4">
                              <p className="text-[#718096] text-sm">Нет данных о Hard Skills</p>
                            </div>
                          )}
                        </div>

                        {/* Качества */}
                        <div>
                          <h4 className="text-[#202020] text-base font-semibold mb-4">Качества</h4>
                          {assessmentResultsLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <p className="text-[#718096] text-xs">Загрузка...</p>
                            </div>
                          ) : qualityResults.length > 0 ? (
                            <div className="space-y-3">
                              {qualityResults.slice(0, 5).map((quality) => (
                                <div key={quality.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex-1">
                                    <h5 className="text-[#202020] text-sm font-medium">{quality.quality_name}</h5>
                                    <p className="text-[#718096] text-xs mt-1">
                                      Оценка 360° от {new Date(quality.assessment_date).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <div className="text-[#FF8934] text-lg font-bold">{quality.quality_average?.toFixed(1)}</div>
                                    <div className="text-[#718096] text-xs">из 5</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : qualities.length > 0 ? (
                            <div className="space-y-3">
                              {qualities.slice(0, 5).map((quality) => (
                                 <div key={quality.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex-1">
                                    <h5 className="text-[#202020] text-sm font-medium">{quality.soft_skills.name}</h5>
                                    {quality.soft_skills.description && (
                                      <p className="text-[#718096] text-xs mt-1">{quality.soft_skills.description}</p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <div className="text-[#FF8934] text-lg font-bold">{quality.current_level}</div>
                                    <div className="text-[#718096] text-xs">из 5</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-4">
                              <p className="text-[#718096] text-sm">Нет данных о Soft Skills</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              {/* Achievements Section */}
              <Collapsible open={expandedSections.achievements} onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, achievements: open }))}>
                <div className="w-full mt-2.5 pb-3 px-3 max-md:max-w-full">
                  <CollapsibleTrigger className="flex w-full items-center gap-[40px_100px] whitespace-nowrap justify-between flex-wrap max-md:max-w-full hover:opacity-80 transition-opacity">
                    <h3 className="text-[#202020] text-lg font-medium leading-none tracking-[-0.18px] self-stretch my-auto">
                      Ачивки
                    </h3>
                    <div className="self-stretch flex items-center text-xs text-[#FF8934] font-normal text-right leading-none my-auto">
                      <span className="text-[#FF8934] self-stretch w-[68px] my-auto">
                        {expandedSections.achievements ? 'Свернуть' : 'Развернуть'}
                      </span>
                      <ChevronDown className={`w-6 h-6 text-[#FF8934] transition-transform ${expandedSections.achievements ? 'rotate-180' : ''}`} />
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="w-full">
                    <div className="flex items-center justify-center py-8 w-full">
                      <p className="text-[#718096] text-sm">Нет наград</p>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
              
              {/* Career Section */}
              <Collapsible open={expandedSections.career} onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, career: open }))}>
                <div className="w-full mt-2.5 pb-3 px-3 max-md:max-w-full">
                  <CollapsibleTrigger className="flex w-full items-center gap-[40px_100px] justify-between flex-wrap max-md:max-w-full hover:opacity-80 transition-opacity">
                    <h3 className="text-[#202020] text-lg font-medium leading-none tracking-[-0.18px] self-stretch my-auto">
                      Моя карьера
                    </h3>
                    <div className="self-stretch flex items-center text-xs text-[#FF8934] font-normal whitespace-nowrap leading-none my-auto">
                      <span className="text-[#FF8934] self-stretch w-[68px] my-auto">
                        {expandedSections.career ? 'Свернуть' : 'Развернуть'}
                      </span>
                      <ChevronDown className={`w-6 h-6 text-[#FF8934] transition-transform ${expandedSections.career ? 'rotate-180' : ''}`} />
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="w-full">
                    <div className="space-y-6 mx-3">
                      {/* B1. Агрегация результатов - Профиль компетенций */}
                      <CompetencyProfileWidget 
                        profile={competencyProfile} 
                        loading={competencyLoading} 
                      />

                      {/* Мой карьерный план */}
                      <CareerProgressWidget />

                      {/* B2. Расчёт разрыва (gap) - Задачи на развитие */}
                      <DevelopmentTasksWidget 
                        profile={competencyProfile} 
                        loading={competencyLoading} 
                      />

                      {/* C1, C2, C3. Рекомендации карьерного трека */}
                      <div className="bg-white p-6 rounded-[20px] shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)]">
                        <h4 className="text-[#202020] text-base font-semibold mb-4">Рекомендуемые карьерные треки</h4>
                        <CareerTracksWidget 
                          tracks={careerTracks} 
                          loading={tracksLoading} 
                          onSelectTrack={selectTrack} 
                        />
                      </div>

                      {/* Существующие карточки для опросов */}
                      <div className="space-y-4">
                        <div className="flex w-full gap-6 overflow-hidden p-3 rounded-[20px] bg-gradient-to-br from-purple-600 to-purple-800 max-md:max-w-full">
                          <div className="flex min-w-60 w-full flex-col items-stretch justify-center flex-1 shrink basis-[0%] pr-3 py-3">
                            <div className="flex w-full flex-col items-stretch justify-center max-md:max-w-full">
                              <h4 className="text-white text-ellipsis text-xl font-semibold leading-none tracking-[-0.4px] max-md:max-w-full">
                                Пройдите Оценку 360
                              </h4>
                              <p className="text-[#f8f8f8] text-xs font-normal leading-none opacity-80 mt-2.5 max-md:max-w-full">
                                Исходя из последней оценки 360 и текущей цели вам необходимо сосредоточиться на развитии качества "Предприимчивость"
                              </p>
                            </div>
                            <button 
                              onClick={() => navigate('/survey-360')}
                              disabled={!canStart360Survey()}
                              className={`justify-center items-center shadow-[2px_4px_16px_0_rgba(248,248,248,0.06)_inset] backdrop-blur-[50px] flex gap-2.5 overflow-hidden text-sm font-semibold leading-none mt-[22px] px-6 py-3 rounded-[32px] border-[1.5px] border-solid border-[#976FD8] transition-colors max-md:px-5 ${
                                canStart360Survey() 
                                  ? 'text-white hover:bg-[rgba(255,255,255,0.1)] cursor-pointer' 
                                  : 'text-white/50 cursor-not-allowed opacity-50'
                              }`}
                            >
                              <span className="text-white self-stretch my-auto">
                                Начать оценку 360
                              </span>
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex w-full gap-6 overflow-hidden p-3 rounded-[20px] bg-gradient-to-br from-teal-500 to-teal-700 max-md:max-w-full">
                          <div className="flex min-w-60 w-full flex-col items-stretch justify-center flex-1 shrink basis-[0%] pr-3 py-3">
                            <div className="flex w-full flex-col items-stretch justify-center max-md:max-w-full">
                              <h4 className="text-white text-ellipsis text-xl font-semibold leading-none tracking-[-0.4px] max-md:max-w-full">
                                Пройдите Оценку профессиональных навыков
                              </h4>
                              <p className="text-[#f8f8f8] text-xs font-normal leading-none opacity-80 mt-2.5 max-md:max-w-full">
                                Исходя из последней компетенций и текущей цели вам необходимо сосредоточиться на развитии навыка "Мерчендайзинг"
                              </p>
                            </div>
                            <button 
                              onClick={() => navigate('/skill-survey')}
                              disabled={!canStartSkillSurvey()}
                              className={`justify-center items-center shadow-[2px_4px_16px_0_rgba(248,248,248,0.06)_inset] backdrop-blur-[50px] flex gap-2.5 overflow-hidden text-sm font-semibold leading-none mt-[22px] px-6 py-3 rounded-[32px] border-[1.5px] border-solid border-[#26ACB1] transition-colors max-md:px-5 ${
                                canStartSkillSurvey() 
                                  ? 'text-white hover:bg-[rgba(255,255,255,0.1)] cursor-pointer' 
                                  : 'text-white/50 cursor-not-allowed opacity-50'
                              }`}
                            >
                              <span className="text-white self-stretch my-auto">
                                Начать оценку навыков
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Информационный блок */}
                      <div className="shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)] flex w-full gap-6 flex-wrap bg-white p-6 rounded-[20px] max-md:max-w-full max-md:px-5">
                        <div className="w-full space-y-4">
                          <div className="text-xs text-[#202020] font-normal leading-[17px]">
                            <p className="text-[#202020] max-md:max-w-full">
                              На этой странице представлены результаты оценки ваших профессиональных навыков. 
                              Данные основаны на объективной оценке ваших знаний, опыта и результатов работы. 
                              Оценка помогает выявить сильные стороны и зоны для развития, что способствует росту 
                              эффективности и карьерному продвижению
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </section>
          </div>
          
          {/* Learning Section */}
          <Collapsible open={expandedSections.learning} onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, learning: open }))}>
            <div className="w-full mt-2.5 pb-3 px-3 max-md:max-w-full">
              <CollapsibleTrigger className="flex w-full items-center gap-[40px_100px] justify-between flex-wrap max-md:max-w-full hover:opacity-80 transition-opacity">
                <h3 className="text-[#202020] text-lg font-medium leading-none tracking-[-0.18px] self-stretch my-auto">
                  Обучение
                </h3>
                <div className="self-stretch flex items-center text-xs text-[#FF8934] font-normal whitespace-nowrap leading-none my-auto">
                  <span className="text-[#FF8934] self-stretch w-[68px] my-auto">
                    {expandedSections.learning ? 'Свернуть' : 'Развернуть'}
                  </span>
                  <ChevronDown className={`w-6 h-6 text-[#FF8934] transition-transform ${expandedSections.learning ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
            </div>
            
            <CollapsibleContent className="w-full">
              <div className="flex w-full items-stretch gap-3 flex-wrap mt-1.5 pt-2.5 mx-3 max-md:max-w-full">
                <LearningCard
                  type="Программа адаптации"
                  title="Онбординг нового сотрудника"
                  status="Завершена"
                  dates=""
                  format=""
                  mentor=""
                  progress="100%"
                  progressText="6 / 7 этапов завершено"
                  isCompleted={true}
                  completionDate="30 мая 2024"
                  currentStage="Обратная связь"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
          
          {/* Services Section */}
          <section className="w-full text-[#202020] font-medium whitespace-nowrap mt-3 max-md:max-w-full">
            <div className="flex w-full items-center gap-2.5 text-lg tracking-[-0.18px] leading-none justify-center pt-5 pb-2.5 px-3 max-md:max-w-full">
              <div className="self-stretch flex min-w-60 w-full items-center gap-2.5 justify-center flex-1 shrink basis-[0%] my-auto max-md:max-w-full">
                <h2 className="text-[#202020] self-stretch flex-1 shrink basis-[0%] my-auto max-md:max-w-full">
                  Сервисы
                </h2>
              </div>
            </div>
            
            <div className="w-full text-sm leading-none max-md:max-w-full">
              <button className="items-center border bg-[rgba(52,52,52,0.05)] flex w-full gap-5 overflow-hidden pl-3 pr-4 py-3 rounded-[10px] border-solid border-[rgba(255,255,255,0.40)] hover:bg-[rgba(52,52,52,0.1)] transition-colors max-md:max-w-full">
                <div className="self-stretch flex min-w-60 w-full items-center gap-[40px_100px] justify-between flex-wrap flex-1 shrink basis-[0%] my-auto max-md:max-w-full">
                  <div className="self-stretch flex items-center gap-4 my-auto">
                    <img
                      src="https://api.builder.io/api/v1/image/assets/TEMP/c205573adf275560c45d84b65a5bd252e323c208?placeholderIfAbsent=true"
                      className="aspect-[1] object-contain w-11 self-stretch shrink-0 my-auto"
                      alt="Support"
                    />
                    <span className="text-[#202020] opacity-80 self-stretch my-auto">
                      Поддержка
                    </span>
                  </div>
                  <img
                    src="https://api.builder.io/api/v1/image/assets/TEMP/f38c1d13dc86e53d5747f68a9fe5ee0a72e41d89?placeholderIfAbsent=true"
                    className="aspect-[1] object-contain w-6 self-stretch shrink-0 my-auto rounded-3xl"
                    alt="Arrow"
                  />
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  </>
  );
};

export default MainContent;
