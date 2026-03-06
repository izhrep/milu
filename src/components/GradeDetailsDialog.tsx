import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface GradeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gradeId: string;
  gradeName: string;
}

export const GradeDetailsDialog = ({ open, onOpenChange, gradeId, gradeName }: GradeDetailsDialogProps) => {
  const [skills, setSkills] = useState<any[]>([]);
  const [qualities, setQualities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && gradeId) {
      fetchGradeDetails();
    }
  }, [open, gradeId]);

  const fetchGradeDetails = async () => {
    try {
      setLoading(true);

      // Fetch skills for grade
      const { data: gradeSkills, error: skillsError } = await supabase
        .from('grade_skills')
        .select(`
          target_level,
          hard_skills (
            id,
            name,
            description
          )
        `)
        .eq('grade_id', gradeId);

      if (skillsError) {
        console.error('Error fetching grade skills:', skillsError);
      }

      // Fetch qualities for grade
      const { data: gradeQualities, error: qualitiesError } = await supabase
        .from('grade_qualities')
        .select(`
          target_level,
          soft_skills (
            id,
            name,
            description
          )
        `)
        .eq('grade_id', gradeId);

      if (qualitiesError) {
        console.error('Error fetching grade qualities:', qualitiesError);
      }

      setSkills(gradeSkills || []);
      setQualities(gradeQualities || []);
    } catch (error) {
      console.error('Error fetching grade details:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Требования грейда: {gradeName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Tabs defaultValue="skills" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="skills">Hard Skills ({skills.length})</TabsTrigger>
              <TabsTrigger value="qualities">Soft Skills ({qualities.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="skills" className="space-y-4 mt-4">
              {skills.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">Hard Skills для грейда не настроены</p>
                  </CardContent>
                </Card>
              ) : (
                skills.map((item: any) => (
                  <Card key={item.hard_skills?.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{item.hard_skills?.name}</CardTitle>
                          {item.hard_skills?.description && (
                            <CardDescription className="mt-1">{item.hard_skills.description}</CardDescription>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          Уровень: {item.target_level}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="qualities" className="space-y-4 mt-4">
              {qualities.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">Soft Skills для грейда не настроены</p>
                  </CardContent>
                </Card>
              ) : (
                qualities.map((item: any) => (
                  <Card key={item.soft_skills?.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{item.soft_skills?.name}</CardTitle>
                          {item.soft_skills?.description && (
                            <CardDescription className="mt-1">{item.soft_skills.description}</CardDescription>
                          )}
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          Уровень: {item.target_level}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
