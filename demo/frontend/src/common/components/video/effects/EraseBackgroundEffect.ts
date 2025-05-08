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
 */
import {Tracklet} from '@/common/tracker/Tracker';
import {CanvasForm} from 'pts';
import {AbstractEffect, EffectFrameContext} from './Effect';

export default class EraseBackgroundEffect extends AbstractEffect {
  constructor() {
    super(3);
  }

  apply(
    form: CanvasForm,
    context: EffectFrameContext,
    _tracklets: Tracklet[],
  ): void {
    if (this.variant === 3 && this.image) {
      // 计算图片宽高比
      const imgRatio = this.image.width / this.image.height;
      // 计算目标区域宽高比
      const targetRatio = context.width / context.height;

      let sourceX = 0,
        sourceY = 0,
        sourceWidth = this.image.width,
        sourceHeight = this.image.height;
      const destX = 0,
        destY = 0,
        destWidth = context.width,
        destHeight = context.height;

      // 判断图片宽高比与目标区域的关系
      if (imgRatio > targetRatio) {
        // 图片比目标区域更宽，需要裁剪左右
        sourceHeight = this.image.height;
        sourceWidth = sourceHeight * targetRatio;
        sourceX = (this.image.width - sourceWidth) / 2;
      } else {
        // 图片比目标区域更高，需要裁剪上下
        sourceWidth = this.image.width;
        sourceHeight = sourceWidth / targetRatio;
        sourceY = (this.image.height - sourceHeight) / 2;
      }

      // 绘制图片
      form.ctx.drawImage(
        this.image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight, // 源图像裁剪区域
        destX,
        destY,
        destWidth,
        destHeight, // 目标画布区域
      );
    } else {
      const fillColor = ['#000', '#fff', '#0f0'][this.variant % 3];
      form.fillOnly(fillColor).rect([
        [0, 0],
        [context.width, context.height],
      ]);
    }
  }
}
