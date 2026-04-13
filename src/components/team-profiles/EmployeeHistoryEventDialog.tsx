import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type EventType = 'salary' | 'project' | 'role';

export interface HistoryEvent {
  id: string;
  type: EventType;
  date: string;
  endDate?: string;
  title: string;
  from?: string;
  to?: string;
  amount?: number;
  amountFrom?: number;
  comment?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: EventType;
  event?: HistoryEvent | null;
  onSave: (event: HistoryEvent) => void;
}

const TYPE_LABELS: Record<EventType, string> = {
  salary: 'зарплаты',
  project: 'проекта',
  role: 'должности / роли',
};

const EmployeeHistoryEventDialog: React.FC<Props> = ({ open, onOpenChange, type, event, onSave }) => {
  const isEdit = !!event;

  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [title, setTitle] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [amountFrom, setAmountFrom] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (event) {
      setDate(event.date);
      setEndDate(event.endDate || '');
      setTitle(event.title);
      setFrom(event.from || '');
      setTo(event.to || '');
      setAmount(event.amount?.toString() || '');
      setAmountFrom(event.amountFrom?.toString() || '');
      setComment(event.comment || '');
    } else {
      setDate('');
      setEndDate('');
      setTitle('');
      setFrom('');
      setTo('');
      setAmount('');
      setAmountFrom('');
      setComment('');
    }
  }, [event, open]);

  const handleSave = () => {
    onSave({
      id: event?.id || crypto.randomUUID(),
      type,
      date,
      endDate: endDate || undefined,
      title,
      from: from || undefined,
      to: to || undefined,
      amount: amount ? Number(amount) : undefined,
      amountFrom: amountFrom ? Number(amountFrom) : undefined,
      comment: comment || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isEdit ? 'Редактирование' : 'Новое изменение'} {TYPE_LABELS[type]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {type === 'salary' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Дата</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Сумма</Label>
                  <Input type="number" placeholder="₽" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {type === 'project' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Дата начала</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Дата окончания</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Проект</Label>
                <Input value={to} onChange={e => setTo(e.target.value)} placeholder="Название проекта" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Клиент</Label>
                <Input value={from} onChange={e => setFrom(e.target.value)} placeholder="Название клиента" />
              </div>
            </>
          )}

          {type === 'role' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Дата начала</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Дата окончания</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Должность / роль</Label>
                <Input value={to} onChange={e => setTo(e.target.value)} placeholder="Название" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Предыдущая</Label>
                <Input value={from} onChange={e => setFrom(e.target.value)} placeholder="Если применимо" />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Комментарий</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Необязательный комментарий" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button size="sm" onClick={handleSave}>
            {isEdit ? 'Сохранить' : 'Добавить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeHistoryEventDialog;
