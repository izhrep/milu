import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  illustration?: React.ReactNode;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description, illustration, action }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center" style={{ maxWidth: 400, margin: '0 auto' }}>
      {illustration && (
        <div className="mb-4 h-40 w-40 flex items-center justify-center">
          {illustration}
        </div>
      )}
      <h3 className="text-body-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-body-md text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;