import {createGraphApplication} from './createGraphApplication';
import type {GraphModelScope} from '../graph/eventSourcedGraphModel';

type GraphApplication = Awaited<ReturnType<typeof createGraphApplication>>;

let graphApplicationPromise: Promise<GraphApplication> | null = null;

export function loadGraphApplication(scope: GraphModelScope = {}) {
  graphApplicationPromise ??= createGraphApplication(scope);
  return graphApplicationPromise;
}
