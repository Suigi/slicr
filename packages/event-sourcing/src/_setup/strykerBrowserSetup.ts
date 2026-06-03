declare const __STRYKER_ACTIVE_MUTANT__: string | undefined;

if (typeof __STRYKER_ACTIVE_MUTANT__ === 'string' && __STRYKER_ACTIVE_MUTANT__ !== '') {
  const globalWithStryker = globalThis as typeof globalThis & {
    __stryker__?: {activeMutant?: string};
  };

  globalWithStryker.__stryker__ = {
    ...(globalWithStryker.__stryker__ ?? {}),
    activeMutant: __STRYKER_ACTIVE_MUTANT__,
  };
}
