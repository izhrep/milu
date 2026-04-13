import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Briefcase, MapPin } from 'lucide-react';
import EmployeeCurrentProfile from './EmployeeCurrentProfile';
import EmployeeChangeHistory from './EmployeeChangeHistory';
import EmployeeSkills from './EmployeeSkills';

interface EmployeeData {
  id: string;
  name: string;
  position: string;
}

interface Props {
  employee: EmployeeData;
  onBack: () => void;
  fromMap?: boolean;
}

const EmployeeCard: React.FC<Props> = ({ employee, onBack, fromMap }) => {
  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <button onClick={onBack} className="hover:text-foreground transition-colors">Моя команда</button>
        <span>/</span>
        {fromMap && (
          <>
            <button onClick={onBack} className="hover:text-foreground transition-colors">Карта команды</button>
            <span>/</span>
          </>
        )}
        <span className="text-foreground font-medium">{employee.name}</span>
      </nav>

      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-1 flex-shrink-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{employee.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-muted-foreground">{employee.position}</span>
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Briefcase className="w-2.5 h-2.5" />
                Останкино казна
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Текущий профиль</TabsTrigger>
          <TabsTrigger value="history">История изменений</TabsTrigger>
          <TabsTrigger value="skills">Навыки</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <EmployeeCurrentProfile employee={employee} />
        </TabsContent>
        <TabsContent value="history">
          <EmployeeChangeHistory />
        </TabsContent>
        <TabsContent value="skills">
          <EmployeeSkills />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmployeeCard;
