// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_ID, PROJECTS_INDEX_STORAGE_KEY, loadProjectIndex } from './projectLibrary';

afterEach(() => {
  localStorage.clear();
});

describe('projectLibrary', () => {
  it('migrates v1 state by creating a Default project and selecting it', () => {
    localStorage.setItem(
      'slicr.es.v1.index',
      JSON.stringify({
        sliceIds: ['slice-a']
      })
    );
    localStorage.setItem(
      'slicr.es.v1.stream.slice-a',
      JSON.stringify([
        {
          id: 'e-1',
          sliceId: 'slice-a',
          version: 1,
          at: '2026-01-01T00:00:01.000Z',
          type: 'slice-created',
          payload: { initialDsl: 'slice "Legacy"\n\nevt:legacy' }
        }
      ])
    );

    const index = loadProjectIndex();

    expect(index.selectedProjectId).toBe(DEFAULT_PROJECT_ID);
    expect(index.projects).toEqual([{ id: DEFAULT_PROJECT_ID, name: 'Default' }]);
    expect(localStorage.getItem(PROJECTS_INDEX_STORAGE_KEY)).not.toBeNull();
  });
});
