/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modified by Real Matrix in 2025
 */
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
