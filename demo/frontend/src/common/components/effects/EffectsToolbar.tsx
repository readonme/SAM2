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
import BackgroundEffects from '@/common/components/effects/BackgroundEffects';
import HighlightEffects from '@/common/components/effects/HighlightEffects';
import useMessagesSnackbar from '@/common/components/snackbar/useDemoMessagesSnackbar';
import stylex from '@stylexjs/stylex';
import {useEffect, useRef, useState} from 'react';
import ToolbarHeaderWrapper from '../toolbar/ToolbarHeaderWrapper';
import EffectsConfirm from './EffectsConfirm';

const styles = stylex.create({
  activeTab: {
    color: 'white',
    position: 'relative',
    '::before': {
      content: '',
      position: 'absolute',
      bottom: -8,
      width: '40%',
      left: '30%',
      borderBottom: '1.5px solid white',
    },
  },
});

export default function EffectsToolbar() {
  const isEffectsMessageShown = useRef(false);
  const {enqueueMessage} = useMessagesSnackbar();
  const [tab, setTab] = useState<'object' | 'background'>('object');

  useEffect(() => {
    if (!isEffectsMessageShown.current) {
      isEffectsMessageShown.current = true;
      enqueueMessage('effectsMessage');
    }
  }, [enqueueMessage]);

  return (
    <div className="flex flex-col h-full">
      <ToolbarHeaderWrapper
        title="Add effects"
        description="Apply visual effects to your selected objects and the background. Keeping clicking the same effect for different variations."
        className="pb-4"
      />
      <div className="fbh fbac g24 label2 f15 pt20 pl20">
        <p
          className={`hand ${stylex.props(tab === 'object' && styles.activeTab).className}`}
          onClick={() => setTab('object')}>
          Selected Objects
        </p>
        <p
          className={`hand ${stylex.props(tab === 'background' && styles.activeTab).className}`}
          onClick={() => setTab('background')}>
          Background
        </p>
      </div>
      <div className="grow overflow-y-auto">
        {tab === 'object' ? <HighlightEffects /> : <BackgroundEffects />}
      </div>
      <EffectsConfirm />
    </div>
  );
}
