import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface GradeRow {
  'Название грейда': string;
  'Уровень грейда': number;
  'Должность': string;
  'Тип навыка': string;
  'Skill': string;
  'Уровень навыка': number;
}

export function ImportGradesData() {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<GradeRow[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);
    setSuccess(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) {
          setErrors(['Файл не содержит данных']);
          return;
        }

        const rawRows = XLSX.utils.sheet_to_json(firstSheet);

        // Normalize column names by trimming spaces
        const rows = rawRows.map((row: any) => {
          const normalized: any = {};
          Object.keys(row).forEach(key => {
            const trimmedKey = key.trim();
            normalized[trimmedKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
          });
          return normalized as GradeRow;
        });

        const validationErrors: string[] = [];

        if (rows.length === 0) {
          validationErrors.push('Файл не содержит данных');
        }

        // Validate levels
        rows.forEach((row, index) => {
          const skillLevel = row['Уровень навыка'];
          const type = row['Тип навыка']?.toLowerCase();
          
          if (type === 'hard' && (skillLevel < 0 || skillLevel > 4)) {
            validationErrors.push(`Строка ${index + 2}: уровень ${skillLevel} недопустим для Hard Skills (допустимо 0-4)`);
          }
          
          if (type === 'soft' && (skillLevel < 0 || skillLevel > 5)) {
            validationErrors.push(`Строка ${index + 2}: уровень ${skillLevel} недопустим для Soft Skills (допустимо 0-5)`);
          }

          if (!row['Название грейда']) {
            validationErrors.push(`Строка ${index + 2}: отсутствует название грейда`);
          }

          if (row['Уровень грейда'] === undefined) {
            validationErrors.push(`Строка ${index + 2}: отсутствует уровень грейда`);
          }

          if (!row['Должность']) {
            validationErrors.push(`Строка ${index + 2}: отсутствует должность`);
          }

          if (!row['Skill']) {
            validationErrors.push(`Строка ${index + 2}: отсутствует навык`);
          }
        });

        if (validationErrors.length > 0) {
          setErrors(validationErrors);
          return;
        }

        setParsedData(rows);
        toast.success('Файл успешно загружен и проверен');
      } catch (error) {
        console.error('Error parsing file:', error);
        setErrors(['Ошибка при чтении файла. Убедитесь, что это корректный Excel-файл']);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleImport = async () => {
    if (!parsedData) return;

    setIsImporting(true);
    setErrors([]);
    setSuccess(false);

    try {
      const { data, error } = await supabase.functions.invoke('import-grades-data', {
        body: { grades: parsedData },
      });

      if (error) throw error;

      if (data.error) {
        setErrors([data.error]);
        toast.error('Ошибка импорта');
      } else {
        setSuccess(true);
        toast.success(`Импорт завершен: ${data.created?.grades || 0} грейдов, ${data.created?.grade_skills || 0} навыков, ${data.created?.grade_qualities || 0} качеств`);
        
        setTimeout(() => {
          setFile(null);
          setParsedData(null);
          setIsOpen(false);
          setSuccess(false);
        }, 2000);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      setErrors([error.message || 'Неизвестная ошибка при импорте']);
      toast.error('Ошибка импорта');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Импорт грейдов</h2>
          <p className="text-text-secondary">
            Загрузите Excel-файл с данными о грейдах, должностях и требованиях к навыкам
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2">
              <Upload className="h-5 w-5" />
              Импортировать грейды
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Импорт грейдов</DialogTitle>
              <DialogDescription>
                Загрузите Excel-файл с данными о грейдах
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* File Upload */}
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="grades-file-upload"
                />
                <label htmlFor="grades-file-upload" className="cursor-pointer">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-text-secondary mb-2">
                    {file ? file.name : 'Нажмите для выбора файла или перетащите его сюда'}
                  </p>
                  <p className="text-xs text-text-tertiary">Excel (.xlsx, .xls)</p>
                </label>
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      {errors.map((error, index) => (
                        <div key={index}>{error}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Success */}
              {success && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Грейды успешно импортированы!
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview */}
              {parsedData && (
                <div className="space-y-2">
                  <h3 className="font-medium">Предпросмотр данных ({parsedData.length} записей)</h3>
                  <div className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Название грейда</TableHead>
                          <TableHead>Уровень</TableHead>
                          <TableHead>Должность</TableHead>
                          <TableHead>Тип</TableHead>
                          <TableHead>Навык</TableHead>
                          <TableHead>Требуемый уровень</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.slice(0, 20).map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>{row['Название грейда']}</TableCell>
                            <TableCell>{row['Уровень грейда']}</TableCell>
                            <TableCell>{row['Должность']}</TableCell>
                            <TableCell>{row['Тип навыка']}</TableCell>
                            <TableCell className="max-w-xs truncate">{row['Skill']}</TableCell>
                            <TableCell>{row['Уровень навыка']}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {parsedData.length > 20 && (
                      <p className="text-xs text-text-tertiary mt-2 text-center">
                        Показаны первые 20 из {parsedData.length} записей
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Import Button */}
              {parsedData && !success && (
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setParsedData(null);
                      setErrors([]);
                    }}
                    disabled={isImporting}
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={isImporting || errors.length > 0}
                    className="gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Импортируется...
                      </>
                    ) : (
                      'Импортировать'
                    )}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
          <p className="font-medium">Формат файла:</p>
          <ul className="list-disc list-inside space-y-1 text-text-secondary">
            <li>Столбцы: Название грейда, Уровень грейда, Должность, Тип навыка, Skill, Уровень навыка</li>
            <li>Тип навыка должен быть "Hard" или "Soft"</li>
            <li>Уровни навыков: Hard Skills (0-4), Soft Skills (0-5)</li>
            <li>Грейды создаются или обновляются автоматически</li>
            <li>Должности создаются если не существуют</li>
            <li>Импорт выполняется атомарно - при ошибке все изменения откатываются</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
