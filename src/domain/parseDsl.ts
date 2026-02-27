import { parser } from '../slicr.parser';
import * as terms from '../slicr.parser.terms';
import { JSONPath } from 'jsonpath-plus';
import { applyMappingsToNodes, MappingEntry, parseUsesBlocks } from './dataMapping';
import { validateDataIntegrity } from './dataIntegrity';
import { Edge, NodeData, Parsed, ParsedScenario, ParsedScenarioEntry, ParseWarning, SliceBoundary, VisualNode } from './types';

type NodeSpec = {
  line: number;
  type: string;
  name: string;
  isScenario: boolean;
  alias: string | null;
  stream: string | null;
  incoming: ArtifactRef[];
  outgoing: ArtifactRef[];
  data: NodeData;
  srcRange: { from: number; to: number };
  dataEndPos?: number;
  dataKeyRanges?: Record<string, { from: number; to: number }>;
};

type ArtifactRef = {
  type: string;
  name: string;
  range: { from: number; to: number };
};

type YamlEntry = {
  indent: number;
  text: string;
};

type ParseCursor = {
  type: { id: number };
  from: number;
  to: number;
  firstChild: () => boolean;
  nextSibling: () => boolean;
  parent: () => boolean;
  next: () => boolean;
};

type EdgeClauseSpec = {
  line: number;
  incoming: ArtifactRef[];
  outgoing: ArtifactRef[];
  from: number;
  to: number;
};

type StreamClauseSpec = {
  line: number;
  stream: string;
};

const SCENARIO_NODE_NAME_PATTERN = '[a-zA-Z_][a-zA-Z0-9_#-]*';
const SCENARIO_NODE_VERSION_PATTERN = '(?:@[0-9]+(?:\\.[0-9]+)?)?';
const SCENARIO_ALIAS_PATTERN = '(?:\\s+("(?:[^"\\\\]|\\\\.)*"))?';
const SCENARIO_PREFIXED_NODE_RE = new RegExp(
  `^(rm|ui|cmd|evt|exc|aut|ext):(${SCENARIO_NODE_NAME_PATTERN}${SCENARIO_NODE_VERSION_PATTERN})${SCENARIO_ALIAS_PATTERN}$`
);
const SCENARIO_GENERIC_NODE_RE = new RegExp(
  `^(${SCENARIO_NODE_NAME_PATTERN}${SCENARIO_NODE_VERSION_PATTERN})${SCENARIO_ALIAS_PATTERN}$`
);

type ParseTraceState = {
  total: number;
  byCaller: Map<string, number>;
};

const PARSE_TRACE_KEY = '__slicrParseTraceState';

function getParseTraceState(): ParseTraceState {
  const carrier = globalThis as typeof globalThis & { [PARSE_TRACE_KEY]?: ParseTraceState };
  if (!carrier[PARSE_TRACE_KEY]) {
    carrier[PARSE_TRACE_KEY] = {
      total: 0,
      byCaller: new Map<string, number>()
    };
  }
  return carrier[PARSE_TRACE_KEY];
}

function getParseCaller(): string {
  const stack = new Error().stack;
  if (!stack) {
    return 'unknown';
  }
  const lines = stack.split('\n').map((line) => line.trim());
  const callerLine = lines.find((line) => (
    !line.includes('parseDsl') &&
    (line.includes('/src/') || line.includes('src/'))
  ));
  return callerLine ?? 'unknown';
}

