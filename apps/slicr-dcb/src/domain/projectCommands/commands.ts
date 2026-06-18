import {Command} from '@slicr/event-sourcing';
import {ProjectId} from '../events';

export type AddProject = Command<
  'AddProject',
  { name: string }
>;

export type RenameProject = Command<
  'RenameProject',
  { projectId: ProjectId, name: string }
>;
