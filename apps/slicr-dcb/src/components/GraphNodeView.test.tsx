// @vitest-environment jsdom

import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {GraphNodeView} from './GraphNodeView';

const baseProps = {
  node: {
    id: 'node-1',
    label: 'Checkout Completed',
    type: 'evt' as const,
    laneId: 'lane-0',
    width: 230,
    height: 86,
    x: 10,
    y: 20,
  },
  isFocused: true,
  isEditing: false,
  isMenuOpen: true,
  isConnectingSource: true,
  draftLabel: '',
  connectionMenuItems: [{id: 'edge-1', directionLabel: 'to' as const, nodeLabel: 'Next', nodeType: 'ui' as const}],
  onNodeClick: vi.fn(),
  onCloseOtherMenus: vi.fn(),
  onToggleMenu: vi.fn(),
  onAddConnectedNode: vi.fn(),
  onStartEditingNode: vi.fn(),
  onSetNodeType: vi.fn(),
  onStartConnection: vi.fn(),
  onDeleteConnection: vi.fn(),
  onDeleteNode: vi.fn(),
  onDraftLabelChange: vi.fn(),
  onSaveEditingNode: vi.fn(),
  onCancelEditingFromKeyboard: vi.fn(),
  onLabelBlur: vi.fn(),
};

const properties = [{id: 'prop-title', name: 'title', type: 'string', example: 'Hello'}] as const;

describe('GraphNodeView', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container?.remove();
    container = null;
  });

  it('renders measurement mode without transient focus controls or node menus', () => {
    const html = renderToStaticMarkup(createElement(GraphNodeView, {...baseProps, renderMode: 'measurement'}));

    expect(html).toContain('node-box');
    expect(html).toContain('Checkout Completed');
    expect(html).not.toContain('node-add-button');
    expect(html).not.toContain('node-menu-button');
    expect(html).not.toContain('node-menu');
    expect(html).not.toContain('node-focused');
    expect(html).not.toContain('node-connecting-source');
  });

  it('uses fixed node width in measurement mode for property nodes', () => {
    const html = renderToStaticMarkup(createElement(GraphNodeView, {...baseProps, renderMode: 'measurement', properties}));

    expect(html).toContain('width:230px');
    expect(html).toContain('max-width:360px');
    expect(html).not.toContain('width:max-content');
  });

  it('does not trigger editing handlers in measurement mode', async () => {
    const onStartEditingNode = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(GraphNodeView, {...baseProps, renderMode: 'measurement', onStartEditingNode}));
    });

    const labelButton = container.querySelector<HTMLButtonElement>('.node-label-button');
    expect(labelButton).not.toBeNull();

    labelButton?.dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));

    expect(onStartEditingNode).not.toHaveBeenCalled();
  });

  it('renders a property-grid below the title when node properties exist', () => {
    const html = renderToStaticMarkup(createElement(GraphNodeView, {...baseProps, properties}));

    expect(html).toContain('node-box-with-properties');
    expect(html).toContain('node-title-row');
    expect(html).toContain('node-property-grid');
    expect(html).toContain('property-grid');
  });

  it('keeps focused interactive styling and click behavior by default', async () => {
    const onNodeClick = vi.fn();
    const onCloseOtherMenus = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(GraphNodeView, {
          ...baseProps,
          isMenuOpen: false,
          onNodeClick,
          onCloseOtherMenus,
        }),
      );
    });

    const nodeBox = container.querySelector<HTMLDivElement>('.node-box');
    expect(nodeBox?.classList.contains('node-focused')).toBe(true);
    expect(nodeBox?.classList.contains('node-connecting-source')).toBe(true);
    expect(container.querySelectorAll('.node-add-button')).toHaveLength(3);
    expect(container.querySelector('.node-menu-button')).not.toBeNull();

    nodeBox?.dispatchEvent(new MouseEvent('click', {bubbles: true}));

    expect(onNodeClick).toHaveBeenCalledWith(baseProps.node);
    expect(onCloseOtherMenus).toHaveBeenCalledTimes(1);
  });
});
