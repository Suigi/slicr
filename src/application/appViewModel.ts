import type { useAppState } from './useAppState';

export type UseAppStateResult = ReturnType<typeof useAppState>;
export type AppShellProps = UseAppStateResult;
