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
import useVideo from '@/common/components/video/editor/useVideo';
import useReportError from '@/common/error/useReportError';
import {
  activeTrackletObjectIdAtom,
  isPlayingAtom,
  isStreamingAtom,
} from '@/demo/atoms';
import {
  AddFilled,
  Select_02,
  SubtractFilled,
  TrashCan,
} from '@carbon/icons-react';
import stylex from '@stylexjs/stylex';
import {useAtom, useAtomValue} from 'jotai';
import {useState} from 'react';
import type {ButtonProps} from 'react-daisyui';
import {Button} from 'react-daisyui';

type Props = {
  objectId: number;
  active: boolean;
};

const styles = stylex.create({
  button: {
    ':hover': {
      background: '#FFFFFF14',
    },
  },
});

function CustomButton({className, ...props}: ButtonProps) {
  return (
    <Button
      size="sm"
      color="ghost"
      className={`font-medium border-none px8 -mx-8 h-10 ${className} ${
        stylex.props(styles.button).className
      }`}
      {...props}>
      {props.children}
    </Button>
  );
}

export default function ObjectActions({objectId, active}: Props) {
  const [isRemovingObject, setIsRemovingObject] = useState<boolean>(false);
  const [activeTrackId, setActiveTrackletId] = useAtom(
    activeTrackletObjectIdAtom,
  );
  const isStreaming = useAtomValue(isStreamingAtom);
  const isPlaying = useAtom(isPlayingAtom);

  const video = useVideo();
  const reportError = useReportError();

  async function handleRemoveObject(
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    try {
      event.stopPropagation();
      setIsRemovingObject(true);
      if (isStreaming) {
        await video?.abortStreamMasks();
      }
      if (isPlaying) {
        video?.pause();
      }
      await video?.deleteTracklet(objectId);
    } catch (error) {
      reportError(error);
    } finally {
      setIsRemovingObject(false);
      if (activeTrackId === objectId) {
        setActiveTrackletId(null);
      }
    }
  }

  return (
    <div>
      {active && (
        <div className="text-sm mt8 leading-snug label1 hidden md:block f13">
          Select <AddFilled size={14} className="inline" /> to add areas to the
          object and <SubtractFilled size={14} className="inline" /> to remove
          areas from the object in the video. Click on an existing point to
          delete it.
        </div>
      )}
      {!active && (
        <div className="fbh g40 fbac mt12">
          <CustomButton startIcon={<Select_02 size={24} />}>
            Edit selection
          </CustomButton>
          <CustomButton
            loading={isRemovingObject}
            onClick={handleRemoveObject}
            startIcon={!isRemovingObject && <TrashCan size={24} />}>
            <span className="hidden md:inline">Clear</span>
          </CustomButton>
        </div>
      )}
    </div>
  );
}
