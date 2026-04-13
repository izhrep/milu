import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { z } from 'zod';

// --- Types ---

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface DraftEntry<T> {
  data: T;
  savedAt: string; // ISO timestamp
}

/** All fields required — callers must pass a full snapshot, not partial updates. */
interface SafeFields {
  emp_mood: string;
  emp_successes: string;
  emp_problems: string;
  emp_news: string;
  emp_questions: string;
  meeting_link: string;
}

/** All fields required — callers must pass a full snapshot, not partial updates. */
interface MgrFields {
  mgr_praise: string;
  mgr_development_comment: string;
  mgr_news: string;
}

interface AutoSaveCallbacks {
  silentUpdateMeetingAsync: (args: { id: string } & Partial<SafeFields>) => Promise<any>;
  silentUpsertManagerFieldsAsync: (args: {
    meeting_id: string;
    mgr_praise?: string | null;
    mgr_development_comment?: string | null;
    mgr_news?: string | null;
  }) => Promise<any>;
  rescheduleSilentAsync: (args: { p_meeting_id: string; p_new_date: string }) => Promise<any>;
}

interface UseMeetingFormAutoSaveOptions {
  meetingId: string;
  userId?: string;
  callbacks: AutoSaveCallbacks;
  enabled: boolean;
}

// --- Helpers ---

const meetingLinkSchema = z.string().refine(
  (val) => {
    if (!val || val.trim() === '') return true;
    try { return new URL(val).protocol === 'https:'; } catch { return false; }
  },
);

function draftKey(channel: string, meetingId: string, userId?: string) {
  const suffix = userId ? `-${userId}` : '';
  return `mtg-draft-${channel}-${meetingId}${suffix}`;
}

function saveDraft<T>(channel: string, meetingId: string, data: T, userId?: string) {
  try {
    const entry: DraftEntry<T> = { data, savedAt: new Date().toISOString() };
    localStorage.setItem(draftKey(channel, meetingId, userId), JSON.stringify(entry));
  } catch { /* quota exceeded — ignore */ }
}

