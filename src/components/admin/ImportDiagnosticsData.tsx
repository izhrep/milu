import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
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

export function ImportDiagnosticsData() {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);
    setSuccess(false);

    // Parse Excel file
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get sheets
        const questionSheet = workbook.Sheets['question'];
        const answerSheet = workbook.Sheets['answer'];

        if (!questionSheet || !answerSheet) {
          setErrors(['Файл должен содержать две вкладки: "question" и "answer"']);
          return;
        }

        // Parse sheets to JSON
        const questions = XLSX.utils.sheet_to_json<QuestionRow>(questionSheet);
        const answers = XLSX.utils.sheet_to_json<AnswerRow>(answerSheet);

        // Validate data
        const validationErrors: string[] = [];

        if (questions.length === 0) {
          validationErrors.push('Вкладка "question" не содержит данных');
        }

        if (answers.length === 0) {
          validationErrors.push('Вкладка "answer" не содержит данных');
        }

        // Validate answer levels
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
      } else {
        setSuccess(true);
        toast.success('Данные успешно импортированы');
        
        // Reset form
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
          <h2 className="text-2xl font-bold text-text-primary mb-2">Импорт вопросов и ответов</h2>
          <p className="text-text-secondary">
            Загрузите Excel-файл с вкладками "question" и "answer" для массового импорта данных
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
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

              {/* Success */}
              {success && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Данные успешно импортированы!
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview */}
              {parsedData && (
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
            <li>Файл должен содержать две вкладки: "question" и "answer"</li>
            <li>Вкладка "question": Тип, Категория, Подкатегория, Skill, Описание навыка, Текст вопроса, Порядок вопроса, Название группы ответов, Ограничение видимости вопроса</li>
            <li>Вкладка "answer": Тип, Название группы ответов, Описание группы ответов, Название ответа, Описание ответа, Уровень ответа, Порядок ответа</li>
            <li>Тип должен быть "Hard" или "Soft"</li>
            <li>Уровни: Hard Skills (0-4), Soft Skills (0-5)</li>
            <li>Импорт выполняется атомарно - при ошибке все изменения откатываются</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
