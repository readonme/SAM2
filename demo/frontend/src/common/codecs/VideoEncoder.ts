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
  originWidth: number,
  originHeight: number,
  numFrames: number,
  framesGenerator: AsyncGenerator<ImageFrame, unknown>,
  audio?: DecodedAudio, // 允许 audio 为空
  progressCallback?: (progress: number) => void,
): Promise<MP4ArrayBuffer> {
  let frameIndex = 0;
  const {width, height} = scaleResolutionToFitLimit(
    originWidth,
    originHeight,
    2560,
    2560,
  );
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
  const videoConfigWithoutCodec: Omit<VideoEncoderConfig, 'codec'> = {
    bitrate: getHighQualityBitrateConfig(width, height),
    bitrateMode: 'constant',
    width,
    height,
  };

  videoEncoder.configure({
    ...videoConfigWithoutCodec,
    codec: await getBestSupportedAVCCodec(videoConfigWithoutCodec),
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

function getHighQualityBitrateConfig(
  width: number,
  height: number,
  fps: number = 30,
) {
  // 0.1 ~ 0.2 bits/pixel/frame（高质量）
  const bitsPerPixel = 0.15;
  const bitrate = width * height * fps * bitsPerPixel;

  return Math.floor(bitrate);
}

async function getBestSupportedAVCCodec(
  config: Omit<VideoEncoderConfig, 'codec'>,
) {
  const candidates = [
    'avc1.640032',
    'avc1.640029',
    'avc1.4D401E',
    'avc1.42E01E',
  ];
  for (const codec of candidates) {
    const result = await VideoEncoder.isConfigSupported({
      ...config,
      codec,
    });
    if (result.supported) {
      return codec;
    }
  }
  throw Error('Video Encoder Not Supported!');
}

function scaleResolutionToFitLimit(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): {width: number; height: number} {
  const widthRatio = maxWidth / width;
  const heightRatio = maxHeight / height;
  const scale = Math.min(1, widthRatio, heightRatio);

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
