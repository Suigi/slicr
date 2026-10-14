import {Command} from '../eventSourcing';
import {ProjectId} from '../events';

export type AddProject = Command<'AddProject', {name: string}>;

export type RenameProject = Command<'RenameProject', {projectId: ProjectId; name: string}>;

export type EnsureInitialWorkspace = Command<'EnsureInitialWorkspace', Record<string, never>>;
