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
import CustomButton from '../custom/Button';
import Icon from '../custom/Icon';

type Props = {
  onSessionClose: () => void;
};

export default function CloseSessionButton({onSessionClose}: Props) {
  const video = useVideo();

  function handleCloseSession() {
    video?.closeSession();
    video?.logAnnotations();
    onSessionClose();
  }

  return (
    <CustomButton
      onClick={handleCloseSession}
      width={360}
      height={44}
      themeStyle
      fullWidth>
      <div className="f15 fbh fbac g6">
        Next
        <Icon name="arrow" size={10} />
      </div>
    </CustomButton>
  );
}
