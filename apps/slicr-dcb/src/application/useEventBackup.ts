import {useCallback, useEffect, useRef} from 'react';

import type {EventBackupService} from './eventBackup';
import {loadGraphApplication} from './graphApplicationLoader';

export function useEventBackup() {
  const serviceRef = useRef<EventBackupService | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadGraphApplication().then((application) => {
      if (!cancelled) {
        serviceRef.current = application.eventBackup;
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const getService = useCallback(async () => {
    const service = serviceRef.current ?? (await loadGraphApplication()).eventBackup;
    serviceRef.current = service;
    return service;
  }, []);

  const backupText = useCallback(async () => {
    const service = await getService();
    return service.backupText();
  }, [getService]);

  const restoreFrom = useCallback(async (backup: string) => {
    const service = await getService();
    await service.restoreFrom(backup);
  }, [getService]);

  return {backupText, restoreFrom};
}
