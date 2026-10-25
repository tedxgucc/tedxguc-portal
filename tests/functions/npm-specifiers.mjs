// Lets Node load the server functions' Deno-style "npm:name@version"
// imports in unit tests, by resolving them to the locally installed package.
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('npm:')) {
    const bare = specifier.slice(4).replace(/^(@?[^@]+)@[^/]+/, '$1');
    return next(bare, context);
  }
  return next(specifier, context);
}`));
