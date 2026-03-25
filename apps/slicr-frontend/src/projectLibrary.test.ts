// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { APP_EVENT_STREAM_STORAGE_KEY, DEFAULT_PROJECT_ID, loadProjectIndex } from './projectLibrary';

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
    const appStreamRaw = localStorage.getItem(APP_EVENT_STREAM_STORAGE_KEY);
    expect(appStreamRaw).not.toBeNull();
    const appEvents = JSON.parse(appStreamRaw ?? '[]') as Array<{ type?: string; payload?: { projectId?: string } }>;
    expect(appEvents.some((event) => event.type === 'project-created' && event.payload?.projectId === DEFAULT_PROJECT_ID)).toBe(true);
  });
});
