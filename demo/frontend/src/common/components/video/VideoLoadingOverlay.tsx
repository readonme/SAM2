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
import {spacing} from '@/theme/tokens.stylex';
import stylex from '@stylexjs/stylex';
import Icon from '../custom/Icon';

const styles = stylex.create({
  overlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    background: '#10151AE5',
    zIndex: 1,
  },
  indicatorContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing[4],
    color: 'white',
  },
  indicatorText: {
    width: '360px',
    color: '#FFDF29',
    textAlign: 'center',
  },
});

export default function VideoLoadingOverlay(props: {
  loading: boolean;
  position: number;
}) {
  const {loading, position} = props;

  return (
    (loading || !!position) && (
      <div {...stylex.props(styles.overlay)}>
        <div {...stylex.props(styles.indicatorContainer)}>
          <Icon name="wait" width={42} height={39} />
          <div
            className={`f15 ${stylex.props(styles.indicatorText).className}`}>
            {`Please wait, ${position === 0 ? '' : `you're ${position}rd in line! `}We'll start processing`}
            <br />
            your video shortly.
          </div>
        </div>
      </div>
    )
  );
}