function loadDraft<T>(channel: string, meetingId: string, serverUpdatedAt?: string, userId?: string): DraftEntry<T> | null {
  try {
    const raw = localStorage.getItem(draftKey(channel, meetingId, userId));
    if (!raw) return null;
    const entry = JSON.parse(raw) as DraftEntry<T>;
    if (serverUpdatedAt && entry.savedAt < serverUpdatedAt) {
      localStorage.removeItem(draftKey(channel, meetingId, userId));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function clearDraftKey(channel: string, meetingId: string, userId?: string) {
  localStorage.removeItem(draftKey(channel, meetingId, userId));
}

/**
 * Conditionally clear draft only if localStorage still holds the exact data
 * that was just saved. If the user typed something newer while the save was
 * in-flight, the draft is preserved.
 */
function clearDraftIfUnchanged<T>(channel: string, meetingId: string, savedData: T, userId?: string) {
  try {
    const raw = localStorage.getItem(draftKey(channel, meetingId, userId));
    if (!raw) return;
    const entry = JSON.parse(raw) as DraftEntry<T>;
    if (JSON.stringify(entry.data) === JSON.stringify(savedData)) {
      localStorage.removeItem(draftKey(channel, meetingId, userId));
    }
  } catch { /* ignore */ }
}

function shallowEqual(a: Record<string, any>, b: Record<string, any>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(k => a[k] === b[k]);
}

/**
 * Parse structured error code from RPC exception message.
 * RPC raises e.g. "CONFLICT: Employee already has..."
 * Returns the code prefix or null.
 */
export function parseRpcErrorCode(message: string): string | null {
  const match = message.match(/^(CONFLICT|PAST_DATE|FORBIDDEN|NOT_FOUND):/);
  return match ? match[1] : null;
}

// --- Hook ---

export function useMeetingFormAutoSave({ meetingId, userId, callbacks, enabled }: UseMeetingFormAutoSaveOptions) {
  // Per-channel status
  const [safeStatus, setSafeStatus] = useState<SaveStatus>('idle');
  const [mgrStatus, setMgrStatus] = useState<SaveStatus>('idle');
  const [dateStatus, setDateStatus] = useState<SaveStatus>('idle');

  // Last saved snapshots (to diff)
  const lastSavedSafe = useRef<SafeFields>({ emp_mood: '', emp_successes: '', emp_problems: '', emp_news: '', emp_questions: '', meeting_link: '' });
  const lastSavedMgr = useRef<MgrFields>({ mgr_praise: '', mgr_development_comment: '', mgr_news: '' });
  const lastSavedDate = useRef<string>('');

  // Debounce timers
  const safeTimer = useRef<ReturnType<typeof setTimeout>>();
  const mgrTimer = useRef<ReturnType<typeof setTimeout>>();
  const dateTimer = useRef<ReturnType<typeof setTimeout>>();

  // Status-reset timers (so we can cancel them)
  const safeResetTimer = useRef<ReturnType<typeof setTimeout>>();
  const mgrResetTimer = useRef<ReturnType<typeof setTimeout>>();
  const dateResetTimer = useRef<ReturnType<typeof setTimeout>>();

  // Saving lock to prevent double-fire
  const safeSaving = useRef(false);
  const mgrSaving = useRef(false);
  const dateSaving = useRef(false);

  /**
   * Generation counter for date channel. Incremented on every cancelPendingDate()
   * call so that in-flight RPC responses from a previous generation are ignored.
   */
  const dateGeneration = useRef(0);

  // Reset statuses on meetingId change
  useEffect(() => {
    setSafeStatus('idle');
    setMgrStatus('idle');
    setDateStatus('idle');
    lastSavedSafe.current = { emp_mood: '', emp_successes: '', emp_problems: '', emp_news: '', emp_questions: '', meeting_link: '' };
    lastSavedMgr.current = { mgr_praise: '', mgr_development_comment: '', mgr_news: '' };
    lastSavedDate.current = '';
    dateGeneration.current = 0;
    clearTimeout(safeResetTimer.current);
    clearTimeout(mgrResetTimer.current);
    clearTimeout(dateResetTimer.current);
  }, [meetingId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(safeTimer.current);
      clearTimeout(mgrTimer.current);
      clearTimeout(dateTimer.current);
      clearTimeout(safeResetTimer.current);
      clearTimeout(mgrResetTimer.current);
      clearTimeout(dateResetTimer.current);
    };
  }, []);

  // --- Safe fields channel (1.5s) ---
  const debounceSafeFields = useCallback((fields: SafeFields) => {
    if (!enabled) return;

    saveDraft('safe', meetingId, fields, userId);

    if (fields.meeting_link && fields.meeting_link.trim() !== '') {
      if (!meetingLinkSchema.safeParse(fields.meeting_link).success) return;
    }

    clearTimeout(safeTimer.current);
    safeTimer.current = setTimeout(async () => {
      if (safeSaving.current) return;
      if (shallowEqual(fields, lastSavedSafe.current)) return;

      safeSaving.current = true;
      clearTimeout(safeResetTimer.current);
      setSafeStatus('saving');
      try {
        await callbacks.silentUpdateMeetingAsync({ id: meetingId, ...fields });
        lastSavedSafe.current = { ...fields };
        clearDraftIfUnchanged('safe', meetingId, fields, userId);
        setSafeStatus('saved');
        safeResetTimer.current = setTimeout(() => setSafeStatus(s => s === 'saved' ? 'idle' : s), 3000);
      } catch (err) {
        console.error('Autosave safe fields error:', err);
        setSafeStatus('error');
      } finally {
        safeSaving.current = false;
      }
    }, 1500);
  }, [meetingId, userId, enabled, callbacks]);

  // --- Manager fields channel (1.5s) ---
  const debounceMgrFields = useCallback((fields: MgrFields) => {
    if (!enabled) return;

    saveDraft('mgr', meetingId, fields, userId);

    clearTimeout(mgrTimer.current);
    mgrTimer.current = setTimeout(async () => {
      if (mgrSaving.current) return;
      if (shallowEqual(fields, lastSavedMgr.current)) return;

      mgrSaving.current = true;
      clearTimeout(mgrResetTimer.current);
      setMgrStatus('saving');
      try {
        await callbacks.silentUpsertManagerFieldsAsync({
          meeting_id: meetingId,
          mgr_praise: fields.mgr_praise ?? null,
          mgr_development_comment: fields.mgr_development_comment ?? null,
          mgr_news: fields.mgr_news ?? null,
        });
        lastSavedMgr.current = { ...fields };
        clearDraftIfUnchanged('mgr', meetingId, fields, userId);
        setMgrStatus('saved');
        mgrResetTimer.current = setTimeout(() => setMgrStatus(s => s === 'saved' ? 'idle' : s), 3000);
      } catch (err) {
        console.error('Autosave mgr fields error:', err);
        setMgrStatus('error');
      } finally {
        mgrSaving.current = false;
      }
    }, 1500);
  }, [meetingId, userId, enabled, callbacks]);

  // --- Date channel (3s) ---
  const debounceDateField = useCallback((meetingDateUtcIso: string) => {
    if (!enabled || !meetingDateUtcIso) return;

    saveDraft('date', meetingId, meetingDateUtcIso, userId);

    clearTimeout(dateTimer.current);
    dateTimer.current = setTimeout(async () => {
      if (dateSaving.current) return;
      if (meetingDateUtcIso === lastSavedDate.current) return;

      const targetDate = new Date(meetingDateUtcIso);
      if (isNaN(targetDate.getTime()) || targetDate <= new Date()) {
        console.warn('Autosave date skipped: date is in the past or invalid', meetingDateUtcIso);
        return;
      }

      // Capture current generation before async work
      const gen = dateGeneration.current;

      dateSaving.current = true;
      clearTimeout(dateResetTimer.current);
      setDateStatus('saving');
      try {
        await callbacks.rescheduleSilentAsync({
          p_meeting_id: meetingId,
          p_new_date: meetingDateUtcIso,
        });

        // P1: If generation changed while we were saving, a dialog reschedule
        // superseded us. Ignore this result — don't update lastSaved or clear draft.
        if (dateGeneration.current !== gen) {
          console.info('Autosave date result ignored: superseded by dialog reschedule');
          return;
        }

        lastSavedDate.current = meetingDateUtcIso;
        clearDraftIfUnchanged('date', meetingId, meetingDateUtcIso, userId);
        setDateStatus('saved');
        dateResetTimer.current = setTimeout(() => setDateStatus(s => s === 'saved' ? 'idle' : s), 3000);
      } catch (err: any) {
        // P1: If generation changed, ignore error too
        if (dateGeneration.current !== gen) return;

        console.error('Autosave date error:', err);

        // P1: Clear stale draft on conflict/validation errors so user doesn't
        // see a rejected date after refresh
        const code = parseRpcErrorCode(err?.message || '');
        if (code === 'CONFLICT' || code === 'PAST_DATE') {
          clearDraftKey('date', meetingId, userId);
        }

        setDateStatus('error');
      } finally {
        dateSaving.current = false;
      }
    }, 3000);
  }, [meetingId, userId, enabled, callbacks]);

  // --- Initialize last-saved refs from server data ---
  const initializeFromServer = useCallback((meeting: {
    emp_mood?: string | null;
    emp_successes?: string | null;
    emp_problems?: string | null;
    emp_news?: string | null;
    emp_questions?: string | null;
    meeting_link?: string | null;
    meeting_date?: string | null;
  }, mgrFields?: {
    mgr_praise?: string | null;
    mgr_development_comment?: string | null;
    mgr_news?: string | null;
  } | null) => {
    lastSavedSafe.current = {
      emp_mood: meeting.emp_mood || '',
      emp_successes: meeting.emp_successes || '',
      emp_problems: meeting.emp_problems || '',
      emp_news: meeting.emp_news || '',
      emp_questions: meeting.emp_questions || '',
      meeting_link: meeting.meeting_link || '',
    };
    lastSavedDate.current = meeting.meeting_date || '';
    if (mgrFields) {
      lastSavedMgr.current = {
        mgr_praise: mgrFields.mgr_praise || '',
        mgr_development_comment: mgrFields.mgr_development_comment || '',
        mgr_news: mgrFields.mgr_news || '',
      };
    }
  }, []);

  // --- Draft recovery ---
  const recoverDrafts = useCallback((serverUpdatedAt?: string, mgrServerUpdatedAt?: string) => {
    const safeDraft = loadDraft<SafeFields>('safe', meetingId, serverUpdatedAt, userId);
    const mgrDraft = loadDraft<MgrFields>('mgr', meetingId, mgrServerUpdatedAt ?? serverUpdatedAt, userId);
    // P2/P7: Date draft uses its own savedAt vs server meeting_date comparison,
    // NOT the general meeting.updated_at, so other-field autosaves won't invalidate it.
    const dateDraft = loadDraft<string>('date', meetingId, undefined, userId);
    // Summary draft: don't use meeting.updated_at for stale-check because
    // autosave of other fields (emp_mood, link, etc.) bumps updated_at and
    // would discard a valid summary draft that was written before those saves.
    const summaryDraft = loadDraft<string>('summary', meetingId, undefined, userId);

    const hasDraft = !!(safeDraft || mgrDraft || dateDraft || summaryDraft);
    return {
      hasDraft,
      drafts: {
        safe: safeDraft?.data || null,
        mgr: mgrDraft?.data || null,
        date: dateDraft?.data || null,
        summary: summaryDraft?.data || null,
      },
    };
  }, [meetingId, userId]);

  const clearAllDrafts = useCallback(() => {
    clearDraftKey('safe', meetingId, userId);
    clearDraftKey('mgr', meetingId, userId);
    clearDraftKey('date', meetingId, userId);
    clearDraftKey('summary', meetingId, userId);
  }, [meetingId, userId]);

  // --- Aggregated status ---
  const aggregatedStatus = useMemo((): SaveStatus => {
    if (safeStatus === 'saving' || mgrStatus === 'saving' || dateStatus === 'saving') return 'saving';
    if (safeStatus === 'error' || mgrStatus === 'error' || dateStatus === 'error') return 'error';
    if (safeStatus === 'saved' || mgrStatus === 'saved' || dateStatus === 'saved') return 'saved';
    return 'idle';
  }, [safeStatus, mgrStatus, dateStatus]);

  // --- Summary draft helpers (localStorage only, no autosave) ---
  const saveSummaryDraft = useCallback((text: string) => {
    saveDraft('summary', meetingId, text, userId);
  }, [meetingId, userId]);

  const clearSummaryDraft = useCallback(() => {
    clearDraftKey('summary', meetingId, userId);
  }, [meetingId, userId]);

  // --- Cancel pending date autosave (used when dialog reschedule supersedes inline) ---
  /**
   * P1 fix: Only cancels the pending timer and bumps the generation counter
   * so any in-flight RPC response is ignored. Does NOT clear the date draft —
   * draft cleanup is the caller's responsibility on success.
   */
  const cancelPendingDate = useCallback(() => {
    clearTimeout(dateTimer.current);
    dateGeneration.current += 1;
    // Don't clear draft here — if the dialog RPC fails, the draft should survive
  }, []);

  /**
   * Clear date draft. Called by the dialog on successful reschedule.
   */
  const clearDateDraft = useCallback(() => {
    clearDraftKey('date', meetingId, userId);
  }, [meetingId, userId]);

  return {
    debounceSafeFields,
    debounceMgrFields,
    debounceDateField,
    cancelPendingDate,
    clearDateDraft,
    initializeFromServer,
    recoverDrafts,
    clearAllDrafts,
    saveSummaryDraft,
    clearSummaryDraft,
    aggregatedStatus,
    safeStatus,
    mgrStatus,
    dateStatus,
  };
}
