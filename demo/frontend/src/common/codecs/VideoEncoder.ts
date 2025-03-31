import {ArrayBufferTarget, Muxer} from 'mp4-muxer';
import {MP4ArrayBuffer} from 'mp4box';
import Logger from '../logger/Logger';
import {DecodedAudio, ImageFrame} from './VideoDecoder';

export async function encode(
  width: number,
  height: number,
  numFrames: number,
  framesGenerator: AsyncGenerator<ImageFrame, unknown>,
  audio?: DecodedAudio, // 允许 audio 为空
  progressCallback?: (progress: number) => void,
): Promise<MP4ArrayBuffer> {
  let frameIndex = 0;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
    video: {codec: 'avc', width, height},
    audio: audio && {
      codec: 'aac',
      sampleRate: audio.sampleRate,
      numberOfChannels: audio.channelCount,
    },
  });
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => Logger.error(e),
  });

  videoEncoder.configure({
    codec: 'avc1.640029',
    width,
    height,
  });

  for await (const frame of framesGenerator) {
    progressCallback?.(frameIndex / numFrames);
    videoEncoder.encode(frame.bitmap, {keyFrame: frameIndex % 30 === 0});
    frameIndex++;
  }

  if (audio) {
    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: e => Logger.error(e),
    });

    audioEncoder.configure({
      codec: audio.codec,
      sampleRate: audio.sampleRate,
      numberOfChannels: audio.channelCount,
    });

    for await (const frame of audio.data) {
      audioEncoder.encode(frame);
    }
  }

  await videoEncoder.flush();
  muxer.finalize();

  return muxer.target.buffer as MP4ArrayBuffer;
}
