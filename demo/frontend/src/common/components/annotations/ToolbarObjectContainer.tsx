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
import {Close} from '@carbon/icons-react';
import stylex from '@stylexjs/stylex';
import {PropsWithChildren, ReactNode} from 'react';

const sharedStyles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    cursor: 'pointer',
    flexShrink: 0,
    border: '1px solid #FFFFFF1F',
    borderRadius: 10,
    marginHorizontal: 16,
    padding: 16,
    gap: 20,
    ':hover': {
      background: '#FFFFFF14',
    },
  },
  activeContainer: {
    background: '#FFFFFF14',
  },
  itemsCenter: {
    alignItems: 'center',
  },
  rightColumn: {
    marginStart: spacing[4],
    alignItems: 'center',
    flexGrow: 1,
  },
});

type ToolbarObjectContainerProps = PropsWithChildren<{
  alignItems?: 'top' | 'center';
  isActive: boolean;
  title: string;
  subtitle: string;
  thumbnail: ReactNode;
  actions?: ReactNode;
  onCancel?: () => void;
  onClick?: () => void;
}>;

export default function ToolbarObjectContainer({
  alignItems = 'top',
  children,
  isActive,
  title,
  subtitle,
  thumbnail,
  actions,
  onClick,
  onCancel,
}: ToolbarObjectContainerProps) {
  return (
    <div
      onClick={onClick}
      {...stylex.props(
        sharedStyles.container,
        isActive && sharedStyles.activeContainer,
        alignItems === 'center' && sharedStyles.itemsCenter,
      )}>
      <div className="fbh fbac">
        {thumbnail}
        <div {...stylex.props(sharedStyles.rightColumn)}>
          <div className="text-md font-semibold">{title}</div>
          {subtitle.length > 0 && (
            <div className="f14 label1 pt8">{subtitle}</div>
          )}
          {children}
        </div>
        {onCancel != null && (
          <div className="items-start self-stretch -m-4" onClick={onCancel}>
            <Close size={16} />
          </div>
        )}
      </div>
      {actions}
    </div>
  );
}