export function parseDsl(src: string): Parsed {
  const tree = parser.parse(src);
  const lines = src.split('\n');
  const lineStarts = buildLineStarts(lines);
  const scenarioNodeLines = collectScenarioNodeLines(lines);
  const boundaryLines = collectBoundaryLines(lines);
  const usesBodyLines = collectUsesBodyLines(lines);
  const mappingsByRef = parseUsesBlocks(src);

  const nodes = new Map<string, VisualNode>();
  const edges: Edge[] = [];
  const warnings: ParseWarning[] = [];
  const boundaries: SliceBoundary[] = [];
  let sliceName = '';
  const specs: NodeSpec[] = [];
  const edgeClauses: EdgeClauseSpec[] = [];
  const streamClauses: StreamClauseSpec[] = [];

  const cursor: ParseCursor = tree.cursor();
  do {
    if (cursorTypeId(cursor) === terms.SliceStatement) {
      cursor.firstChild(); // Move to kw<"slice">
      const movedToSliceName = cursor.nextSibling();
      if (movedToSliceName && cursorTypeId(cursor) === terms.String) {
        const raw = src.slice(cursor.from, cursor.to);
        sliceName = raw.slice(1, -1); // Remove quotes
      }
      cursor.parent();
      continue;
    }

    if (cursorTypeId(cursor) === terms.NodeStatement) {
      // Ensure the node is at the start of a line (no leading whitespace in DSL for top-level nodes)
      const lineIndex = getLineIndexAtPos(lineStarts, cursor.from);
      const lineStart = lineStarts[lineIndex];
      const prefix = src.slice(lineStart, cursor.from);
      if (prefix.length > 0 && !scenarioNodeLines.has(lineIndex)) {
        continue;
      }

      const parsed = parseNodeStatement(cursor, src);
      if (!parsed) {
        continue;
      }

      specs.push({
        line: lineIndex,
        type: parsed.target.type,
        name: parsed.target.name,
        isScenario: scenarioNodeLines.has(lineIndex),
        alias: parsed.alias,
        stream: null,
        incoming: parsed.incoming,
        outgoing: parsed.outgoing,
        data: null,
        srcRange: { from: cursor.from, to: cursor.to }
      });
      continue;
    }

    if (cursorTypeId(cursor) === terms.EdgeStatement) {
      const parsed = parseEdgeStatement(cursor, src);
      if (!parsed) {
        continue;
      }

      const lineIndex = getLineIndexAtPos(lineStarts, cursor.from);
      if (usesBodyLines.has(lineIndex)) {
        continue;
      }
      edgeClauses.push({
        line: lineIndex,
        incoming: parsed.incoming,
        outgoing: parsed.outgoing,
        from: cursor.from,
        to: cursor.to
      });
      continue;
    }

    if (cursorTypeId(cursor) === terms.StreamStatement) {
      const parsed = parseStreamStatement(cursor, src);
      if (!parsed) {
        continue;
      }

      const lineIndex = getLineIndexAtPos(lineStarts, cursor.from);
      streamClauses.push({ line: lineIndex, stream: parsed.stream });
    }
  } while (cursor.next());

  // Recover scenario lines that the parser surfaces as plain Identifier nodes.
  const parsedNodeLines = new Set(specs.map((spec) => spec.line));
  for (const lineIndex of [...scenarioNodeLines].sort((a, b) => a - b)) {
    if (parsedNodeLines.has(lineIndex)) {
      continue;
    }
    const recovered = parseScenarioNodeSpecFromLine(lines[lineIndex], lineIndex, lineStarts);
    if (recovered) {
      specs.push(recovered);
      parsedNodeLines.add(lineIndex);
    }
  }

  specs.sort((left, right) => left.line - right.line || left.srcRange.from - right.srcRange.from);

  attachStandaloneEdgeClauses(specs, edgeClauses);
  attachStandaloneStreamClauses(specs, streamClauses);

  attachDataBlocks(lines, specs, lineStarts);

  const refToKey = new Map<string, string>();
  const usedKeys = new Set<string>();
  const scenarioKeyByLine = new Map<number, string>();
  const unresolvedEdges: Array<{ fromRef: string; toRef: string; range: { from: number; to: number } }> = [];
  const unresolvedEdgeSet = new Set<string>();
  const nodeOriginByKey = new Map<string, { topLevel: boolean; scenario: boolean }>();

  for (const spec of specs) {
    const ref = toRefId(spec.type, spec.name);
    let key: string;
    if (spec.isScenario) {
      key = pickScenarioNodeKey(spec, usedKeys);
      usedKeys.add(key);
      scenarioKeyByLine.set(spec.line, key);
    } else {
      const existing = refToKey.get(ref);
      if (existing) {
        key = existing;
      } else {
        key = pickNodeKey(spec, usedKeys);
        refToKey.set(ref, key);
        usedKeys.add(key);
      }
    }
    const origin = nodeOriginByKey.get(key) ?? { topLevel: false, scenario: false };
    if (spec.isScenario) {
      origin.scenario = true;
    } else {
      origin.topLevel = true;
    }
    nodeOriginByKey.set(key, origin);

    const finalRange = spec.dataEndPos
      ? { from: spec.srcRange.from, to: spec.dataEndPos }
      : spec.srcRange;

    if (!nodes.has(key)) {
      nodes.set(key, {
        type: spec.type,
        name: spec.name,
        alias: spec.alias,
        stream: spec.stream,
        key,
        data: spec.data,
        srcRange: finalRange,
        dataKeyRanges: spec.dataKeyRanges
      });
    } else if (spec.data || spec.alias || spec.stream) {
      const existing = nodes.get(key);
      if (existing) {
        if (!existing.alias && spec.alias) {
          existing.alias = spec.alias;
        }
        if (!existing.stream && spec.stream) {
          existing.stream = spec.stream;
        }
        if (spec.data) {
          existing.data = spec.data;
          existing.srcRange = finalRange;
          existing.dataKeyRanges = spec.dataKeyRanges;
        }
      }
    }

    for (const from of spec.incoming) {
      const fromRef = toRefId(from.type, from.name);
      const edgeKey = `${fromRef}->${ref}`;
      if (unresolvedEdgeSet.has(edgeKey)) {
        continue;
      }
      unresolvedEdgeSet.add(edgeKey);
      unresolvedEdges.push({ fromRef, toRef: ref, range: from.range });
    }

    for (const to of spec.outgoing) {
      const toRef = toRefId(to.type, to.name);
      const edgeKey = `${ref}->${toRef}`;
      if (unresolvedEdgeSet.has(edgeKey)) {
        continue;
      }
      unresolvedEdgeSet.add(edgeKey);
      unresolvedEdges.push({ fromRef: ref, toRef, range: to.range });
    }
  }

  for (const edge of unresolvedEdges) {
    const from = refToKey.get(edge.fromRef);
    const to = refToKey.get(edge.toRef);
    if (from && to) {
      edges.push({ from, to, label: null });
    } else if (shouldWarnUnresolvedDependency(edge.fromRef, edge.toRef)) {
      const unknownRef = !from ? edge.fromRef : edge.toRef;
      warnings.push({
        message: `Unresolved dependency: ${formatUnknownRefName(unknownRef)}`,
        range: edge.range,
        level: 'error'
      });
    }
  }

  warnings.push(...applyMappingsToNodes({ nodes, edges, mappingsByRef, targetNodeKeyByRef: refToKey }));
  applyOutboundMappedKeys({ nodes, edges, mappingsByRef });
  warnings.push(...validateDataIntegrity({ nodes, edges }));
  warnings.push(...collectScenarioWhenCardinalityWarnings(lines, lineStarts));
  const scenarios = collectParsedScenarios(lines, lineStarts, scenarioKeyByLine);
  const scenarioOnlyNodeKeys = [...nodeOriginByKey.entries()]
    .filter(([, origin]) => origin.scenario && !origin.topLevel)
    .map(([key]) => key);
  boundaries.push(...resolveBoundaries(specs, boundaryLines, refToKey));

  const trace = getParseTraceState();
  const caller = getParseCaller();
  trace.total += 1;
  const callerCount = (trace.byCaller.get(caller) ?? 0) + 1;
  trace.byCaller.set(caller, callerCount);

  console.log(
    `[parseDsl] parsed slice: ${sliceName || '(unnamed)'} | callerCount=${callerCount} | total=${trace.total} | caller=${caller}`
  );
  return { sliceName, nodes, edges, warnings, boundaries, scenarios, scenarioOnlyNodeKeys };
}

