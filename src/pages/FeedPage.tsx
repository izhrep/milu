import React from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Rss } from "@/components/icons";

const FeedPage = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />
      
      <div>
        <h1 className="text-heading-2 font-bold text-foreground">Лента новостей</h1>
        <p className="text-muted-foreground mt-1">Актуальные новости и события компании</p>
      </div>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Rss className="h-6 w-6 text-accent" />
            </div>
            <CardTitle>Новости</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Раздел в разработке. Здесь будет лента новостей и обновлений компании.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedPage;
