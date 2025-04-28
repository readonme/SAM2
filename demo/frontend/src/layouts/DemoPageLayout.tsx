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
import {logButtonClick} from '@/common/apis/report';
import ResetButton from '@/common/components/button/ResetButton';
import Icon from '@/common/components/custom/Icon';
import useRestartSession from '@/common/components/session/useRestartSession';
import {OBJECT_TOOLBAR_INDEX} from '@/common/components/toolbar/ToolbarConfig';
import useToolbarTabs from '@/common/components/toolbar/useToolbarTabs';
import useVideoEffect from '@/common/components/video/editor/useVideoEffect';
import {EffectIndex} from '@/common/components/video/effects/Effects';
import LoadingStateScreen from '@/common/loading/LoadingStateScreen';
import {
  isFirstClickMadeAtom,
  isVideoLoadingAtom,
  sessionAtom,
  streamingStateAtom,
} from '@/demo/atoms';
import {spacing} from '@/theme/tokens.stylex';
import stylex from '@stylexjs/stylex';
import {useAtomValue} from 'jotai';
import {PropsWithChildren, useCallback, useMemo} from 'react';
import {useNavigate} from 'react-router-dom';

type Props = PropsWithChildren;

const styles = stylex.create({
  container: {
    width: '100%',
    height: '100vh',
    boxSizing: 'border-box',
    minWidth: '50rem',
  },
  content: {
    width: '100%',
    height: 'calc(100% - 52px)',
    display: 'flex',
    gap: spacing[3],
  },
  badge: {
    width: 24,
    height: 24,
    flexShrink: 0,
    background: '#FFFFFF1F',
    color: '#FFFFFF99',
    fontWeight: 'bold',
    borderRadius: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeActive: {
    background: '#44DAC8',
    color: '#10151A',
  },
  divider: {
    borderBottom: '1px solid #FFFFFF1F',
    maxWidth: 64,
    minWidth: 12,
    flex: 1,
  },
  dividerActive: {
    borderBottom: '1px solid #FFFFFF',
  },
});

export default function DemoPageLayout({children}: Props) {
  const navigate = useNavigate();
  const {restartSession, isLoading} = useRestartSession();
  const onBack = () => {
    navigate(
      {pathname: location.pathname, search: location.search},
      {state: {video: undefined}},
    );
  };
  const [toolbarIndex] = useToolbarTabs();
  const streamingState = useAtomValue(streamingStateAtom);
  const isFirstClickMade = useAtomValue(isFirstClickMadeAtom);
  const stepValue = useMemo(() => {
    if (!isFirstClickMade) {
      return 0;
    }
    if (toolbarIndex === OBJECT_TOOLBAR_INDEX) {
      return streamingState !== 'full' ? 1 : 2;
    }
    return 3;
  }, [isFirstClickMade, streamingState, toolbarIndex]);
  const setEffect = useVideoEffect();
  const [, setTabIndex] = useToolbarTabs();
  const reset = useCallback(() => {
    setEffect('Original', EffectIndex.BACKGROUND, {variant: 0});
    setEffect('Overlay', EffectIndex.HIGHLIGHT, {variant: 0});
    setTabIndex(OBJECT_TOOLBAR_INDEX);
  }, [setEffect, setTabIndex]);
  const isVideoLoading = useAtomValue(isVideoLoadingAtom);
  const session = useAtomValue(sessionAtom);
  const showLoading = isVideoLoading || session === null;
  const restart = () => {
    logButtonClick({button: 'app_start_over'});
    restartSession(reset);
  };

  return (
    <div
      className={`fbv pt24 pb20 px16 g16 ${
        stylex.props(!showLoading && styles.container).className
      }`}>
      {showLoading && (
        <LoadingStateScreen
          title="Loading..."
          description="The loading time depends on the length of your video, you may test with a shorter video first."
        />
      )}
      <div className="fbh fbac g50">
        <Icon name="back" size={32} onClick={onBack} />
        <div className="fb1 fbh fbac g12 f15">
          {stepValue > 0 && (
            <>
              <div className="fbh fbac g6">
                <div {...stylex.props(styles.badge, styles.badgeActive)}>1</div>
                <p>Select Objects</p>
              </div>
              <div
                {...stylex.props(
                  styles.divider,
                  stepValue > 1 && styles.dividerActive,
                )}
              />
              <div className="fbh fbac g6">
                <div
                  {...stylex.props(
                    styles.badge,
                    stepValue >= 2 && styles.badgeActive,
                  )}>
                  2
                </div>
                <p>Review tracked objects</p>
              </div>
              <div
                {...stylex.props(
                  styles.divider,
                  stepValue > 2 && styles.dividerActive,
                )}
              />
              <div className="fbh fbac g6">
                <div
                  {...stylex.props(
                    styles.badge,
                    stepValue >= 3 && styles.badgeActive,
                  )}>
                  3
                </div>
                <p>Add effects</p>
              </div>
            </>
          )}
        </div>
        <div className="fbh fbac g28">
          <ResetButton
            onClick={restart}
            isLoading={isLoading}
            title="Start over"
          />
        </div>
      </div>
      <div className={`${stylex.props(styles.content).className}`}>
        {children}
      </div>
    </div>
  );
}