function collectScenarioWhenCardinalityWarnings(lines: string[], lineStarts: number[]): ParseWarning[] {
  type ScenarioState = {
    name: string;
    whenCount: number;
    scenarioRange: { from: number; to: number };
    extraWhenRange: { from: number; to: number } | null;
    activeSection: 'given' | 'when' | 'then' | null;
  };

  const warnings: ParseWarning[] = [];
  let scenario: ScenarioState | null = null;

  const pushWarning = (current: ScenarioState | null) => {
    if (!current || current.whenCount === 1) {
      return;
    }

    warnings.push({
      message: `Scenario "${current.name}" must contain exactly one when node, found ${current.whenCount}.`,
      range: current.whenCount > 1 && current.extraWhenRange ? current.extraWhenRange : current.scenarioRange,
      level: 'error'
    });
  };

  const startScenario = (line: string, lineIndex: number, rawName: string): ScenarioState => {
    const token = `scenario ${rawName}`;
    const from = lineStarts[lineIndex] + line.indexOf(token);
    return {
      name: unquote(rawName),
      whenCount: 0,
      scenarioRange: { from, to: from + token.length },
      extraWhenRange: null,
      activeSection: null
    };
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const indent = (line.match(/^(\s*)/)?.[1] ?? '').length;
    if (indent === 0) {
      const scenarioMatch = trimmed.match(/^scenario\s+("(?:[^"\\]|\\.)*")\s*$/);
      if (scenarioMatch) {
        pushWarning(scenario);
        scenario = startScenario(line, lineIndex, scenarioMatch[1]);
        continue;
      }

      if (scenario && (trimmed === 'given:' || trimmed === 'when:' || trimmed === 'then:')) {
        scenario.activeSection = trimmed.slice(0, -1) as 'given' | 'when' | 'then';
        continue;
      }

      pushWarning(scenario);
      scenario = null;
      continue;
    }

    if (scenario && scenario.activeSection === 'when' && isScenarioNodeLine(trimmed)) {
      scenario.whenCount += 1;
      if (scenario.whenCount > 1 && !scenario.extraWhenRange) {
        const from = lineStarts[lineIndex] + line.indexOf(trimmed);
        scenario.extraWhenRange = { from, to: from + trimmed.length };
      }
    }
  }

  pushWarning(scenario);
  return warnings;
}

function collectScenarioNodeLines(lines: string[]) {
  const scenarioNodeLines = new Set<number>();
  let inScenario = false;
  let activeSection: 'given' | 'when' | 'then' | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const indent = (line.match(/^(\s*)/)?.[1] ?? '').length;
    if (indent === 0) {
      if (/^scenario\s+"/.test(trimmed)) {
        inScenario = true;
        activeSection = null;
        continue;
      }
      if (inScenario && (trimmed === 'given:' || trimmed === 'when:' || trimmed === 'then:')) {
        activeSection = trimmed.slice(0, -1) as 'given' | 'when' | 'then';
        continue;
      }

      inScenario = false;
      activeSection = null;
      continue;
    }

    if (!inScenario || !activeSection) {
      continue;
    }

    if (isScenarioNodeLine(trimmed)) {
      scenarioNodeLines.add(lineIndex);
    }
  }

  return scenarioNodeLines;
}

