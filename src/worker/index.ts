import { createApiApp } from './api/app';
import type { Env } from './env';

const PREFIX = '/catandcobra';
const api = createApiApp();

/**
 * Fetch a path from the ASSETS binding and rewrite any absolute Location
 * headers so they keep the /catandcobra public prefix (Assets often redirects
 * `/admin` → `/admin/`, which would drop the site base path).
 */
async function fetchAsset(
  env: Env,
  request: Request,
  assetPath: string,
): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;

  let res = await env.ASSETS.fetch(new Request(url.toString(), request));

  // Follow internal redirects (trailing slash / index.html) inside the Worker
  // so the browser never leaves /catandcobra/*
  for (let hop = 0; hop < 4; hop++) {
    if (res.status < 300 || res.status >= 400) break;
    const loc = res.headers.get('Location');
    if (!loc) break;

    const next = new URL(loc, url);
    // Only follow same-origin asset redirects
    if (next.origin !== url.origin) break;

    let nextPath = next.pathname;
    // If a previous bad redirect already included the prefix, strip it for ASSETS
    if (nextPath.startsWith(`${PREFIX}/`)) {
      nextPath = nextPath.slice(PREFIX.length) || '/';
    } else if (nextPath === PREFIX) {
      nextPath = '/';
    }

    next.pathname = nextPath;
    res = await env.ASSETS.fetch(new Request(next.toString(), request));
  }

  // Rewrite remaining redirects for the browser
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('Location');
    if (loc) {
      const headers = new Headers(res.headers);
      headers.set('Location', withPrefix(loc, url.origin));
      return new Response(null, { status: res.status, headers });
    }
  }

  return res;
}

function withPrefix(location: string, origin: string): string {
  // Absolute URL
  if (location.startsWith('http://') || location.startsWith('https://')) {
    try {
      const u = new URL(location);
      if (u.origin === origin && !u.pathname.startsWith(`${PREFIX}/`) && u.pathname !== PREFIX) {
        u.pathname = `${PREFIX}${u.pathname.startsWith('/') ? u.pathname : `/${u.pathname}`}`;
        return u.toString();
      }
    } catch {
      /* keep original */
    }
    return location;
  }

  // Absolute path on this host
  if (location.startsWith('/')) {
    if (location === PREFIX || location.startsWith(`${PREFIX}/`)) return location;
    return `${PREFIX}${location}`;
  }

  return location;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Local convenience: /admin → /catandcobra/admin/
    if (url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname.startsWith('/admin/')) {
      url.pathname = `${PREFIX}${url.pathname}`;
      return Response.redirect(url.toString(), 302);
    }

    if (url.pathname === PREFIX) {
      url.pathname = `${PREFIX}/`;
      return Response.redirect(url.toString(), 308);
    }

    if (!url.pathname.startsWith(`${PREFIX}/`)) {
      return new Response('Not found', { status: 404 });
    }

    // Strip prefix so Hono sees /api/... and assets see /admin/...
    const stripped = url.pathname.slice(PREFIX.length) || '/';

    if (stripped === '/api' || stripped.startsWith('/api/')) {
      const innerUrl = new URL(request.url);
      innerUrl.pathname = stripped;
      return api.fetch(new Request(innerUrl.toString(), request), env, ctx);
    }

    // Admin SPA: always serve the shell HTML (no browser-visible redirects)
    if (stripped === '/admin' || stripped.startsWith('/admin')) {
      // Static files under admin (rare)
      if (stripped.includes('.') && !stripped.endsWith('.html')) {
        return fetchAsset(env, request, stripped);
      }
      const html = await fetchAsset(env, request, '/admin/index.html');
      if (html.status !== 404) return html;
      return fetchAsset(env, request, '/admin/');
    }

    // Directory index: /booking → try /booking/ and /booking/index.html
    if (!stripped.includes('.')) {
      const candidates = stripped.endsWith('/')
        ? [`${stripped}index.html`, stripped]
        : [`${stripped}/index.html`, `${stripped}/`, stripped];

      for (const path of candidates) {
        const res = await fetchAsset(env, request, path);
        if (res.status !== 404) return res;
      }
    }

    return fetchAsset(env, request, stripped);
  },
};
