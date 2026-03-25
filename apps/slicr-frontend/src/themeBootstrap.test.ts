// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { applyStoredTheme } from './themeBootstrap';

describe('applyStoredTheme', () => {
  it('applies the persisted theme to the document root before React mounts', () => {
    const storage = {
      getItem(key: string) {
        return key === 'slicr.theme' ? 'light' : null;
      }
    } as Pick<Storage, 'getItem'>;

    expect(document.documentElement.dataset.theme).toBeUndefined();

    applyStoredTheme(document, storage, 'slicr.theme');

    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
