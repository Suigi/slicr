import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, resolve as resolvePath} from 'node:path';

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '../..');
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@slicr/event-sourcing')
    return {url: pathToFileURL(resolvePath(root, 'packages/event-sourcing/src/index.ts')).href, shortCircuit: true};
  if (specifier.startsWith('@slicr/event-sourcing/'))
    return {
      url: pathToFileURL(resolvePath(root, 'packages/event-sourcing/src', specifier.slice('@slicr/event-sourcing/'.length) + '.ts')).href,
      shortCircuit: true,
    };
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      try {
        return await nextResolve(`${specifier}.ts`, context);
      } catch {
        try {
          return await nextResolve(`${specifier}/index.ts`, context);
        } catch {}
      }
    }
    throw error;
  }
}
