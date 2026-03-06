import React from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Rss } from 'lucide-react';

const FeedPage = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />
      
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Лента новостей</h1>
        <p className="text-text-secondary mt-1">Актуальные новости и события компании</p>
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-purple/10 rounded-lg">
              <Rss className="h-6 w-6 text-brand-purple" />
            </div>
            <CardTitle>Новости</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-text-secondary">Раздел в разработке. Здесь будет лента новостей и обновлений компании.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedPage;