function collectParsedScenarios(
  lines: string[],
  lineStarts: number[],
  scenarioKeyByLine: Map<number, string>
): ParsedScenario[] {
  type ScenarioSection = 'given' | 'when' | 'then';
  type ScenarioState = {
    scenario: ParsedScenario;
    activeSection: ScenarioSection | null;
  };

  const scenarios: ParsedScenario[] = [];
  let state: ScenarioState | null = null;

  const pushCurrentScenario = () => {
    if (!state) {
      return;
    }
    scenarios.push(state.scenario);
    state = null;
  };

  const buildScenarioEntry = (line: string, lineIndex: number): ParsedScenarioEntry | null => {
    const trimmed = line.trim();
    const parsed = parseScenarioNodeLineInfo(trimmed);
    if (!parsed) {
      return null;
    }

    const from = lineStarts[lineIndex] + line.indexOf(trimmed);
    return {
      key: scenarioKeyByLine.get(lineIndex) ?? fallbackScenarioKey(lineIndex, parsed.type, parsed.name),
      type: parsed.type,
      name: parsed.name,
      alias: parsed.alias,
      srcRange: { from, to: from + trimmed.length }
    };
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const indent = (line.match(/^(\s*)/)?.[1] ?? '').length;
    if (indent === 0) {
      const scenarioMatch = trimmed.match(/^scenario\s+("(?:[^"\\]|\\.)*")\s*$/);
      if (scenarioMatch) {
        pushCurrentScenario();
        const token = `scenario ${scenarioMatch[1]}`;
        const from = lineStarts[lineIndex] + line.indexOf(token);
        state = {
          scenario: {
            name: unquote(scenarioMatch[1]),
            srcRange: { from, to: from + token.length },
            given: [],
            when: null,
            then: []
          },
          activeSection: null
        };
        continue;
      }

      if (state && (trimmed === 'given:' || trimmed === 'when:' || trimmed === 'then:')) {
        state.activeSection = trimmed.slice(0, -1) as ScenarioSection;
        continue;
      }

      pushCurrentScenario();
      continue;
    }

    if (!state || !state.activeSection || !isScenarioNodeLine(trimmed)) {
      continue;
    }
    const entry = buildScenarioEntry(line, lineIndex);
    if (!entry) {
      continue;
    }

    if (state.activeSection === 'given') {
      state.scenario.given.push(entry);
      continue;
    }
    if (state.activeSection === 'then') {
      state.scenario.then.push(entry);
      continue;
    }
    if (!state.scenario.when) {
      state.scenario.when = entry;
    }
  }

  pushCurrentScenario();
  return scenarios;
}

function isScenarioNodeLine(trimmed: string) {
  return parseScenarioNodeLineInfo(trimmed) !== null;
}

function parseScenarioNodeSpecFromLine(line: string, lineIndex: number, lineStarts: number[]): NodeSpec | null {
  const trimmed = line.trim();
  const parsed = parseScenarioNodeLineInfo(trimmed);
  if (!parsed) {
    return null;
  }

  const from = lineStarts[lineIndex] + line.indexOf(trimmed);
  const to = from + trimmed.length;
  return {
    line: lineIndex,
    type: parsed.type,
    name: parsed.name,
    isScenario: true,
    alias: parsed.alias,
    stream: null,
    incoming: [],
    outgoing: [],
    data: null,
    srcRange: { from, to }
  };
}

function parseScenarioNodeLineInfo(trimmed: string): { type: string; name: string; alias: string | null } | null {
  const prefixed = trimmed.match(SCENARIO_PREFIXED_NODE_RE);
  if (prefixed) {
    return {
      type: prefixed[1],
      name: prefixed[2],
      alias: prefixed[3] ? unquote(prefixed[3]) : null
    };
  }

  const generic = trimmed.match(SCENARIO_GENERIC_NODE_RE);
  if (generic) {
    return {
      type: 'generic',
      name: generic[1],
      alias: generic[2] ? unquote(generic[2]) : null
    };
  }

  return null;
}

function collectBoundaryLines(lines: string[]) {
  const boundaryLines: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      boundaryLines.push(i);
    }
  }
  return boundaryLines;
}

function collectUsesBodyLines(lines: string[]) {
  const mapLines = new Set<number>();
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!(line.trim().startsWith('uses:') || line.trim().startsWith('maps:'))) {
      continue;
    }

    const mapsIndent = (line.match(/^(\s*)/)?.[1] ?? '').length;
    for (let next = lineIndex + 1; next < lines.length; next += 1) {
      const nextLine = lines[next];
      if (!nextLine.trim()) {
        continue;
      }
      const nextIndent = (nextLine.match(/^(\s*)/)?.[1] ?? '').length;
      if (nextIndent <= mapsIndent) {
        break;
      }
      mapLines.add(next);
    }
  }
  return mapLines;
}

