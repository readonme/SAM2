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
import {OBJECT_TOOLBAR_INDEX} from '@/common/components/toolbar/ToolbarConfig';
import Tooltip from '@/common/components/Tooltip';
import useVideo from '@/common/components/video/editor/useVideo';
import {isPlayingAtom, streamingStateAtom, toolbarTabIndex} from '@/demo/atoms';
import {useAtomValue} from 'jotai';
import {useCallback} from 'react';
import Icon from '../custom/Icon';

export default function PlaybackButton() {
  const tabIndex = useAtomValue(toolbarTabIndex);
  const streamingState = useAtomValue(streamingStateAtom);
  const isPlaying = useAtomValue(isPlayingAtom);
  const video = useVideo();

  const isDisabled =
    tabIndex === OBJECT_TOOLBAR_INDEX &&
    streamingState !== 'none' &&
    streamingState !== 'full';

  const handlePlay = useCallback(() => {
    video?.play();
  }, [video]);

  const handlePause = useCallback(() => {
    video?.pause();
  }, [video]);

  const handleClick = useCallback(() => {
    if (isDisabled) {
      return;
    }
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isDisabled, isPlaying, handlePlay, handlePause]);

  return (
    <Tooltip message={`${isPlaying ? 'Pause' : 'Play'}`}>
      <Icon
        className={`my10 ${isDisabled ? 'ne' : ''}`}
        name={isPlaying ? 'pause' : 'play'}
        hoveredName={isPlaying ? 'pause2' : 'play2'}
        onClick={handleClick}
        size={32}
      />
    </Tooltip>
  );
}
