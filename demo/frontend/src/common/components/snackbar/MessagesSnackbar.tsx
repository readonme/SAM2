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
import {color} from '@/theme/tokens.stylex';
import stylex from '@stylexjs/stylex';
import {useAtomValue} from 'jotai';
import {Loading, RadialProgress} from 'react-daisyui';
import Icon from '../custom/Icon';
import {messageAtom} from './snackbarAtoms';
import useExpireMessage from './useExpireMessage';
import useMessagesSnackbar from './useMessagesSnackbar';

const styles = stylex.create({
  container: {
    position: 'absolute',
    top: '8px',
    right: '8px',
  },
  messageContainer: {
    padding: 16,
    color: '#FFF',
    borderRadius: '8px',
    fontSize: '0.9rem',
    maxWidth: 400,
    background: '#303339',
  },
  messageWarningContainer: {
    background: '#FFDC32',
    color: color['gray-900'],
  },
  progress: {
    flexShrink: 0,
    color: 'rgba(255, 255, 255, 0.1)',
  },
  button: {
    borderRadius: 8,
    background: 'white',
    color: 'black',
  },
});

export default function MessagesSnackbar() {
  const message = useAtomValue(messageAtom);
  const {clearMessage} = useMessagesSnackbar();

  useExpireMessage();

  if (message == null) {
    return null;
  }

  const closeIcon = (
    <div
      className={`py6 px12 hand ${stylex.props(styles.button).className}`}
      onClick={clearMessage}>
      OK
    </div>
  );

  return (
    <div {...stylex.props(styles.container)}>
      <div
        {...stylex.props(
          styles.messageContainer,
          message.type === 'warning' && styles.messageWarningContainer,
        )}>
        <div className="fbv fbae g12">
          <div className="fbh g8">
            {message.type === 'loading' && <Loading size="xs" variant="dots" />}
            {message.type === 'info' && (
              <Icon name="info" className="mt1" size={16} />
            )}
            {message.text}
          </div>
          {message.showClose && (
            <div>
              {message.expire ? (
                <RadialProgress
                  value={message.progress * 100}
                  size="32px"
                  thickness="2px"
                  {...stylex.props(styles.progress)}>
                  {closeIcon}
                </RadialProgress>
              ) : (
                closeIcon
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
