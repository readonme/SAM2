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
import Toolbar from '@/common/components/toolbar/Toolbar';
import DemoVideoEditor from '@/common/components/video/editor/DemoVideoEditor';
import useInputVideo from '@/common/components/video/useInputVideo';
import StatsView from '@/debug/stats/StatsView';
import {VideoData} from '@/demo/atoms';
import DemoPageLayout from '@/layouts/DemoPageLayout';
import {useEffect, useMemo} from 'react';
import {Location, useLocation} from 'react-router-dom';

export type LocationState = {
  video?: VideoData;
};

export default function DemoPage() {
  const {state} = useLocation() as Location<LocationState>;
  const {setInputVideo} = useInputVideo();

  const video = useMemo(() => {
    return state.video!;
  }, [state]);

  useEffect(() => {
    setInputVideo(video);
  }, [video, setInputVideo]);

  return (
    <DemoPageLayout>
      <StatsView />
      <Toolbar />
      <DemoVideoEditor video={video} />
    </DemoPageLayout>
  );
}