function resolveBoundaries(specs: NodeSpec[], boundaryLines: number[], refToKey: Map<string, string>): SliceBoundary[] {
  if (specs.length === 0 || boundaryLines.length === 0) {
    return [];
  }

  const boundaries: SliceBoundary[] = [];
  let specIndex = 0;
  let lastSpec: NodeSpec | null = null;

  for (const boundaryLine of boundaryLines) {
    while (specIndex < specs.length && specs[specIndex].line < boundaryLine) {
      lastSpec = specs[specIndex];
      specIndex += 1;
    }

    if (!lastSpec) {
      continue;
    }

    const key = refToKey.get(toRefId(lastSpec.type, lastSpec.name));
    if (!key) {
      continue;
    }
    if (boundaries.length > 0 && boundaries[boundaries.length - 1].after === key) {
      continue;
    }
    boundaries.push({ after: key });
  }

  return boundaries;
}

function parseNodeStatement(cursor: ParseCursor, src: string) {
  if (!cursor.firstChild()) {
    return null;
  }

  let target: ArtifactRef | null = null;
  let alias: string | null = null;
  do {
    const typeId = cursorTypeId(cursor);
    if (isArtifactRefType(typeId) && !target) {
      target = parseArtifactRef(cursor, src);
      continue;
    }
    if (typeId === terms.String && alias === null) {
      alias = unquote(src.slice(cursor.from, cursor.to));
    }
  } while (cursor.nextSibling());

  if (!target) {
    cursor.parent();
    return null;
  }

  const incoming: ArtifactRef[] = [];
  const outgoing: ArtifactRef[] = [];

  cursor.parent();
  return { target, alias, incoming, outgoing };
}

function parseEdgeStatement(cursor: ParseCursor, src: string) {
  if (!cursor.firstChild()) {
    return null;
  }

  const incoming: ArtifactRef[] = [];
  const outgoing: ArtifactRef[] = [];
  if (cursorTypeId(cursor) === terms.IncomingClause) {
    incoming.push(...parseClauseRefs(cursor, src));
  } else if (cursorTypeId(cursor) === terms.OutgoingClause) {
    outgoing.push(...parseClauseRefs(cursor, src));
  }
  cursor.parent();
  return { incoming, outgoing };
}

function parseStreamStatement(cursor: ParseCursor, src: string) {
  if (!cursor.firstChild()) {
    return null;
  }

  let stream: string | null = null;
  do {
    const tid = cursorTypeId(cursor);
    if (tid === terms.String) {
      stream = unquote(src.slice(cursor.from, cursor.to));
      break;
    }
    if (tid === terms.Identifier) {
      stream = src.slice(cursor.from, cursor.to);
      break;
    }
  } while (cursor.nextSibling());

  cursor.parent();
  if (!stream) {
    return null;
  }

  return { stream };
}

function parseClauseRefs(cursor: ParseCursor, src: string): ArtifactRef[] {
  const refs: ArtifactRef[] = [];
  cursor.firstChild(); // Arrow token
  while (cursor.nextSibling()) {
    if (!isArtifactRefType(cursorTypeId(cursor))) {
      continue;
    }
    const ref = parseArtifactRef(cursor, src);
    if (ref) {
      refs.push(ref);
    }
  }
  cursor.parent();
  return refs;
}

function attachStandaloneEdgeClauses(specs: NodeSpec[], edgeClauses: EdgeClauseSpec[]) {
  if (specs.length === 0 || edgeClauses.length === 0) {
    return;
  }

  let specIndex = 0;
  for (const clause of edgeClauses) {
    while (specIndex + 1 < specs.length && specs[specIndex + 1].line <= clause.line) {
      specIndex += 1;
    }

    if (specs[specIndex].line > clause.line) {
      continue;
    }

    const owner = specs[specIndex];
    owner.incoming.push(...clause.incoming);
    owner.outgoing.push(...clause.outgoing);
    if (owner.line === clause.line) {
      owner.srcRange.to = Math.max(owner.srcRange.to, clause.to);
    }
  }
}

function attachStandaloneStreamClauses(specs: NodeSpec[], streamClauses: StreamClauseSpec[]) {
  if (specs.length === 0 || streamClauses.length === 0) {
    return;
  }

  let specIndex = 0;
  for (const clause of streamClauses) {
    while (specIndex + 1 < specs.length && specs[specIndex + 1].line <= clause.line) {
      specIndex += 1;
    }

    if (specs[specIndex].line > clause.line) {
      continue;
    }

    const owner = specs[specIndex];
    if (owner.type === 'evt') {
      owner.stream = clause.stream;
    }
  }
}

