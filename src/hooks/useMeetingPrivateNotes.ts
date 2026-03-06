import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PrivateNote {
  id: string;
  meeting_id: string;
  manager_id: string;
  private_note: string | null;
  created_at: string;
  updated_at: string;
}

interface UseMeetingPrivateNotesResult {
  privateNote: string;
  setPrivateNote: (note: string) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

export function useMeetingPrivateNotes(meetingId: string): UseMeetingPrivateNotesResult {
  const [privateNote, setPrivateNoteState] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<string>('');

  // Загрузка заметки
  useEffect(() => {
    const fetchNote = async () => {
      if (!meetingId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error: fetchError } = await supabase
          .from('meeting_private_notes')
          .select('*')
          .eq('meeting_id', meetingId)
          .maybeSingle();

        if (fetchError) throw fetchError;
        
        const note = data?.private_note || '';
        setPrivateNoteState(note);
        lastSavedRef.current = note;
      } catch (err) {
        console.error('Error fetching private note:', err);
        setError('Ошибка загрузки заметки');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNote();
  }, [meetingId]);

  // Автосохранение с debounce
  const saveNote = useCallback(async (note: string) => {
    if (!meetingId || note === lastSavedRef.current) return;
    
    setIsSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: upsertError } = await supabase
        .from('meeting_private_notes')
        .upsert({
          meeting_id: meetingId,
          manager_id: user.id,
          private_note: note,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'meeting_id,manager_id'
        });

      if (upsertError) throw upsertError;
      
      lastSavedRef.current = note;
      toast.success('Приватная заметка сохранена', { duration: 2000 });
    } catch (err) {
      console.error('Error saving private note:', err);
      toast.error('Ошибка сохранения заметки');
    } finally {
      setIsSaving(false);
    }
  }, [meetingId]);

  // Обёртка для установки заметки с автосохранением
  const setPrivateNote = useCallback((note: string) => {
    setPrivateNoteState(note);
    
    // Очищаем предыдущий таймер
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Устанавливаем новый таймер для автосохранения
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(note);
    }, 1500);
  }, [saveNote]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    privateNote,
    setPrivateNote,
    isLoading,
    isSaving,
    error
  };
}
