import {createGraphApplication} from './createGraphApplication';
import type {GraphModelScope} from '../graph/eventSourcedGraphModel';

type GraphApplication = Awaited<ReturnType<typeof createGraphApplication>>;

let graphApplicationPromise: Promise<GraphApplication> | null = null;
let ensureInitialWorkspaceOnNextLoad = true;

export function loadGraphApplication(scope: GraphModelScope = {}) {
  graphApplicationPromise ??= createGraphApplication(scope, {ensureInitialWorkspace: ensureInitialWorkspaceOnNextLoad});
  ensureInitialWorkspaceOnNextLoad = true;
  return graphApplicationPromise;
}

export function resetGraphApplication(options: {ensureInitialWorkspace?: boolean} = {}) {
  graphApplicationPromise = null;
  ensureInitialWorkspaceOnNextLoad = options.ensureInitialWorkspace !== false;
}
