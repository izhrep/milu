# Unified Meeting State & Stage Decommission

## Date: 2026-04-09

## What was done

### 1. `meeting_status_events` audit table + trigger
- New table logs every status transition on `one_on_one_meetings`.
- Populated exclusively by an `AFTER INSERT OR UPDATE` trigger (`trg_log_meeting_status_event`).
- No client writes allowed; RLS permits SELECT only for meeting participants or users with `meetings.view_all`.
- `change_source`: `'user'` when `auth.uid()` is present, `'system'` for cron/trigger context.
- Audit trail starts from migration date; no backfill for pre-existing meetings.

### 2. Shared `src/lib/meetingStatus.ts`
- `getEffectiveMeetingStatus()` — corrects for pg_cron lag (DB says `scheduled` but time has passed → `awaiting_summary`).
- `getMeetingStatusLabel()` — Russian labels.
- `getMeetingStatusVariant()` — shadcn Badge variant.
- `getMeetingStatusBadgeConfig()` — combined config.

All inline duplicates removed from:
- `MeetingsPage.tsx`
- `MeetingsMonitoringPage.tsx`
- `MeetingForm.tsx`
- `TeamMembersTable.tsx` (also fixes bug: was using raw DB status, now uses effective status)

### 3. Runtime stage decommission
`stage_id` wiring removed from runtime 1:1 meeting flow:

| File | Change |
|------|--------|
| `useOneOnOneMeetings.ts` | Removed `stageId` option, filter, hardcoded `stage_id: null` |
| `CreateMeetingDialog.tsx` | Removed `stageId` prop |
| `MeetingsPage.tsx` | Removed `stage_id` from create handler |
| `MeetingArtifacts.tsx` | Removed `stage_id` from meeting interface |
| `useMeetingArtifacts.ts` | Removed `meetingStageId` param, simplified `isStageLessExpired` |
| `useMenuVisibility.ts` | Removed `meeting_stage_participants` query (table empty) |
| `useMeetingDecisions.ts` | Removed `stage_id` from select |

## Legacy artifacts intentionally preserved

| Artifact | Reason |
|----------|--------|
| `stage_id` column on `one_on_one_meetings` | No data loss risk; requires separate migration + prod validation |
| `meeting_stages` table | 0 rows in dev, needs prod validation before DROP |
| `meeting_stage_participants` table | Same as above |
| `meeting_status_current` table | Legacy artifact, unused, safe to DROP in future pass |
| Stage references in `AdminSidebar`, `DataCleanupWidget` | Serve diagnostic stage management, not 1:1 flow |
| Shared stage components (`UnifiedStagesManager`, etc.) | Used by diagnostic stages |

## Pre-rollout validation (run on prod before deploy)

```sql
SELECT count(*), (stage_id IS NOT NULL) as has_stage FROM one_on_one_meetings GROUP BY 2;
SELECT count(*) FROM meeting_stages;
SELECT count(*) FROM meeting_stage_participants;
```

If any rows with `stage_id IS NOT NULL` exist in prod, assess impact before deploying.

## Diagnostic impact / no-regression

**Zero shared stage components modified.** Diagnostic flows (`/admin/stages`, substage creation, participant addition, existing stage display) are completely unaffected.
