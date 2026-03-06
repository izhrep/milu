import { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface ReferenceTableLayoutProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export const ReferenceTableLayout = ({ 
  title, 
  description, 
  icon, 
  children 
}: ReferenceTableLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/admin')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <Breadcrumbs />
          <div className="flex items-center gap-3 mt-2">
            {icon && <div className="text-primary">{icon}</div>}
            <div>
              <h1 className="text-3xl font-bold">{title}</h1>
              {description && (
                <p className="text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6">
        {children}
      </div>
    </div>
  );
};
