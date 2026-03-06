import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface ImportUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ExcelRow {
  'Фамилия'?: string;
  'Имя'?: string;
  'Отчество'?: string;
  'email'?: string;
  'Должность'?: string;
  'Password'?: string;
  'Passwrod'?: string; // Handle typo in template
  'Грейд'?: string;
  'Роль'?: string;
}

interface ParsedUser {
  rowNumber: number;
  last_name: string;
  first_name: string;
  middle_name: string;
  email: string;
  position_name: string;
  password: string;
  grade_name: string;
  role_name: string;
  position_id?: string;
  grade_id?: string;
  role?: string;
  errors: string[];
  status: 'pending' | 'success' | 'error';
}

interface ImportReport {
  total: number;
  success: number;
  failed: number;
  results: Array<{
    rowNumber: number;
    email: string;
    status: 'success' | 'error';
    message: string;
  }>;
}

const ROLE_MAPPING: Record<string, string> = {
  'администратор': 'admin',
  'admin': 'admin',
  'hr': 'hr_bp',
  'hr_bp': 'hr_bp',
  'hr bp': 'hr_bp',
  'руководитель': 'manager',
  'manager': 'manager',
  'менеджер': 'manager',
  'сотрудник': 'employee',
  'employee': 'employee',
};

const ImportUsersDialog: React.FC<ImportUsersDialogProps> = ({ open, onOpenChange, onSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [positions, setPositions] = useState<Array<{ id: string; name: string }>>([]);
  const [grades, setGrades] = useState<Array<{ id: string; name: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'report'>('upload');

  const fetchReferenceData = async () => {
    const [positionsRes, gradesRes] = await Promise.all([
      supabase.from('positions').select('id, name'),
      supabase.from('grades').select('id, name'),
    ]);
    
    if (positionsRes.data) setPositions(positionsRes.data);
    if (gradesRes.data) setGrades(gradesRes.data);
    
    return {
      positions: positionsRes.data || [],
      grades: gradesRes.data || [],
    };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const refData = await fetchReferenceData();
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawRows: ExcelRow[] = XLSX.utils.sheet_to_json(firstSheet);

          // Normalize column names
          const rows = rawRows.map((row: any) => {
            const normalized: any = {};
            Object.keys(row).forEach(key => {
              const trimmedKey = key.trim();
              normalized[trimmedKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
            });
            return normalized as ExcelRow;
          });

          const parsed: ParsedUser[] = rows.map((row, index) => {
            const errors: string[] = [];
            
            const lastName = row['Фамилия'] || '';
            const firstName = row['Имя'] || '';
            const middleName = row['Отчество'] || '';
            const email = row['email'] || '';
            const positionName = row['Должность'] || '';
            const password = row['Password'] || row['Passwrod'] || ''; // Handle both spellings
            const gradeName = row['Грейд'] || '';
            const roleName = row['Роль'] || '';

            // Validate required fields
            if (!lastName) errors.push('Отсутствует фамилия');
            if (!firstName) errors.push('Отсутствует имя');
            if (!email) errors.push('Отсутствует email');
            if (!password) errors.push('Отсутствует пароль');
            if (!positionName) errors.push('Отсутствует должность');
            if (!gradeName) errors.push('Отсутствует грейд');
            if (!roleName) errors.push('Отсутствует роль');

            // Validate email format
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              errors.push('Неверный формат email');
            }

            // Validate password length
            if (password && password.length < 6) {
              errors.push('Пароль должен содержать минимум 6 символов');
            }

            // Find position_id
            const position = refData.positions.find(
              p => p.name.toLowerCase() === positionName.toLowerCase()
            );
            if (positionName && !position) {
              errors.push(`Должность "${positionName}" не найдена`);
            }

            // Find grade_id
            const grade = refData.grades.find(
              g => g.name.toLowerCase() === gradeName.toLowerCase()
            );
            if (gradeName && !grade) {
              errors.push(`Грейд "${gradeName}" не найден`);
            }

            // Validate role
            const normalizedRole = ROLE_MAPPING[roleName.toLowerCase()];
            if (roleName && !normalizedRole) {
              errors.push(`Роль "${roleName}" не найдена. Допустимые: Сотрудник, Руководитель, HR, Администратор`);
            }

            return {
              rowNumber: index + 2, // Excel rows start at 1, plus header
              last_name: lastName,
              first_name: firstName,
              middle_name: middleName,
              email,
              position_name: positionName,
              password,
              grade_name: gradeName,
              role_name: roleName,
              position_id: position?.id,
              grade_id: grade?.id,
              role: normalizedRole,
              errors,
              status: errors.length > 0 ? 'error' : 'pending',
            };
          });

          setParsedUsers(parsed);
          setStep('preview');
        } catch (parseError) {
          console.error('Error parsing Excel:', parseError);
          toast.error('Ошибка чтения файла Excel');
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Ошибка обработки файла');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    const validUsers = parsedUsers.filter(u => u.status === 'pending');
    
    if (validUsers.length === 0) {
      toast.error('Нет валидных пользователей для импорта');
      return;
    }

    setImporting(true);
    setStep('importing');

    const results: ImportReport['results'] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const user of parsedUsers) {
      if (user.status === 'error') {
        results.push({
          rowNumber: user.rowNumber,
          email: user.email,
          status: 'error',
          message: user.errors.join('; '),
        });
        failedCount++;
        continue;
      }

      try {
        // Call create-user edge function with plain data
        // The edge function handles encryption internally
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: user.email,
            password: user.password,
            first_name: user.first_name,
            last_name: user.last_name,
            middle_name: user.middle_name,
            role: user.role,
            position_id: user.position_id,
            grade_id: user.grade_id,
          },
        });

        if (error) {
          throw new Error(error.message || 'Ошибка вызова функции');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Ошибка создания пользователя');
        }

        results.push({
          rowNumber: user.rowNumber,
          email: user.email,
          status: 'success',
          message: 'Создан успешно',
        });
        successCount++;
      } catch (err: any) {
        console.error(`Error creating user ${user.email}:`, err);
        results.push({
          rowNumber: user.rowNumber,
          email: user.email,
          status: 'error',
          message: err.message || 'Неизвестная ошибка',
        });
        failedCount++;
      }
    }

    setReport({
      total: parsedUsers.length,
      success: successCount,
      failed: failedCount,
      results,
    });
    setImporting(false);
    setStep('report');

    if (successCount > 0) {
      onSuccess();
    }
  };

  const handleClose = () => {
    setParsedUsers([]);
    setReport(null);
    setStep('upload');
    onOpenChange(false);
  };

  const validCount = parsedUsers.filter(u => u.status === 'pending').length;
  const errorCount = parsedUsers.filter(u => u.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Импорт пользователей из Excel
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Загрузите Excel файл с данными пользователей'}
            {step === 'preview' && 'Проверьте данные перед импортом'}
            {step === 'importing' && 'Выполняется импорт...'}
            {step === 'report' && 'Результаты импорта'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Выберите файл Excel (.xlsx, .xls) для импорта
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="max-w-xs mx-auto"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Ожидаемые столбцы:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Фамилия (обязательно)</li>
                <li>Имя (обязательно)</li>
                <li>Отчество</li>
                <li>email (обязательно)</li>
                <li>Должность (обязательно, должна существовать в справочнике)</li>
                <li>Password (обязательно, минимум 6 символов)</li>
                <li>Грейд (обязательно, должен существовать в справочнике)</li>
                <li>Роль (обязательно: Сотрудник, Руководитель, HR, Администратор)</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="gap-1">
                Всего: {parsedUsers.length}
              </Badge>
              <Badge variant="default" className="gap-1 bg-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Валидных: {validCount}
              </Badge>
              {errorCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  С ошибками: {errorCount}
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Строка</TableHead>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Должность</TableHead>
                    <TableHead>Грейд</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedUsers.map((user, idx) => (
                    <TableRow key={idx} className={user.status === 'error' ? 'bg-destructive/10' : ''}>
                      <TableCell>{user.rowNumber}</TableCell>
                      <TableCell>
                        {[user.last_name, user.first_name, user.middle_name].filter(Boolean).join(' ')}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.position_id ? (
                          user.position_name
                        ) : (
                          <span className="text-destructive">{user.position_name || '—'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.grade_id ? (
                          user.grade_name
                        ) : (
                          <span className="text-destructive">{user.grade_name || '—'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.role ? (
                          user.role_name
                        ) : (
                          <span className="text-destructive">{user.role_name || '—'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.status === 'pending' ? (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            Готов
                          </Badge>
                        ) : (
                          <div className="flex items-start gap-1">
                            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <span className="text-xs text-destructive">
                              {user.errors.join('; ')}
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Выполняется импорт пользователей...</p>
            <p className="text-sm text-muted-foreground">Это может занять некоторое время</p>
          </div>
        )}

        {step === 'report' && report && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="gap-1">
                Всего: {report.total}
              </Badge>
              <Badge variant="default" className="gap-1 bg-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Успешно: {report.success}
              </Badge>
              {report.failed > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Ошибок: {report.failed}
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Строка</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Результат</TableHead>
                    <TableHead>Сообщение</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.results.map((result, idx) => (
                    <TableRow 
                      key={idx} 
                      className={result.status === 'error' ? 'bg-destructive/10' : 'bg-green-50 dark:bg-green-950/20'}
                    >
                      <TableCell>{result.rowNumber}</TableCell>
                      <TableCell>{result.email}</TableCell>
                      <TableCell>
                        {result.status === 'success' ? (
                          <Badge variant="default" className="bg-green-600">Успешно</Badge>
                        ) : (
                          <Badge variant="destructive">Ошибка</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{result.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Отмена
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Назад
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={validCount === 0}
              >
                Импортировать ({validCount})
              </Button>
            </>
          )}
          {step === 'report' && (
            <Button onClick={handleClose}>
              Закрыть
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportUsersDialog;
