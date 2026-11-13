import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { fileURLToPath } from 'node:url';
import { GET as catalogGet, HEAD as catalogHead } from '@/app/api/opds/proxy/route';
import { edgeSpeechResponse } from '@/libs/edgeSpeechResponse';
import { readerPath } from './path.js';
import { createBookBridge, type BookBridge } from './book-bridge.js';
import { readingHistoryConflict, type NovelSession } from './reading-history.js';
import { companionEndpoint } from './protocol.js';
import { readLimitedBody } from './request-body.js';

interface HostContext {
  agents: { get(id: string): { session: NovelSession } | undefined };
  provide(name: string, value: BookBridge): () => void;
  effect(activate: () => () => void): void;
  connection: {
    admit(req: IncomingMessage): { rejection: number } | { peer: unknown };
  };
  webServer: {
    register(route: {
      kind: 'exact' | 'prefix';
      path: string;
      handler(req: IncomingMessage, res: ServerResponse): Promise<void>;
    }): () => void;
  };
}

const pdfAssets = '/vendor/pdfjs';
const fontAssets = ['/fonts/InterVariable.woff2', '/fonts/InterVariable-Italic.woff2'];
const assets = fileURLToPath(new URL('../reader/', import.meta.url));
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

async function serveAsset(path: string, req: IncomingMessage, res: ServerResponse) {
  const decoded = decodeURIComponent(path);
  const segments = decoded.split('/').filter(Boolean);
  if (decoded.includes('\\') || segments.some((part) => part.startsWith('.') || /[:\x00-\x1f]/.test(part))) {
    res.writeHead(404).end();
    return;
  }

  const key = segments.join('/');
  const name = key || 'index';
  const file = join(assets, extname(name) ? name : name + '.html');
  const info = await stat(file).catch(() => undefined);
  if (!info?.isFile()) {
    res.writeHead(404).end();
    return;
  }

  res.writeHead(200, {
    'content-type': mime[extname(file)] ?? 'application/octet-stream',
    'content-length': info.size,
    'cache-control': key.startsWith('_next/static/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-frame-options': 'SAMEORIGIN',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') res.end();
  else await pipeline(createReadStream(file), res);
}

async function sendResponse(response: Response, res: ServerResponse) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) await pipeline(Readable.fromWeb(response.body as NodeReadableStream), res);
  else res.end();
}

async function speech(req: IncomingMessage, res: ServerResponse, url: URL) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
    return res.writeHead(415).end();
  }
  const body = await readLimitedBody(req, 16 * 1024);
  if (body === null) {
    res.shouldKeepAlive = false;
    return res.writeHead(413).end();
  }
  if (!body) return res.writeHead(411).end();
  const request = new Request(url, { method: 'POST', body });
  await sendResponse(await edgeSpeechResponse(request, true), res);
}

export const name = 'dsh-novel-readnest';
export const inject = ['webServer', 'connection', 'agents'];

export function apply(ctx: HostContext) {
  ctx.effect(() => {
    const bridge = createBookBridge((id, book, snapshot) => {
      const agent = ctx.agents.get(id);
      return agent ? readingHistoryConflict(agent.session, book, snapshot) : undefined;
    }, (id) => ctx.agents.get(id)?.session);
    ctx.provide('novelReader', bridge);

    const handleReaderRequest = async (req: IncomingMessage, res: ServerResponse) => {
      const admission = ctx.connection.admit(req);
      if ('rejection' in admission) {
        res.writeHead(admission.rejection).end();
        return;
      }

      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        if (url.pathname === companionEndpoint) {
          await bridge.handle(req, res);
          return;
        }
        if (req.method === 'POST' && url.pathname === readerPath + '/api/tts/edge') {
          await speech(req, res, url);
          return;
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405, { Allow: 'GET, HEAD' }).end();
          return;
        }
        if (url.pathname === readerPath + '/api/opds/proxy') {
          const headers = new Headers();
          if (req.headers.authorization) headers.set('authorization', req.headers.authorization);
          const request = new Request(url, { method: req.method, headers });
          await sendResponse(await (req.method === 'HEAD' ? catalogHead : catalogGet)(request), res);
          return;
        }

        const path = url.pathname.startsWith(readerPath) ? url.pathname.slice(readerPath.length) : url.pathname;
        const previousRoute = /^\/reader\/([a-zA-Z0-9,;_+%-]+)\/?$/.exec(path);
        if (previousRoute) {
          url.searchParams.set('ids', decodeURIComponent(previousRoute[1]!));
          res.writeHead(302, { location: readerPath + '/reader?' + url.searchParams.toString() }).end();
          return;
        }
        await serveAsset(path, req, res);
      } catch (error) {
        if (res.destroyed) return;
        console.error('[dsh-novel-readnest]', error);
        if (!res.headersSent) res.writeHead(error instanceof URIError ? 400 : 500);
        res.end();
      }
    };

    const unregister = [
      ctx.webServer.register({ kind: 'prefix', path: readerPath, handler: handleReaderRequest }),
      ctx.webServer.register({ kind: 'prefix', path: pdfAssets, handler: handleReaderRequest }),
      ...fontAssets.map((path) =>
        ctx.webServer.register({ kind: 'exact', path, handler: handleReaderRequest }),
      ),
    ];

    return () => {
      bridge.dispose();
      unregister.forEach((dispose) => dispose());
    };
  });
}
