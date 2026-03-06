import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText, Download, RefreshCw } from 'lucide-react';
import { useMeeting360Attachment } from '@/hooks/useMeeting360Attachment';

interface Meeting360AttachButtonProps {
  meetingId: string;
  employeeId: string;
  meetingStatus: string;
  isManager: boolean;
  isHistorical: boolean;
}

export const Meeting360AttachButton: React.FC<Meeting360AttachButtonProps> = ({
  meetingId,
  employeeId,
  meetingStatus,
  isManager,
  isHistorical,
}) => {
  const { existingArtifact, isLoading, canAttach, attach, isAttaching, getSignedUrl } = useMeeting360Attachment({
    meetingId,
    employeeId,
    meetingStatus,
    isHistorical,
  });

  const [isDownloading, setIsDownloading] = useState(false);

  const handleView = async () => {
    if (!existingArtifact?.storage_path) return;
    setIsDownloading(true);

    // Open a blank tab synchronously (user gesture) to avoid Chrome popup block
    const newTab = window.open('', '_blank');

    try {
      const url = await getSignedUrl(existingArtifact.storage_path);
      if (url && newTab) {
        newTab.location.href = url;
      } else if (newTab) {
        newTab.close();
      }
    } catch {
      newTab?.close();
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) return null;

  // Nothing to show if no artifact and can't attach
  if (!existingArtifact && !canAttach) return null;

  return (
    <Card className="border-dashed">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            {existingArtifact ? (
              <span className="text-sm text-muted-foreground truncate">Данные ОС 360 прикреплены</span>
            ) : (
              <span className="text-sm text-muted-foreground">Снимок результатов ОС 360</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {existingArtifact && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleView}
                disabled={isDownloading}
              >
                {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span className="ml-1">Посмотреть</span>
              </Button>
            )}

            {canAttach && (
              <Button
                type="button"
                variant={existingArtifact ? 'ghost' : 'default'}
                size="sm"
                onClick={() => attach()}
                disabled={isAttaching}
              >
                {isAttaching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : existingArtifact ? (
                  <RefreshCw className="h-3.5 w-3.5" />
                ) : null}
                <span className="ml-1">
                  {existingArtifact ? 'Обновить' : 'Добавить данные последней ОС 360'}
                </span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
