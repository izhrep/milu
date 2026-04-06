import { useState, useCallback, useEffect } from 'react';
import { ManagementProfile, emptyProfile } from '@/components/team-profiles/profileTypes';

const STORAGE_PREFIX = 'team_profiles_mvp:v1:';

function storageKey(viewerId: string): string {
  return `${STORAGE_PREFIX}${viewerId}`;
}

type ProfilesMap = Record<string, ManagementProfile>;

export function useTeamProfiles(viewerId: string | undefined) {
  const [profiles, setProfiles] = useState<ProfilesMap>({});

  // Load from localStorage on mount / viewerId change
  useEffect(() => {
    if (!viewerId) return;
    try {
      const raw = localStorage.getItem(storageKey(viewerId));
      if (raw) setProfiles(JSON.parse(raw));
      else setProfiles({});
    } catch {
      setProfiles({});
    }
  }, [viewerId]);

  const persist = useCallback(
    (next: ProfilesMap) => {
      if (!viewerId) return;
      setProfiles(next);
      localStorage.setItem(storageKey(viewerId), JSON.stringify(next));
    },
    [viewerId],
  );

  const getProfile = useCallback(
    (employeeId: string): ManagementProfile | null => profiles[employeeId] ?? null,
    [profiles],
  );

  const saveProfile = useCallback(
    (employeeId: string, data: ManagementProfile) => {
      persist({ ...profiles, [employeeId]: data });
    },
    [profiles, persist],
  );

  return { profiles, getProfile, saveProfile };
}
