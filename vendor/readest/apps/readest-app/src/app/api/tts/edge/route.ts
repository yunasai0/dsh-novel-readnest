import { NextRequest, NextResponse } from 'next/server';
import { EdgeSpeechTTS } from '@/libs/edgeTTS';
import { edgeSpeechResponse } from '@/libs/edgeSpeechResponse';
import { validateUserAndToken } from '@/utils/access';
import { isDshReader } from '@/services/dshReader';

export async function POST(request: NextRequest) {
  const relayKey = process.env['READEST_DSH_SPEECH_RELAY_KEY'];
  const admittedByDsh =
    isDshReader() && !!relayKey && request.headers.get('x-readest-dsh-speech-relay') === relayKey;
  if (!admittedByDsh) {
    const { user, token } = await validateUserAndToken(request.headers.get('authorization'));
    if (!user || !token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 403 });
    }
  }

  return edgeSpeechResponse(request, admittedByDsh);
}

export async function GET(request: NextRequest) {
  const { user, token } = await validateUserAndToken(request.headers.get('authorization'));
  if (!user || !token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 403 });
  }

  try {
    const query = request.nextUrl.searchParams;
    const lang = query.get('lang') || '';
    let voices = EdgeSpeechTTS.voices;
    if (lang) {
      voices = voices.filter((v) => v.lang.toLowerCase().includes(lang.toLowerCase()));
    }

    const formattedVoices = voices.map((voice) => ({
      id: voice.id,
      name: voice.name,
      language: voice.lang,
    }));

    return NextResponse.json({
      voices: formattedVoices,
    });
  } catch (error) {
    console.error('Error listing voices:', error);
    return NextResponse.json(
      {
        error: {
          message: 'Failed to list voices',
          type: 'internal_error',
        },
      },
      { status: 500 },
    );
  }
}
