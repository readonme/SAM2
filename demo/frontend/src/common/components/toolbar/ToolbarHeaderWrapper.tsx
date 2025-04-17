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
import {streamingStateAtom} from '@/demo/atoms';
import {useAtomValue} from 'jotai';
import {ReactNode, useMemo} from 'react';
import {OBJECT_TOOLBAR_INDEX} from './ToolbarConfig';
import useToolbarTabs from './useToolbarTabs';

type Props = {
  title: string;
  description?: string;
  bottomSection?: ReactNode;
  showProgressChip?: boolean;
  className?: string;
};

export default function ToolbarHeaderWrapper({
  title,
  description,
  bottomSection,
  showProgressChip = true,
  className,
}: Props) {
  const [toolbarIndex] = useToolbarTabs();
  const streamingState = useAtomValue(streamingStateAtom);
  const stepValue = useMemo(() => {
    if (toolbarIndex === OBJECT_TOOLBAR_INDEX) {
      return streamingState !== 'full' ? 1 : 2;
    }
    return 3;
  }, [streamingState, toolbarIndex]);

  return (
    <div
      className={`flex flex-col g16 p20 border-b border-b-black ${className}`}
      style={{borderColor: '#FFFFFF1F'}}>
      <div className="fbh fbac g8">
        <h2 className="f20 bold">
          {showProgressChip && `${stepValue}. `}
          {title}
        </h2>
      </div>
      {description != null && (
        <div className="flex-1 f14 label1">{description}</div>
      )}
      {bottomSection != null && bottomSection}
    </div>
  );
}
