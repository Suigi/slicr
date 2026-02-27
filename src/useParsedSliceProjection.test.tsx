// @vitest-environment jsdom
import { act, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDsl } from './domain/parseDsl';
import { useParsedSliceProjection } from './useParsedSliceProjection';

vi.mock('./domain/parseDsl', () => ({
  parseDsl: vi.fn((dsl: string) => ({ marker: dsl.length }))
}));

type SliceTextDocument = {
  id: string;
  dsl: string;
};

let latestProjection: ReturnType<typeof useParsedSliceProjection> | null = null;

function Harness({ slices, onProjection }: { slices: SliceTextDocument[]; onProjection: (value: ReturnType<typeof useParsedSliceProjection>) => void }) {
  const projection = useParsedSliceProjection(slices);

  useEffect(() => {
    onProjection(projection);
  }, [onProjection, projection]);

  return null;
}

describe('useParsedSliceProjection', () => {
  let host: HTMLDivElement | null = null;
  let root: ReactDOM.Root | null = null;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    host?.remove();
    host = null;
    latestProjection = null;
  });

  it('reuses unchanged parsed slices across rerenders', () => {
    const parseDslMock = vi.mocked(parseDsl);
    parseDslMock.mockClear();

    host = document.createElement('div');
    document.body.append(host);
    root = ReactDOM.createRoot(host);

    act(() => {
      root?.render(
        <Harness
          onProjection={(value) => {
            latestProjection = value;
          }}
          slices={[
            { id: 'a', dsl: 'slice "A"' },
            { id: 'b', dsl: 'slice "B"' }
          ]}
        />
      );
    });

    const firstB = latestProjection?.bySliceId.get('b');

    expect(parseDslMock).toHaveBeenCalledTimes(2);
    expect(firstB).toBeDefined();

    act(() => {
      root?.render(
        <Harness
          onProjection={(value) => {
            latestProjection = value;
          }}
          slices={[
            { id: 'a', dsl: 'slice "A edited"' },
            { id: 'b', dsl: 'slice "B"' }
          ]}
        />
      );
    });

    expect(parseDslMock).toHaveBeenCalledTimes(3);
    expect(latestProjection?.bySliceId.get('b')).toBe(firstB);
  });
});
