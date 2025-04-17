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
import {Effects} from '@/common/components/video/effects/Effects';

type EffectLayers = {
  background: keyof Effects;
  highlight: keyof Effects;
};

export const DEMO_SHORT_NAME = 'Video Background Remover';
export const DEMO_FRIENDLY_NAME =
  'Free AI Video Background Remover Online | Remove Background from Video Easily';
export const VIDEO_WATERMARK_TEXT = `Modified with ${DEMO_FRIENDLY_NAME}`;

export const VIDEO_API_ENDPOINT = 'https://sam2-back.wisegotech.com';
export const INFERENCE_API_ENDPOINT = 'https://sam2-back.wisegotech.com';

export const demoObjectLimit = 3;

export const DEFAULT_EFFECT_LAYERS: EffectLayers = {
  background: 'Original',
  highlight: 'Overlay',
};

export const MAX_FILE_SIZE_IN_MB = 70; // MB
export const MAX_VIDEO_UPLOAD_SIZE = MAX_FILE_SIZE_IN_MB * 1024 ** 2;