function parseArtifactRef(cursor: ParseCursor, src: string): ArtifactRef | null {
  const startTypeId = cursorTypeId(cursor);
  const isDirectRef =
    startTypeId === terms.RmRef ||
    startTypeId === terms.UiRef ||
    startTypeId === terms.CmdRef ||
    startTypeId === terms.EvtRef ||
    startTypeId === terms.ExcRef ||
    startTypeId === terms.AutRef ||
    startTypeId === terms.ExtRef ||
    startTypeId === terms.GenericRef;
  if (startTypeId !== terms.ArtifactRef && !isDirectRef) {
    return null;
  }
  const range = { from: cursor.from, to: cursor.to };

  let typeId = startTypeId;
  const hasWrapper = startTypeId === terms.ArtifactRef;
  if (hasWrapper) {
    cursor.firstChild(); // Move to specific ref (RmRef, UiRef, etc.)
    typeId = cursorTypeId(cursor);
  }

  let type = '';
  if (typeId === terms.RmRef) type = 'rm';
  else if (typeId === terms.UiRef) type = 'ui';
  else if (typeId === terms.CmdRef) type = 'cmd';
  else if (typeId === terms.EvtRef) type = 'evt';
  else if (typeId === terms.ExcRef) type = 'exc';
  else if (typeId === terms.AutRef) type = 'aut';
  else if (typeId === terms.ExtRef) type = 'ext';
  else if (typeId === terms.GenericRef) type = 'generic';

  if (!type) {
    if (hasWrapper) {
      cursor.parent();
    }
    return null;
  }

  let name = '';
  let version = '';

  // Traverse children of the specific ref to find Name and Version
  cursor.firstChild();
  do {
    const tid = cursorTypeId(cursor);
    if (
      tid === terms.RmName ||
      tid === terms.UiName ||
      tid === terms.CmdName ||
      tid === terms.EvtName ||
      (typeId === terms.GenericRef && tid === terms.Identifier && name === '')
    ) {
      name = src.slice(cursor.from, cursor.to);
    } else if (tid === terms.Identifier && name === '') {
      // For ExcRef, AutRef, ExtRef which use Identifier directly in grammar
      name = src.slice(cursor.from, cursor.to);
    } else if (tid === terms.Version) {
      version = src.slice(cursor.from, cursor.to);
    }
  } while (cursor.nextSibling());

  cursor.parent(); // Back to specific ref
  if (hasWrapper) {
    cursor.parent(); // Back to ArtifactRef
  }

  return { type, name: name + version, range };
}

function isArtifactRefType(typeId: number) {
  return (
    typeId === terms.ArtifactRef ||
    typeId === terms.RmRef ||
    typeId === terms.UiRef ||
    typeId === terms.CmdRef ||
    typeId === terms.EvtRef ||
    typeId === terms.ExcRef ||
    typeId === terms.AutRef ||
    typeId === terms.ExtRef ||
    typeId === terms.GenericRef
  );
}

function toRefId(type: string, name: string) {
  return `${type}:${name}`;
}

function unquote(value: string) {
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function cursorTypeId(cursor: ParseCursor) {
  return cursor.type.id;
}

function shouldWarnUnresolvedDependency(fromRef: string, toRef: string) {
  const fromType = fromRef.split(':', 1)[0];
  const toType = toRef.split(':', 1)[0];

  // Commands can originate outside the slice and trigger an event entrypoint.
  return !(fromType === 'cmd' && toType === 'evt');


}

function formatUnknownRefName(ref: string) {
  const separatorIndex = ref.indexOf(':');
  return separatorIndex === -1 ? ref : ref.slice(separatorIndex + 1);
}

function pickNodeKey(spec: NodeSpec, usedKeys: Set<string>) {
  if (!usedKeys.has(spec.name)) {
    return spec.name;
  }

  const typed = `${spec.type}:${spec.name}`;
  if (!usedKeys.has(typed)) {
    return typed;
  }

  let suffix = 2;
  while (usedKeys.has(`${typed}#${suffix}`)) {
    suffix += 1;
  }
  return `${typed}#${suffix}`;
}

function pickScenarioNodeKey(spec: NodeSpec, usedKeys: Set<string>) {
  const base = fallbackScenarioKey(spec.line, spec.type, spec.name);
  if (!usedKeys.has(base)) {
    return base;
  }

  let suffix = 2;
  while (usedKeys.has(`${base}#${suffix}`)) {
    suffix += 1;
  }
  return `${base}#${suffix}`;
}

function fallbackScenarioKey(line: number, type: string, name: string) {
  return `scn:${line + 1}:${type}:${name}`;
}

function buildLineStarts(lines: string[]) {
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  return starts;
}

function getLineIndexAtPos(lineStarts: number[], pos: number) {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const start = lineStarts[mid];
    const nextStart = mid + 1 < lineStarts.length ? lineStarts[mid + 1] : Number.POSITIVE_INFINITY;
    if (pos >= start && pos < nextStart) {
      return mid;
    }
    if (pos < start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return Math.max(0, lineStarts.length - 1);
}

function attachDataBlocks(lines: string[], specs: NodeSpec[], lineStarts: number[]) {
  let specCursor = 0;
  let lastSpecIndex: number | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    while (specCursor < specs.length && specs[specCursor].line <= lineIndex) {
      lastSpecIndex = specCursor;
      specCursor += 1;
    }

    const line = lines[lineIndex];
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:') || lastSpecIndex === null) {
      continue;
    }

    const dataIndent = (line.match(/^(\s*)/)?.[1] ?? '').length;
    const inlineRaw = trimmed.slice('data:'.length).trim();
    if (inlineRaw) {
      try {
        specs[lastSpecIndex].data = JSON.parse(inlineRaw) as Record<string, unknown>;
        specs[lastSpecIndex].dataEndPos = lineStarts[lineIndex] + line.length;
      } catch {
        // Keep parity with previous behavior: ignore malformed data blocks.
      }
      continue;
    }

    const blockLines: string[] = [];
    let lastNonEmptyNext = lineIndex;
    for (let next = lineIndex + 1; next < lines.length; next += 1) {
      const nextLine = lines[next];
      if (!nextLine.trim()) {
        blockLines.push(nextLine);
        continue;
      }

      const nextIndent = (nextLine.match(/^(\s*)/)?.[1] ?? '').length;
      if (nextIndent <= dataIndent) {
        break;
      }

      blockLines.push(nextLine);
      lastNonEmptyNext = next;
    }

    const parsedYaml = parseYamlBlock(blockLines);
    if (parsedYaml) {
      specs[lastSpecIndex].data = parsedYaml;
      specs[lastSpecIndex].dataKeyRanges = collectTopLevelYamlKeyRanges({
        lines,
        lineStarts,
        blockLineIndices: collectLineIndices(lineIndex + 1, lastNonEmptyNext)
      });
      specs[lastSpecIndex].dataEndPos = lineStarts[lastNonEmptyNext] + lines[lastNonEmptyNext].length;
    }
  }
}

