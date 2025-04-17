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
import PlaybackButton from '@/common/components/button/PlaybackButton';
import VideoFilmstrip from '@/common/components/video/filmstrip/VideoFilmstrip';
import stylex from '@stylexjs/stylex';
import {useCallback, useMemo} from 'react';
import useVideo from './editor/useVideo';
import {generateVideoTicks} from './VideoTicks';

const styles = stylex.create({
  controlContainer: {
    borderBottom: '1px solid #0F1115',
  },
  filmstripContainer: {
    flexGrow: 1,
  },
  tickMinor: {
    borderLeft: '1px solid #FFFFFF33',
    height: 3,
    top: 18,
  },
  tickMajor: {
    borderLeft: '1px solid #FFFFFF66',
    height: 11,
    top: 14,
  },
});

export default function VideoFilmstripWithPlayback() {
  const video = useVideo();
  const compute = useCallback(
    (frame: number) =>
      video?.fps
        ? [
            (frame / video.fps).toFixed(0).padStart(2, '0'),
            (frame % video.fps).toFixed(0).padStart(2, '0'),
          ].join(':')
        : '00:00',
    [video?.fps],
  );
  const ticks = useMemo(() => {
    return video?.fps
      ? generateVideoTicks(video.numberOfFrames, video.fps)
      : [];
  }, [video?.fps, video?.numberOfFrames]);

  return (
    <div className="fbv">
      <div
        className={`fbh fbac fbjc g16 -mx-20 ${stylex.props(styles.controlContainer).className}`}>
        <PlaybackButton />
        <div className="f10 fbh fbac g2">
          <span style={{width: 26}}>
            {video ? `${compute(video.frame)}` : '00:00'}
          </span>
          /
          <span className="label4">
            {video ? `${compute(video.numberOfFrames)}` : '00:00'}
          </span>
        </div>
      </div>
      <div className="fbh fbac pr">
        {ticks?.map((tick, i) => (
          <div
            key={tick.time}
            style={{left: `${tick.progress * 100}%`}}
            className={`pa fbh fbac ${
              stylex.props(tick.isMajor ? styles.tickMajor : styles.tickMinor)
                .className
            }`}>
            {tick.label && (
              <div
                className="f10 label3 pa px4"
                style={{[i === 0 ? 'left' : 'right']: 0}}>
                {tick.label}
              </div>
            )}
          </div>
        ))}
      </div>
      <div {...stylex.props(styles.filmstripContainer)}>
        <VideoFilmstrip />
      </div>
    </div>
  );
}
