// Independent-process fixture for the SQLite spike test.
import {SqliteSpecEventStore} from './sqliteSpecEventStore.ts';
import {Query} from './query.ts';

const initializing = process.argv[4] === 'initialize';
const store = initializing ? undefined : SqliteSpecEventStore.open(process.argv[2]);
process.stdout.write('ready\n');
for await (const chunk of process.stdin) {
  if (chunk.length) break;
}
try {
  if (initializing) {
    SqliteSpecEventStore.initialize(process.argv[2]).close();
    process.stdout.write(JSON.stringify({ok: true}) + '\n');
  } else {
    const events = await store.append([{type: 'Changed', payload: {writer: process.argv[3]}, tags: ['same']}], {
      failIfEventsMatch: Query.where({tags: ['same']}),
    });
    process.stdout.write(JSON.stringify({ok: true, events}) + '\n');
  }
} catch (error) {
  process.stdout.write(
    JSON.stringify({ok: false, name: error.name, message: error.message, conflictingEvents: error.conflictingEvents}) + '\n',
  );
} finally {
  store?.close();
}
