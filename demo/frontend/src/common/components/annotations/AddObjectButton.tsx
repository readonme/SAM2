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
import useMessagesSnackbar from '@/common/components/snackbar/useDemoMessagesSnackbar';
import useVideo from '@/common/components/video/editor/useVideo';
import {activeTrackletObjectIdAtom, labelTypeAtom} from '@/demo/atoms';
import stylex from '@stylexjs/stylex';
import {useSetAtom} from 'jotai';
import Icon from '../custom/Icon';

const styles = stylex.create({
  button: {
    border: '1px solid #FFFFFF33',
    ':hover': {
      background: '#FFFFFF14',
    },
  },
});

export default function AddObjectButton() {
  const video = useVideo();
  const setActiveTrackletId = useSetAtom(activeTrackletObjectIdAtom);
  const setLabelType = useSetAtom(labelTypeAtom);
  const {enqueueMessage} = useMessagesSnackbar();

  async function addObject() {
    enqueueMessage('addObjectClick');
    const tracklet = await video?.createTracklet();
    if (tracklet != null) {
      setActiveTrackletId(tracklet.id);
      setLabelType('positive');
    }
  }

  return (
    <div
      onClick={addObject}
      className={`hand br10 mx16 ${stylex.props(styles.button).className}`}>
      <div className="p24 fbh fbac g12">
        <Icon name="add2" size={18} />
        <p className="f16">Add another object</p>
      </div>
    </div>
  );
}
