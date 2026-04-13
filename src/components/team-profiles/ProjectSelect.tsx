import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROJECT_LIST } from './projectList';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Compact mode for inline table editing */
  compact?: boolean;
  className?: string;
}

const ProjectSelect = ({
  value,
  onChange,
  placeholder = 'Выберите проект',
  compact = false,
  className,
}: Props) => {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger
        className={compact
          ? 'h-7 text-xs border-0 bg-transparent shadow-none px-1 hover:bg-muted/60 focus:ring-0 focus:ring-offset-0 min-w-[120px]'
          : `h-9 text-sm ${className ?? ''}`
        }
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {PROJECT_LIST.map((p) => (
          <SelectItem key={p} value={p} className={compact ? 'text-xs' : 'text-sm'}>
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ProjectSelect;
