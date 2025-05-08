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
import {labelTypeAtom} from '@/demo/atoms';
import {AddFilled, SubtractFilled} from '@carbon/icons-react';
import stylex from '@stylexjs/stylex';
import {useAtom} from 'jotai';

const styles = stylex.create({
  button: {
    background: '#FFFFFF0A',
    border: '0.5px solid #FFFFFF14',
  },
  active: {
    background: '#FFFFFF14',
    border: '0.5px solid #FFFFFF',
  },
});

export default function PointsToggle() {
  const [labelType, setLabelType] = useAtom(labelTypeAtom);
  const isPositive = labelType === 'positive';

  return (
    <div className="flex items-center w-full">
      <div className="join group grow">
        <button
          className={`w-1/2 btn join-item text-white ${
            stylex.props(styles.button, isPositive && styles.active).className
          }`}
          onClick={() => setLabelType('positive')}>
          <AddFilled size={24} style={{color: '#44DAC8'}} /> Add
        </button>
        <button
          className={`w-1/2 btn join-item text-white ${
            stylex.props(styles.button, !isPositive && styles.active).className
          }`}
          onClick={() => setLabelType('negative')}>
          <SubtractFilled size={24} style={{color: '#FF3547'}} />
          Remove
        </button>
      </div>
    </div>
  );
}
