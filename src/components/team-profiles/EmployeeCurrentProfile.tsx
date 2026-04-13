import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Calendar, User, DollarSign, TrendingUp, FileText } from 'lucide-react';

interface Props {
  employee: { id: string; name: string; position: string };
}

const Field: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div className="flex items-start gap-3 py-3 border-b border-border last:border-b-0">
    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  </div>
);

const EmployeeCurrentProfile: React.FC<Props> = ({ employee }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
      {/* Main info */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Основная информация
          </h3>
          <Field icon={<User className="w-4 h-4 text-primary" />} label="ФИО">
            {employee.name}
          </Field>
          <Field icon={<Briefcase className="w-4 h-4 text-primary" />} label="Должность">
            {employee.position}
          </Field>
          <Field icon={<Briefcase className="w-4 h-4 text-primary" />} label="Текущий проект / клиент">
            <Badge variant="secondary" className="text-xs">Останкино казна</Badge>
          </Field>
          <Field icon={<User className="w-4 h-4 text-primary" />} label="Текущая роль">
            Старший аналитик
          </Field>
          <Field icon={<Calendar className="w-4 h-4 text-primary" />} label="Дата начала работы">
            15 марта 2024
          </Field>
          <Field icon={<User className="w-4 h-4 text-primary" />} label="Текущий руководитель">
            Иванова Мария
          </Field>
          <Field icon={<DollarSign className="w-4 h-4 text-primary" />} label="Зарплата">
            180 000 ₽
          </Field>
        </div>
      </div>

      {/* Side summary */}
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Последние изменения
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              <span>Смена проекта — 2 нед. назад</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
              <span>Повышение зарплаты — 1 мес. назад</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
              <span>Назначение на роль — 3 мес. назад</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Навыки (summary)
          </h3>
          <div className="space-y-2">
            {['SQL', 'Python', 'Аналитика данных'].map(skill => (
              <div key={skill} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{skill}</span>
                <Skeleton className="h-2 w-16 rounded-full" />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-3 italic">
            Подробнее во вкладке «Навыки»
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmployeeCurrentProfile;
