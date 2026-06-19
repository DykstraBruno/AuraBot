import { pipeline } from '@xenova/transformers';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

type ASRPipeline = Awaited<ReturnType<typeof pipeline>>;

let _pipe: ASRPipeline | null = null;

const MODEL_ID = process.env.MODEL_ID ?? 'Xenova/whisper-small';

export async function loadModel(): Promise<void> {
  if (_pipe) return;
  console.log(`[Whisper] Carregando ${MODEL_ID} — pode demorar na primeira vez...`);
  _pipe = await pipeline('automatic-speech-recognition', MODEL_ID);
  console.log('[Whisper] Modelo pronto.');
}

function mimeToExt(mimeType: string): string {
  if (mimeType.includes('webm'))              return 'webm';
  if (mimeType.includes('ogg'))               return 'ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4';
  if (mimeType.includes('wav'))               return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  return 'webm';
}

async function toFloat32Samples(buffer: Buffer, mimeType: string): Promise<Float32Array> {
  const id         = randomBytes(8).toString('hex');
  const inputPath  = join(tmpdir(), `stt-in-${id}.${mimeToExt(mimeType)}`);
  const outputPath = join(tmpdir(), `stt-out-${id}.wav`);

  writeFileSync(inputPath, buffer);
  ffmpeg.setFfmpegPath(ffmpegStatic as string);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec('pcm_s16le')
      .format('wav')
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run();
  });

  unlinkSync(inputPath);

  const wav = readFileSync(outputPath);
  unlinkSync(outputPath);

  // Standard PCM WAV header is 44 bytes; remaining bytes are Int16LE samples
  const pcm     = new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) / 2);
  const samples = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) samples[i] = pcm[i] / 32768;
  return samples;
}

export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string,
  language: string
): Promise<string> {
  if (!_pipe) throw new Error('Modelo não carregado. Aguarde a inicialização.');

  const samples = await toFloat32Samples(buffer, mimeType);

  const result = await (_pipe as any)(samples, {
    language,
    task: 'transcribe',
  }) as { text: string };

  return result.text?.trim() ?? '';
}
