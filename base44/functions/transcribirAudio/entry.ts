import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import OpenAI from 'npm:openai';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { audio_url } = body;

  if (!audio_url) return Response.json({ error: 'audio_url requerido' }, { status: 400 });

  const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

  // Descargar el audio
  const audioResponse = await fetch(audio_url);
  const audioBuffer = await audioResponse.arrayBuffer();
  const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
  const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'es',
  });

  return Response.json({ transcripcion: transcription.text });
});