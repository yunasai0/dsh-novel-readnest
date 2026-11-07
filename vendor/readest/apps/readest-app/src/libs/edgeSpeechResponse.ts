import {
  EdgeSpeechTTS,
  EdgeTTSPayload,
  serializeWordBoundaries,
  WORD_BOUNDARIES_HEADER,
} from './edgeTTS';

const getLangFromVoice = (voiceId: string): string => {
  const match = voiceId.match(/^([a-z]{2}-[A-Z]{2})/);
  return match ? match[1]! : 'en-US';
};

export async function edgeSpeechResponse(request: Request, admittedByDsh: boolean) {
  try {
    const body = await request.json();
    const { input: text, voice, speed = 1.0 } = body;
    let { rate, lang } = body;

    if (!text || typeof text !== 'string') {
      return Response.json(
        { error: { message: 'Missing or invalid "input" field', type: 'invalid_request_error' } },
        { status: 400 },
      );
    }
    if (admittedByDsh && text.length > 2000) {
      return Response.json({ error: 'Speech input is too long' }, { status: 413 });
    }

    if (!voice || typeof voice !== 'string') {
      return Response.json(
        { error: { message: 'Missing or invalid "voice" field', type: 'invalid_request_error' } },
        { status: 400 },
      );
    }

    const voiceConfig = EdgeSpeechTTS.voices.find((v) => v.id === voice);
    if (!voiceConfig) {
      return Response.json(
        {
          error: {
            message: `Invalid voice "${voice}". Use GET /api/tts/edge to list available voices.`,
            type: 'invalid_request_error',
          },
        },
        { status: 400 },
      );
    }

    lang = admittedByDsh ? voiceConfig.lang : lang || getLangFromVoice(voice);

    // Calculate rate (OpenAI speed ranges from 0.25 to 4.0, Edge TTS rate is 0.5 to 2.0)
    const clampedSpeed = Math.max(0.25, Math.min(4.0, speed));
    let mappedSpeed: number;
    if (clampedSpeed <= 1.0) {
      mappedSpeed = 0.5 + ((clampedSpeed - 0.25) / (1.0 - 0.25)) * (1.0 - 0.5);
    } else {
      mappedSpeed = 1.0 + ((clampedSpeed - 1.0) / (4.0 - 1.0)) * (2.0 - 1.0);
    }
    rate = admittedByDsh ? 1 : rate || mappedSpeed;

    const payload: EdgeTTSPayload = {
      lang,
      text: admittedByDsh
        ? text
            .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/gi, '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
        : text,
      voice,
      rate,
      pitch: 1.0,
    };

    const tts = new EdgeSpeechTTS();
    const { response, boundaries } = await tts.createWithBoundaries(payload);
    const arrayBuffer = await response.arrayBuffer();

    const headers: Record<string, string> = {
      'Content-Type': 'audio/mpeg',
      'Content-Length': arrayBuffer.byteLength.toString(),
    };
    // Only emit the word-boundary header when it fits well under common
    // header-size caps (~8KB). Oversized values can be dropped by proxies and
    // break delivery; the client falls back to [] when the header is absent.
    const serializedBoundaries = serializeWordBoundaries(boundaries);
    if (serializedBoundaries.length <= 8192) {
      headers[WORD_BOUNDARIES_HEADER] = serializedBoundaries;
    }

    return new Response(arrayBuffer, { status: 200, headers });
  } catch (error) {
    console.error('Edge TTS API error:', error);
    return Response.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          type: 'internal_error',
        },
      },
      { status: 500 },
    );
  }
}

