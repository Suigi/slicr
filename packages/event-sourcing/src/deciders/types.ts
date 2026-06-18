import {Query} from '../query';

export type Decider<Command, Event, DecisionModel> = {
  query(command: Command): Query;
  project(events: readonly Event[]): DecisionModel;
  decide(command: Command, decisionModel: DecisionModel): readonly Event[];
};