function collectLineIndices(from: number, to: number): number[] {
  const result: number[] = [];
  for (let index = from; index <= to; index += 1) {
    result.push(index);
  }
  return result;
}

function collectTopLevelYamlKeyRanges(input: {
  lines: string[];
  lineStarts: number[];
  blockLineIndices: number[];
}): Record<string, { from: number; to: number }> | undefined {
  const entries = input.blockLineIndices
    .map((lineIndex) => {
      const line = input.lines[lineIndex];
      return {
        lineIndex,
        line,
        trimmed: line.trim(),
        indent: (line.match(/^(\s*)/)?.[1] ?? '').length
      };
    })
    .filter((entry) => entry.trimmed.length > 0);

  if (entries.length === 0) {
    return undefined;
  }

  const baseIndent = Math.min(...entries.map((entry) => entry.indent));
  const keyRanges: Record<string, { from: number; to: number }> = {};

  for (const entry of entries) {
    if (entry.indent !== baseIndent || entry.trimmed.startsWith('- ')) {
      continue;
    }

    const match = entry.trimmed.match(/^([^:]+):(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1].trim();
    if (!key) {
      continue;
    }

    const trimmedOffset = entry.line.length - entry.trimmed.length;
    const keyOffset = entry.trimmed.indexOf(match[1]);
    const from = input.lineStarts[entry.lineIndex] + trimmedOffset + Math.max(0, keyOffset);
    keyRanges[key] = { from, to: from + key.length };
  }

  return Object.keys(keyRanges).length > 0 ? keyRanges : undefined;
}

function parseYamlBlock(lines: string[]) {
  const entries = lines
    .map((line) => ({
      indent: (line.match(/^(\s*)/)?.[1] ?? '').length,
      text: line.trim()
    }))
    .filter((entry) => entry.text.length > 0);

  if (entries.length === 0) {
    return null;
  }

  const baseIndent = Math.min(...entries.map((entry) => entry.indent));
  const normalized = entries.map((entry) => ({
    indent: entry.indent - baseIndent,
    text: entry.text
  }));

  let index = 0;
  const value = parseYamlNode(normalized, () => index, (next) => {
    index = next;
  }, normalized[0].indent);

  if (value === undefined || index !== normalized.length) {
    return null;
  }

  return isRecord(value) ? value : null;
}

function parseYamlNode(
  entries: YamlEntry[],
  getIndex: () => number,
  setIndex: (index: number) => void,
  indent: number
): unknown {
  const index = getIndex();
  if (index >= entries.length || entries[index].indent !== indent) {
    return undefined;
  }

  if (entries[index].text.startsWith('- ')) {
    return parseYamlArray(entries, getIndex, setIndex, indent);
  }

  return parseYamlObject(entries, getIndex, setIndex, indent);
}

function parseYamlArray(
  entries: YamlEntry[],
  getIndex: () => number,
  setIndex: (index: number) => void,
  indent: number
) {
  const values: unknown[] = [];

  while (getIndex() < entries.length) {
    const current = entries[getIndex()];
    if (current.indent !== indent || !current.text.startsWith('- ')) {
      break;
    }

    const itemText = current.text.slice(2).trim();
    setIndex(getIndex() + 1);

    if (!itemText) {
      const next = entries[getIndex()];
      if (!next || next.indent <= indent) {
        values.push(null);
      } else {
        values.push(parseYamlNode(entries, getIndex, setIndex, next.indent) ?? null);
      }
      continue;
    }

    const inlineObject = parseInlineYamlProperty(itemText);
    if (inlineObject) {
      const objectValue: Record<string, unknown> = {};
      objectValue[inlineObject.key] = inlineObject.value;

      while (getIndex() < entries.length) {
        const next = entries[getIndex()];
        if (next.indent <= indent || next.text.startsWith('- ')) {
          break;
        }

        const nested = parseObjectProperty(entries, getIndex, setIndex, next.indent);
        if (!nested) {
          return undefined;
        }
        objectValue[nested.key] = nested.value;
      }

      values.push(objectValue);
      continue;
    }

    values.push(parseYamlScalar(itemText));
  }

  return values;
}

function parseYamlObject(
  entries: YamlEntry[],
  getIndex: () => number,
  setIndex: (index: number) => void,
  indent: number
) {
  const value: Record<string, unknown> = {};

  while (getIndex() < entries.length) {
    const current = entries[getIndex()];
    if (current.indent !== indent || current.text.startsWith('- ')) {
      break;
    }

    const property = parseObjectProperty(entries, getIndex, setIndex, indent);
    if (!property) {
      return undefined;
    }

    value[property.key] = property.value;
  }

  return value;
}

function parseObjectProperty(
  entries: YamlEntry[],
  getIndex: () => number,
  setIndex: (index: number) => void,
  indent: number
) {
  const entry = entries[getIndex()];
  if (!entry || entry.indent !== indent || entry.text.startsWith('- ')) {
    return null;
  }

  const parsed = parseInlineYamlProperty(entry.text);
  if (!parsed) {
    return null;
  }

  setIndex(getIndex() + 1);
  if (parsed.fromInline) {
    return { key: parsed.key, value: parsed.value };
  }

  const next = entries[getIndex()];
  if (!next || next.indent <= indent) {
    return { key: parsed.key, value: null };
  }

  return {
    key: parsed.key,
    value: parseYamlNode(entries, getIndex, setIndex, next.indent) ?? null
  };
}

function parseInlineYamlProperty(text: string) {
  const match = text.match(/^([^:]+):(.*)$/);
  if (!match) {
    return null;
  }

  const key = match[1].trim();
  const rest = match[2].trim();
  if (!key) {
    return null;
  }

  if (rest.length === 0) {
    return { key, value: null, fromInline: false };
  }

  return { key, value: parseYamlScalar(rest), fromInline: true };
}

function applyOutboundMappedKeys(input: {
  nodes: Map<string, VisualNode>;
  edges: Edge[];
  mappingsByRef: Map<string, MappingEntry[]>;
}) {
  const nodeByRef = new Map<string, VisualNode>();
  for (const node of input.nodes.values()) {
    nodeByRef.set(toRefId(node.type, node.name), node);
  }

  for (const [targetRef, mappings] of input.mappingsByRef.entries()) {
    const targetNode = nodeByRef.get(targetRef);
    if (!targetNode || mappings.length === 0) {
      continue;
    }

    for (const mapping of mappings) {
      const sourceNode = resolveMappedSourceNode(input.nodes, input.edges, targetNode.key, mapping.sourcePath);
      if (!sourceNode || sourceNode.type !== 'ui') {
        continue;
      }

      const rootKey = rootKeyForSourcePath(mapping.sourcePath);
      if (!rootKey) {
        continue;
      }

      if (!sourceNode.outboundMappedDataKeys) {
        sourceNode.outboundMappedDataKeys = new Set<string>();
      }
      sourceNode.outboundMappedDataKeys.add(rootKey);
    }
  }
}

function resolveMappedSourceNode(
  nodes: Map<string, VisualNode>,
  edges: Edge[],
  targetNodeKey: string,
  sourcePath: string
): VisualNode | null {
  const predecessorKeys = edges.filter((edge) => edge.to === targetNodeKey).map((edge) => edge.from);
  for (const predecessorKey of predecessorKeys) {
    const predecessor = nodes.get(predecessorKey);
    if (!predecessor || !isRecord(predecessor.data)) {
      continue;
    }
    if (resolvePathValue(predecessor.data, sourcePath) !== undefined) {
      return predecessor;
    }
  }
  return null;
}

function resolvePathValue(data: Record<string, unknown>, path: string): unknown {
  if (path.startsWith('$')) {
    try {
      const values = JSONPath({
        path,
        json: data,
        wrap: true
      });
      return Array.isArray(values) && values.length > 0 ? values[0] : undefined;
    } catch {
      return undefined;
    }
  }
  return getPathValue(data, path);
}

function getPathValue(data: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.').filter(Boolean);
  let current: unknown = data;
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function rootKeyForSourcePath(sourcePath: string): string {
  if (sourcePath.startsWith('$')) {
    const match = sourcePath.match(/^\$\.(["']?)([a-zA-Z0-9_-]+)\1/);
    if (match) {
      return match[2];
    }
  }
  return sourcePath.split('.', 1)[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseYamlScalar(raw: string): unknown {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  if (raw === 'null') {
    return null;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    const quote = raw[0];
    if (quote === '"') {
      try {
        return JSON.parse(raw);
      } catch {
        return raw.slice(1, -1);
      }
    }
    return raw.slice(1, -1);
  }

  return raw;
}
