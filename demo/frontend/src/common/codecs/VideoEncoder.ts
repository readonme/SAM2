import {ArrayBufferTarget, Muxer} from 'mp4-muxer';
import {MP4ArrayBuffer} from 'mp4box';
import Logger from '../logger/Logger';
import {ImageFrame} from './VideoDecoder';

export async function encode(
  width: number,
  height: number,
  numFrames: number,
  framesGenerator: AsyncGenerator<ImageFrame, unknown>,
  progressCallback?: (progress: number) => void,
): Promise<MP4ArrayBuffer> {
  let frameIndex = 0;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
    video: {codec: 'avc', width, height},
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
    videoEncoder.encode(frame.bitmap, {keyFrame: frameIndex % 30 === 0}); // 每30帧一个关键帧
    frameIndex++;
  }

  await videoEncoder.flush();
  muxer.finalize();

  const {buffer} = muxer.target;

  return buffer as MP4ArrayBuffer;
}
