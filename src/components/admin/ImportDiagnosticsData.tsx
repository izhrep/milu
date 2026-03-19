import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface QuestionRow {
  Тип: string;
  Категория: string;
  Подкатегория: string;
  Skill: string;
  'Описание навыка': string;
  'Текст вопроса': string;
  'Порядок вопроса': number;
  'Название группы ответов': string;
  'Ограничение видимости вопроса'?: string;
}

interface AnswerRow {
  Тип: string;
  'Название группы ответов': string;
  'Описание группы ответов': string;
  'Название ответа': string;
  'Описание ответа': string;
  'Уровень ответа': number;
  'Порядок ответа': number;
}

interface ParsedData {
  questions: QuestionRow[];
  answers: AnswerRow[];
}

interface EntityReport {
  created: number;
  updated: number;
  reused: number;
  errors: string[];
}

interface ImportReport {
  categories: EntityReport;
  subCategories: EntityReport;
  skills: EntityReport;
  questions: EntityReport;
  answerCategories: EntityReport;
  answerOptions: EntityReport;
  totalErrors: number;
  success: boolean;
}

function ReportSection({ label, data }: { label: string; data: EntityReport }) {
  const total = data.created + data.updated + data.reused;
  if (total === 0 && data.errors.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{label}</span>
        <span className="text-muted-foreground">
          ({total} обработано)
        </span>
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground pl-2">
        {data.created > 0 && <span className="text-primary">+{data.created} создано</span>}
        {data.updated > 0 && <span className="text-accent-foreground">⟳ {data.updated} обновлено</span>}
        {data.reused > 0 && <span className="text-muted-foreground">↻ {data.reused} без изменений</span>}
      </div>
      {data.errors.length > 0 && (
        <div className="pl-2 space-y-0.5">
          {data.errors.map((err, i) => (
            <div key={i} className="text-xs text-destructive">⚠ {err}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ImportDiagnosticsData() {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);
    setImportReport(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const questionSheet = workbook.Sheets['question'];
        const answerSheet = workbook.Sheets['answer'];

        if (!questionSheet || !answerSheet) {
          setErrors(['Файл должен содержать две вкладки: "question" и "answer"']);
          return;
        }

        const questions = XLSX.utils.sheet_to_json<QuestionRow>(questionSheet);
        const answers = XLSX.utils.sheet_to_json<AnswerRow>(answerSheet);

        const validationErrors: string[] = [];

        if (questions.length === 0) {
          validationErrors.push('Вкладка "question" не содержит данных');
        }
        if (answers.length === 0) {
          validationErrors.push('Вкладка "answer" не содержит данных');
        }

        answers.forEach((answer, index) => {
          const level = answer['Уровень ответа'];
          const type = answer['Тип']?.toLowerCase();

          if (type === 'hard' && (level < 0 || level > 4)) {
            validationErrors.push(`Строка ${index + 2} (answer): уровень ${level} недопустим для Hard Skills (допустимо 0-4)`);
          }
          if (type === 'soft' && (level < 0 || level > 5)) {
            validationErrors.push(`Строка ${index + 2} (answer): уровень ${level} недопустим для Soft Skills (допустимо 0-5)`);
          }
        });

        if (validationErrors.length > 0) {
          setErrors(validationErrors);
          return;
        }

        setParsedData({ questions, answers });
        toast.success('Файл загружен и проверен');
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
    setImportReport(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-diagnostics-data', {
        body: {
          questions: parsedData.questions,
          answers: parsedData.answers,
        },
      });

      if (error) throw error;

      if (data.error) {
        setErrors([data.error]);
        toast.error('Ошибка импорта');
      } else if (data.report) {
        const report = data.report as ImportReport;
        setImportReport(report);

        if (report.totalErrors === 0) {
          toast.success('Импорт завершён успешно');
        } else {
          toast.warning(`Импорт завершён с ${report.totalErrors} предупреждениями`);
        }
      } else {
        toast.success('Данные импортированы');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      setErrors([error.message || 'Неизвестная ошибка при импорте']);
      toast.error('Ошибка импорта');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedData(null);
    setErrors([]);
    setImportReport(null);
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Импорт вопросов и ответов</h2>
          <p className="text-text-secondary">
            Загрузите Excel-файл с вкладками "question" и "answer" для массового импорта данных.
            Повторный импорт обновит существующие записи, не создавая дублей.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) handleReset(); }}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2">
              <Upload className="h-5 w-5" />
              Импортировать вопросы и ответы
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Импорт вопросов и ответов</DialogTitle>
              <DialogDescription>
                Загрузите Excel-файл с двумя вкладками: "question" и "answer"
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
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
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

              {/* Import Report */}
              {importReport && (
                <Alert variant={importReport.totalErrors === 0 ? 'default' : 'destructive'}>
                  {importReport.totalErrors === 0 ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    <div className="space-y-3">
                      <div className="font-medium">
                        {importReport.totalErrors === 0
                          ? 'Импорт завершён успешно'
                          : `Импорт завершён с ${importReport.totalErrors} предупреждениями`}
                      </div>
                      <div className="space-y-2">
                        <ReportSection label="Категории" data={importReport.categories} />
                        <ReportSection label="Подкатегории" data={importReport.subCategories} />
                        <ReportSection label="Навыки" data={importReport.skills} />
                        <ReportSection label="Вопросы" data={importReport.questions} />
                        <ReportSection label="Группы ответов" data={importReport.answerCategories} />
                        <ReportSection label="Варианты ответов" data={importReport.answerOptions} />
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview */}
              {parsedData && !importReport && (
                <Tabs defaultValue="questions" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="questions">
                      Вопросы ({parsedData.questions.length})
                    </TabsTrigger>
                    <TabsTrigger value="answers">
                      Ответы ({parsedData.answers.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="questions" className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Тип</TableHead>
                          <TableHead>Категория</TableHead>
                          <TableHead>Skill</TableHead>
                          <TableHead>Текст вопроса</TableHead>
                          <TableHead>Группа ответов</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.questions.slice(0, 10).map((q, index) => (
                          <TableRow key={index}>
                            <TableCell>{q.Тип}</TableCell>
                            <TableCell>{q.Категория}</TableCell>
                            <TableCell>{q.Skill}</TableCell>
                            <TableCell className="max-w-xs truncate">{q['Текст вопроса']}</TableCell>
                            <TableCell>{q['Название группы ответов']}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {parsedData.questions.length > 10 && (
                      <p className="text-xs text-text-tertiary mt-2 text-center">
                        Показаны первые 10 из {parsedData.questions.length} записей
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="answers" className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Тип</TableHead>
                          <TableHead>Группа ответов</TableHead>
                          <TableHead>Название ответа</TableHead>
                          <TableHead>Уровень</TableHead>
                          <TableHead>Порядок</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedData.answers.slice(0, 10).map((a, index) => (
                          <TableRow key={index}>
                            <TableCell>{a.Тип}</TableCell>
                            <TableCell>{a['Название группы ответов']}</TableCell>
                            <TableCell>{a['Название ответа']}</TableCell>
                            <TableCell>{a['Уровень ответа']}</TableCell>
                            <TableCell>{a['Порядок ответа']}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {parsedData.answers.length > 10 && (
                      <p className="text-xs text-text-tertiary mt-2 text-center">
                        Показаны первые 10 из {parsedData.answers.length} записей
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              {/* Action Buttons */}
              {parsedData && (
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isImporting}
                  >
                    {importReport ? 'Закрыть' : 'Отмена'}
                  </Button>
                  {!importReport && (
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
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
          <p className="font-medium">Формат файла:</p>
          <ul className="list-disc list-inside space-y-1 text-text-secondary">
            <li>Файл должен содержать две вкладки: "question" и "answer"</li>
            <li>Вкладка "question": Тип, Категория, Подкатегория, Skill, Описание навыка, Текст вопроса, Порядок вопроса, Название группы ответов, Ограничение видимости вопроса</li>
            <li>Вкладка "answer": Тип, Название группы ответов, Описание группы ответов, Название ответа, Описание ответа, Уровень ответа, Порядок ответа</li>
            <li>Тип должен быть "Hard" или "Soft"</li>
            <li>Уровни: Hard Skills (0-4), Soft Skills (0-5)</li>
            <li>Повторный импорт того же файла обновит данные без создания дублей</li>
            <li>Можно дозаливать недостающие данные новым файлом</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
