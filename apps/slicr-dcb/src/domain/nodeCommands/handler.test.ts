import {v4 as uuid} from 'uuid';

import {describe, it} from 'vitest';
import {addNodeHandler, renameNodeHandler} from './handler';
import {Events} from '../events';
import {expectHandler} from '@slicr/event-sourcing/testing';

describe('commands project state', () => {
  it('adding Command node emits NodeAdded event', () => {
    const staticUuid = uuid();

    expectHandler(addNodeHandler(() => staticUuid))
      .given()
      .when({nodeType: 'cmd'})
      .thenEmits(Events.nodeAdded(staticUuid, 'cmd', 0));
  });

  it('renaming Node emits NodeRenamed event', () => {
    const nodeId = uuid();

    expectHandler(renameNodeHandler)
      .given(Events.nodeAdded(nodeId, 'evt', 0))
      .when({nodeId, newName: 'New Event Name'})
      .thenEmits(Events.nodeRenamed(nodeId, 'New Event Name'));
  });

  it('throws when renaming a Node that does not exist', () => {
    const nodeId = uuid();

    expectHandler(renameNodeHandler)
      .given()
      .when({nodeId, newName: 'New Event Name'})
      .thenThrows(new Error(`Unknown nodeId ${nodeId}`));
  });
});
