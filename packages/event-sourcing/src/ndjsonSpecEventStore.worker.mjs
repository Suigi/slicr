import {NdjsonSpecEventStore} from './ndjsonSpecEventStore.ts';
import {Query} from './query.ts';

const [path, name] = process.argv.slice(2);
const store = NdjsonSpecEventStore.open(path);
process.stdout.write('ready\n');
process.stdin.once('data', async () => {
  try {
    const value = await store.append([{type: 'Changed', tags: ['same'], payload: {writer: name}}], {failIfEventsMatch: Query.all()});
    process.stdout.write(JSON.stringify({ok: true, value}) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ok: false, name: error.name, conflictingEvents: error.conflictingEvents}) + '\n');
  } finally {
    store.close();
  }
});
