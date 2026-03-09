import { describe, expect, it } from 'vitest';
import { computeDiagramLayout } from './diagramEngine';
import { parseDsl } from './parseDsl';
import type { Parsed, Position, VisualNode } from './types';

function makeNode(key: string, name: string): VisualNode {
  return {
    type: 'cmd',
    name,
    alias: null,
    stream: null,
    key,
    data: null,
    srcRange: { from: 0, to: 0 }
  };
}

describe('diagramEngine dimensions plumbing', () => {
  it('computes ELK layout without requiring an engine parameter', async () => {
    const before = makeNode('before', 'Before node');
    const anchor = makeNode('anchor', 'Anchor node');
    const after = makeNode('after', 'After node');
    const parsed: Parsed = {
      sliceName: 'slice',
      nodes: new Map([
        [before.key, before],
        [anchor.key, anchor],
        [after.key, after]
      ]),
      edges: [{ from: before.key, to: anchor.key, label: null }],
      warnings: [],
      boundaries: [{ after: anchor.key }],
      scenarios: [],
      scenarioOnlyNodeKeys: []
    };
    const measuredAnchorWidth = 320;
    const layout = await computeDiagramLayout(parsed, {
      nodeDimensions: {
        [anchor.key]: { width: measuredAnchorWidth, height: 42 }
      }
    });

    expect(layout.layout.pos.anchor?.w).toBe(measuredAnchorWidth);
    expect(layout.layout.pos.after?.x).toBeGreaterThanOrEqual(
      (layout.layout.pos.anchor?.x ?? 0) + measuredAnchorWidth + 40 + 40
    );
  });

  it('does not let scenario-only nodes shift main diagram node columns', async () => {
    const scenarioOnly = makeNode('scenario-only', 'Scenario only');
    const main = makeNode('main', 'Main node');
    const parsed: Parsed = {
      sliceName: 'slice',
      nodes: new Map([
        [scenarioOnly.key, scenarioOnly],
        [main.key, main]
      ]),
      edges: [],
      warnings: [],
      boundaries: [],
      scenarios: [],
      scenarioOnlyNodeKeys: [scenarioOnly.key]
    };

    const layout = await computeDiagramLayout(parsed);
    const xValues = Object.values(layout.layout.pos).map((position: Position) => position.x);

    expect(layout.layout.pos.main).toBeDefined();
    expect(layout.layout.pos['scenario-only']).toBeUndefined();
    expect(Math.min(...xValues)).toBe(50);
  });

  it('keeps main diagram left-aligned when scenarios are present in parsed DSL', async () => {
    const parsed = parseDsl(`slice "Untitled"

ui:rename-todo-form
rm:all-todos
cmd:rename-todo <- ui:rename-todo-form

scenario "Complete Single TODO Item"
given:
  evt:todo-added

when:
  cmd:complete-todo

then:
  evt:todo-completed

scenario "Complete TODO List"
given:
  evt:todo-added

when:
  cmd:complete-todo-list

then:
  evt:todo-completed`);

    const layout = await computeDiagramLayout(parsed);
    const xValues = Object.values(layout.layout.pos).map((position) => position.x);

    expect(parsed.scenarioOnlyNodeKeys.length).toBeGreaterThan(0);
    expect(Math.min(...xValues)).toBe(50);
  });
});
