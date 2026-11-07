import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/tts/edge/route';

const { synthesize } = vi.hoisted(() => ({ synthesize: vi.fn() }));

vi.mock('@/utils/access', () => ({ validateUserAndToken: async () => ({}) }));
vi.mock('@/libs/edgeTTS', () => ({
  EdgeSpeechTTS: class {
    static voices = [{ id: 'en-US-AriaNeural', lang: 'en-US' }];
    createWithBoundaries = synthesize;
  },
  serializeWordBoundaries: () => '',
  WORD_BOUNDARIES_HEADER: 'x-word-boundaries',
}));

const request = (key?: string, input = 'a <tag> & a window') =>
  new NextRequest('http://127.0.0.1/novel-reader/api/tts/edge', {
    method: 'POST',
    headers: key ? { 'x-readest-dsh-speech-relay': key } : undefined,
    body: JSON.stringify({ input, voice: 'en-US-AriaNeural', lang: 'untrusted' }),
  });

describe('DSH speech relay', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    synthesize.mockReset();
  });

  it('does not accept relay headers on a normal Web deployment or without the host key', async () => {
    vi.stubEnv('READEST_DSH_SPEECH_RELAY_KEY', 'host-key');
    expect((await POST(request('host-key'))).status).toBe(403);
    vi.stubEnv('NEXT_PUBLIC_DSH_READER_PATH', '/novel-reader');
    expect((await POST(request('fake-key'))).status).toBe(403);
    expect((await POST(request())).status).toBe(403);
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('returns synthesized audio for a valid relay and bounds its input', async () => {
    vi.stubEnv('NEXT_PUBLIC_DSH_READER_PATH', '/novel-reader');
    vi.stubEnv('READEST_DSH_SPEECH_RELAY_KEY', 'host-key');
    synthesize.mockResolvedValue({
      response: new Response(new Uint8Array([1, 2, 3])),
      boundaries: [],
    });
    const response = await POST(request('host-key'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(synthesize).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'en-US', text: 'a &lt;tag&gt; &amp; a window' }),
    );
    expect((await POST(request('host-key', 'x'.repeat(2001)))).status).toBe(413);
    expect(synthesize).toHaveBeenCalledTimes(1);
  });
});
