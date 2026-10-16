import {createGraphApplication} from './createGraphApplication';
import {createStandaloneProductionEditorPort} from './standaloneProductionEditorPort';
import type {GraphModelScope} from '../graph/eventSourcedGraphModel';

type GraphApplication = Awaited<ReturnType<typeof createGraphApplication>> & {
  editorPort: ReturnType<typeof createStandaloneProductionEditorPort>;
};

let graphApplicationPromise: Promise<GraphApplication> | null = null;
let ensureInitialWorkspaceOnNextLoad = true;

export function loadGraphApplication(scope: GraphModelScope = {}) {
  graphApplicationPromise ??= createGraphApplication(scope, {ensureInitialWorkspace: ensureInitialWorkspaceOnNextLoad}).then(
    (application) => ({
      ...application,
      editorPort: createStandaloneProductionEditorPort(application),
    }),
  );
  ensureInitialWorkspaceOnNextLoad = true;
  return graphApplicationPromise;
}

export function resetGraphApplication(options: {ensureInitialWorkspace?: boolean} = {}) {
  graphApplicationPromise = null;
  ensureInitialWorkspaceOnNextLoad = options.ensureInitialWorkspace !== false;
}
