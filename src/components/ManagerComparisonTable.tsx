import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpDown, Download, Filter } from 'lucide-react';
import { EmployeeComparison } from '@/hooks/useManagerComparison';
import { getScoreColor } from '@/lib/scoreLabels';

interface ManagerComparisonTableProps {
  employees: EmployeeComparison[];
  onFilterChange: (filters: any) => void;
  departments?: Array<{ id: string; name: string }>;
  skills?: Array<{ id: string; name: string }>;
  qualities?: Array<{ id: string; name: string }>;
  /** Max score for hard skills column. Defaults to 5 (legacy). */
  hardMaxScore?: number;
  /** Max score for soft skills column. Defaults to 4 (legacy). */
  softMaxScore?: number;
}

type SortField = 'full_name' | 'skill_average' | 'quality_average' | 'overall_average';
type SortDirection = 'asc' | 'desc';

export const ManagerComparisonTable = ({
  employees,
  onFilterChange,
  departments = [],
  skills = [],
  qualities = [],
  hardMaxScore = 5,
  softMaxScore = 4,
}: ManagerComparisonTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filters, setFilters] = useState({
    departmentId: '',
    period: '',
    skillId: '',
    qualityId: '',
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const exportToCSV = () => {
    const headers = ['ФИО', 'Должность', 'Подразделение', 'Hard Skills', 'Soft Skills', 'Общий балл', 'Период'];
    const rows = filteredAndSortedEmployees.map(emp => [
      emp.full_name,
      emp.position,
      emp.department,
      emp.skill_average,
      emp.quality_average,
      emp.overall_average,
      emp.period
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comparison_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filteredAndSortedEmployees = employees
    .filter(emp => 
      emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.position.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return multiplier * aVal.localeCompare(bVal);
      }
      return multiplier * ((aVal as number) - (bVal as number));
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Сравнение сотрудников</span>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Экспорт CSV
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          <div className="flex gap-4 flex-wrap items-center">
            <Input
              placeholder="Поиск по ФИО или должности..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
            <Filter className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select value={filters.departmentId} onValueChange={(v) => handleFilterChange('departmentId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Подразделение" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.period} onValueChange={(v) => handleFilterChange('period', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Период" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все</SelectItem>
                <SelectItem value="H1_2025">H1 2025</SelectItem>
                <SelectItem value="H2_2024">H2 2024</SelectItem>
                <SelectItem value="H1_2024">H1 2024</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.skillId} onValueChange={(v) => handleFilterChange('skillId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Hard Skill" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все</SelectItem>
                {skills.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.qualityId} onValueChange={(v) => handleFilterChange('qualityId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Soft Skill" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все</SelectItem>
                {qualities.map(q => (
                  <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('full_name')}
                    className="flex items-center gap-2"
                  >
                    ФИО
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Должность</TableHead>
                <TableHead>Подразделение</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('skill_average')}
                    className="flex items-center gap-2"
                  >
                    Навыки
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('quality_average')}
                    className="flex items-center gap-2"
                  >
                    Soft Skills
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('overall_average')}
                    className="flex items-center gap-2"
                  >
                    Общий балл
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Оценок</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Нет данных для отображения
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedEmployees.slice(0, 50).map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.full_name}</TableCell>
                    <TableCell>{emp.position}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>
                      <span className={getScoreColor(emp.skill_average, hardMaxScore)}>
                        {emp.skill_average.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={getScoreColor(emp.quality_average, softMaxScore)}>
                        {emp.quality_average.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-semibold ${getScoreColor(emp.overall_average, hardMaxScore)}`}>
                        {emp.overall_average.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>{emp.assessment_count}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredAndSortedEmployees.length > 50 && (
          <p className="text-sm text-muted-foreground mt-4">
            Показано 50 из {filteredAndSortedEmployees.length} записей. Используйте фильтры для уточнения результатов.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
