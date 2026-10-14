// @vitest-environment jsdom

import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {ChapterSidebar} from './ChapterSidebar';

describe('ChapterSidebar', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container?.remove();
    container = null;
  });

  it('shows a pre-selected New Chapter input after clicking add', async () => {
    await act(async () => {
      root?.render(
        createElement(ChapterSidebar, {
          chapters: [{id: 'chapter-1', title: 'Overview'}],
          activeChapterId: 'chapter-1',
          onSelectChapter: () => {},
          onCollapse: () => {},
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.chapter-sidebar-add')?.click();
      await Promise.resolve();
    });

    const input = container?.querySelector<HTMLInputElement>('.chapter-sidebar input');
    expect(input).not.toBeNull();
    expect(input?.value).toBe('New Chapter');
    expect(document.activeElement).toBe(input);
    expect(input?.selectionStart).toBe(0);
    expect(input?.selectionEnd).toBe('New Chapter'.length);
  });

  it('submits the new chapter when pressing Enter in the input', async () => {
    const onAddChapter = vi.fn();

    await act(async () => {
      root?.render(
        createElement(ChapterSidebar, {
          chapters: [{id: 'chapter-1', title: 'Overview'}],
          activeChapterId: 'chapter-1',
          onSelectChapter: () => {},
          onCollapse: () => {},
          onAddChapter,
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.chapter-sidebar-add')?.click();
      await Promise.resolve();
    });

    const input = container?.querySelector<HTMLInputElement>('.chapter-sidebar input');
    if (!input) {
      throw new Error('expected chapter input');
    }

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
      await Promise.resolve();
    });

    expect(onAddChapter).toHaveBeenCalledWith('New Chapter');
    expect(container?.querySelector('.chapter-sidebar input')).toBeNull();
  });

  it('cancels chapter creation on Escape without submitting', async () => {
    const onAddChapter = vi.fn();

    await act(async () => {
      root?.render(
        createElement(ChapterSidebar, {
          chapters: [{id: 'chapter-1', title: 'Overview'}],
          activeChapterId: 'chapter-1',
          onSelectChapter: () => {},
          onCollapse: () => {},
          onAddChapter,
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.chapter-sidebar-add')?.click();
      await Promise.resolve();
    });

    const input = container?.querySelector<HTMLInputElement>('.chapter-sidebar input');
    if (!input) {
      throw new Error('expected chapter input');
    }

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      await Promise.resolve();
    });

    expect(onAddChapter).not.toHaveBeenCalled();
    expect(container?.querySelector('.chapter-sidebar input')).toBeNull();
  });

  it('cancels chapter creation when the input blurs', async () => {
    const onAddChapter = vi.fn();

    await act(async () => {
      root?.render(
        createElement(ChapterSidebar, {
          chapters: [{id: 'chapter-1', title: 'Overview'}],
          activeChapterId: 'chapter-1',
          onSelectChapter: () => {},
          onCollapse: () => {},
          onAddChapter,
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.chapter-sidebar-add')?.click();
      await Promise.resolve();
    });

    const input = container?.querySelector<HTMLInputElement>('.chapter-sidebar input');
    if (!input) {
      throw new Error('expected chapter input');
    }

    await act(async () => {
      input.blur();
      await Promise.resolve();
    });

    expect(onAddChapter).not.toHaveBeenCalled();
    expect(container?.querySelector('.chapter-sidebar input')).toBeNull();
  });

  it('submits chapter creation when clicking the green checkmark', async () => {
    const onAddChapter = vi.fn();

    await act(async () => {
      root?.render(
        createElement(ChapterSidebar, {
          chapters: [{id: 'chapter-1', title: 'Overview'}],
          activeChapterId: 'chapter-1',
          onSelectChapter: () => {},
          onCollapse: () => {},
          onAddChapter,
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.chapter-sidebar-add')?.click();
      await Promise.resolve();
    });

    expect(container?.querySelector('.chapter-sidebar-create-confirm svg')).not.toBeNull();

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.chapter-sidebar-create-confirm')?.click();
      await Promise.resolve();
    });

    expect(onAddChapter).toHaveBeenCalledWith('New Chapter');
    expect(container?.querySelector('.chapter-sidebar input')).toBeNull();
  });
});
