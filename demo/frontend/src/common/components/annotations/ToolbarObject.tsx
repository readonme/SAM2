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
import ObjectActions from '@/common/components/annotations/ObjectActions';
import ObjectThumbnail from '@/common/components/annotations/ObjectThumbnail';
import ToolbarObjectContainer from '@/common/components/annotations/ToolbarObjectContainer';
import useVideo from '@/common/components/video/editor/useVideo';
import {BaseTracklet} from '@/common/tracker/Tracker';
import emptyFunction from '@/common/utils/emptyFunction';
import {activeTrackletObjectIdAtom} from '@/demo/atoms';
import {useSetAtom} from 'jotai';
import PointsToggle from './PointsToggle';

type Props = {
  label: string;
  tracklet: BaseTracklet;
  isActive: boolean;
  onClick?: () => void;
  onThumbnailClick?: () => void;
};

export default function ToolbarObject({
  label,
  tracklet,
  isActive,
  onClick,
  onThumbnailClick = emptyFunction,
}: Props) {
  const video = useVideo();
  const setActiveTrackletId = useSetAtom(activeTrackletObjectIdAtom);

  async function handleCancelNewObject() {
    try {
      await video?.deleteTracklet(tracklet.id);
    } catch (error) {
      reportError(error);
    } finally {
      setActiveTrackletId(null);
    }
  }

  if (!tracklet.isInitialized) {
    return (
      <ToolbarObjectContainer
        alignItems="center"
        isActive={isActive}
        title="New object"
        subtitle="No object is currently selected. Click an object in the video."
        thumbnail={
          <div
            className={`relative h-12 w-12 md:h-20 md:w-20 shrink-0 rounded-lg`}
            style={{background: tracklet.color}}
          />
        }
        onClick={onClick}
        onCancel={handleCancelNewObject}
      />
    );
  }

  return (
    <ToolbarObjectContainer
      isActive={isActive}
      onClick={onClick}
      title={label}
      subtitle=""
      thumbnail={
        <ObjectThumbnail
          thumbnail={tracklet.thumbnail}
          color={tracklet.color}
          onClick={onThumbnailClick}
        />
      }
      actions={isActive && <PointsToggle />}>
      <ObjectActions objectId={tracklet.id} active={isActive} />
    </ToolbarObjectContainer>
  );
}
