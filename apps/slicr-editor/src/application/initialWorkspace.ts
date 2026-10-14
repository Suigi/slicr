import {createCommandRouter} from './commandRouter';
import type {DcbSpecStore} from '../domain/eventSourcing';

export async function ensureInitialWorkspace(args: {store: DcbSpecStore; generateUuid?: () => string}) {
  const routeCommand = createCommandRouter({
    store: args.store,
    generateUuid: args.generateUuid,
  });

  await routeCommand({
    type: 'EnsureInitialWorkspace',
    data: {},
  });
}
