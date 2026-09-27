import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { redirectTo } from './http';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');

function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return routeFiles(path);
    }
    return name === 'route.ts' ? [path] : [];
  });
}

describe('redirectTo', () => {
  it('sends a relative Location', () => {
    const response = redirectTo('/dashboard');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('/dashboard');
  });

  it('keeps 303 for redirects after a POST', () => {
    expect(redirectTo('/', 303).status).toBe(303);
  });

  it('escapes what goes into the query string', () => {
    expect(redirectTo(`/?signin=${encodeURIComponent('a&b=c')}`).headers.get('location')).toBe(
      '/?signin=a%26b%3Dc',
    );
  });
});

describe('no route builds a same-site redirect from request.url', () => {
  /**
   * The regression this guards: `NextResponse.redirect(new URL('/x', request.url))`
   * reads correctly and is wrong behind a proxy. On Railway `request.url` carries
   * the internal origin, so sign-in sent streamers to https://localhost:3000/dashboard.
   * It passes every local test, because locally that origin is the right one.
   */
  const files = routeFiles(appRoot);

  it('finds the route files to check', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  for (const file of files) {
    it(file.slice(appRoot.length + 1), () => {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/NextResponse\.redirect\(\s*new URL\([^)]*request\.url/);
    });
  }
});
