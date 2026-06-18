export type DefaultRecord = Record<string, unknown>;

export type Command<
  Type extends string,
  Data extends DefaultRecord = DefaultRecord,
> = {
  type: Type;
  data: Data;
};

export type AnyCommand = Command<string, DefaultRecord>;

export type SomeCommand<Data extends DefaultRecord> = Command<string, Data>;

//
// export type CommandDefinition<C extends AnyCommand> = {
//   type: C['type'];
//   handle(command: C): void;
// };
