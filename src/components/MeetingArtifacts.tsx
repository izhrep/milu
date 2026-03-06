import React, { useRef, useState } from 'react';
import { Paperclip, Download, Trash2, Upload, FileText, Image, FileSpreadsheet, Presentation, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMeetingArtifacts, MeetingArtifact } from '@/hooks/useMeetingArtifacts';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const ACCEPT_STRING = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.svg';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function getFileIcon(mimeType: string, fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) return <Image className="h-5 w-5 text-muted-foreground" />;
  if (['xls', 'xlsx'].includes(ext)) return <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />;
  if (['ppt', 'pptx'].includes(ext)) return <Presentation className="h-5 w-5 text-muted-foreground" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

interface MeetingArtifactsProps {
  meetingId: string;
  meeting: {
    status: string;
    stage_id: string | null;
  };
  isManager: boolean;
}

export const MeetingArtifacts: React.FC<MeetingArtifactsProps> = ({ meetingId, meeting, isManager }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const {
    artifacts,
    isLoading,
    canUpload,
    canDelete,
    uploadArtifact,
    isUploading,
    deleteArtifact,
    isDeleting,
    getSignedUrl,
  } = useMeetingArtifacts({
    meetingId,
    meetingStatus: meeting.status,
    meetingStageId: meeting.stage_id,
    isManager,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadArtifact(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (artifact: MeetingArtifact) => {
    setDownloadingId(artifact.id);
    try {
      const url = await getSignedUrl(artifact.storage_path);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = artifact.file_name;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Материалы встречи
            <span className="text-muted-foreground font-normal">({artifacts.length}/10)</span>
          </CardTitle>
          {canUpload && artifacts.length < 10 && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_STRING}
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                {isUploading ? 'Загрузка...' : 'Загрузить'}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : artifacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">Нет прикреплённых файлов</p>
        ) : (
          <div className="space-y-2">
            {artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className="flex items-center gap-3 p-2 rounded-md border bg-background"
              >
                {getFileIcon(artifact.mime_type, artifact.file_name)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{artifact.file_name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(artifact.file_size)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(artifact)}
                    disabled={downloadingId === artifact.id}
                    title="Скачать"
                  >
                    {downloadingId === artifact.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                  {canDelete(artifact) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" disabled={isDeleting} title="Удалить">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить файл?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Файл «{artifact.file_name}» будет удалён. Это действие нельзя отменить.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteArtifact(artifact)}>
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
