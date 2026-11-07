import type { IncomingMessage } from 'node:http';

export async function readLimitedBody(req: IncomingMessage, limit: number): Promise<string | null> {
  const declared = req.headers['content-length'];
  if (declared !== undefined) {
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0 || length > limit) return null;
  }

  const chunks: Buffer[] = [];
  let received = 0;
  // The desktop shell can forward the body as a stream without Content-Length.
  // Keep the socket alive long enough for the handler to send a 413 response.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    received += chunk.length;
    if (received > limit) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, received).toString('utf8');
}
