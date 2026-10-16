// @vitest-environment jsdom

import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import {ProductionGraphEditor} from './ProductionGraphEditor';

describe('ProductionGraphEditor', () => {
  it.each(['standalone', 'project'] as const)('provides the shared interactive canvas in %s mode', (mode) => {
    const onCanvasPointerDown = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(
        ProductionGraphEditor,
        {
          mode,
          canvasRef: {current: null},
          measurementRef: {current: null},
          renderedNodes: [],
          graphNodes: [
            {id: 'source', label: 'Source label', type: 'ui', laneId: 'lane-1', width: 100, height: 50},
            {id: 'focus', label: 'Focused label', type: 'ui', laneId: 'lane-1', width: 100, height: 50},
          ],
          graphEdges: [],
          renderedEdges: [],
          nodePropertiesById: {},
          focusedNodeId: 'focus',
          focusedNodeProperties: [],
          editingNodeId: null,
          menuNodeId: null,
          connectingNodeId: 'source',
          focusedPropertyId: null,
          hoveredPropertyId: null,
          draftLabel: '',
          onCanvasPointerDown,
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
          onCancelEditing: vi.fn(),
          onLabelBlur: vi.fn(),
          onFocusedPropertyChange: vi.fn(),
          onHoveredPropertyChange: vi.fn(),
          onChangeFocusedProperties: vi.fn(),
        },
        createElement('div', {'data-testid': 'graph-content'}, 'Graph'),
      ),
    );

    expect(markup).toContain('data-editor-mode="' + mode + '"');
    expect(markup).toContain('Graph');
    expect(markup).toContain('canvas');
    expect(markup).toContain('from “Source label”');
    expect(markup).not.toContain('from “Focused label”');
  });
});
