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
import Icon from '../custom/Icon';

export default function LimitNotice() {
  return (
    <div className="g8 mx24 flex items-center label2">
      <div>
        <Icon name="info" size={20} style={{opacity: 0.6}} />
      </div>
      <div className="text-sm leading-snug">You can track up to 3 objects</div>
    </div>
  );
}
