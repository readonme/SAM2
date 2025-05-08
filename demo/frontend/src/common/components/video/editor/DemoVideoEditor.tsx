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
import TrackletsAnnotation from '@/common/components/annotations/TrackletsAnnotation';
import useCloseSessionBeforeUnload from '@/common/components/session/useCloseSessionBeforeUnload';
import MessagesSnackbar from '@/common/components/snackbar/MessagesSnackbar';
import useMessagesSnackbar from '@/common/components/snackbar/useDemoMessagesSnackbar';
import {OBJECT_TOOLBAR_INDEX} from '@/common/components/toolbar/ToolbarConfig';
import useToolbarTabs from '@/common/components/toolbar/useToolbarTabs';
import VideoFilmstripWithPlayback from '@/common/components/video/VideoFilmstripWithPlayback';
import {
  FrameUpdateEvent,
  RenderingErrorEvent,
  SessionStartedEvent,
  TrackletsEvent,
} from '@/common/components/video/VideoWorkerBridge';
import VideoEditor from '@/common/components/video/editor/VideoEditor';
import useResetDemoEditor from '@/common/components/video/editor/useResetEditor';
import useVideo from '@/common/components/video/editor/useVideo';
import InteractionLayer from '@/common/components/video/layers/InteractionLayer';
import {PointsLayer} from '@/common/components/video/layers/PointsLayer';
import LoadingStateScreen from '@/common/loading/LoadingStateScreen';
import {SegmentationPoint} from '@/common/tracker/Tracker';
import {
  activeTrackletObjectIdAtom,
  frameIndexAtom,
  isAddObjectEnabledAtom,
  isPlayingAtom,
  pointsAtom,
  sessionAtom,
  streamingStateAtom,
  trackletObjectsAtom,
  VideoData,
} from '@/demo/atoms';
import useSettingsContext from '@/settings/useSettingsContext';
import stylex from '@stylexjs/stylex';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {useEffect, useState} from 'react';
import type {ErrorObject} from 'serialize-error';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    width: '100%',
    background: '#1E2128',
    borderRadius: 12,
  },
});

type Props = {
  video: VideoData;
};

export default function DemoVideoEditor({video: inputVideo}: Props) {
  const video = useVideo();
  const {settings} = useSettingsContext();

  const [isSessionStartFailed, setIsSessionStartFailed] =
    useState<boolean>(false);

  const [session, setSession] = useAtom(sessionAtom);

  const [activeTrackletId, setActiveTrackletObjectId] = useAtom(
    activeTrackletObjectIdAtom,
  );
  const setTrackletObjects = useSetAtom(trackletObjectsAtom);
  const setFrameIndex = useSetAtom(frameIndexAtom);
  const points = useAtomValue(pointsAtom);
  const isAddObjectEnabled = useAtomValue(isAddObjectEnabledAtom);
  const streamingState = useAtomValue(streamingStateAtom);
  const isPlaying = useAtomValue(isPlayingAtom);

  const [, setRenderingError] = useState<ErrorObject | null>(null);

  const [tabIndex] = useToolbarTabs();
  const {enqueueMessage} = useMessagesSnackbar();

  useCloseSessionBeforeUnload();

  const {resetEditor, resetSession} = useResetDemoEditor();
  useEffect(() => {
    resetEditor();
  }, [inputVideo, resetEditor]);

  useEffect(() => {
    function onFrameUpdate(event: FrameUpdateEvent) {
      setFrameIndex(event.index);
    }

    // Listen to frame updates to fetch the frame index in the main thread,
    // which is then used downstream to render points per frame.
    video?.addEventListener('frameUpdate', onFrameUpdate);

    function onSessionStarted(event: SessionStartedEvent) {
      setSession({id: event.sessionId, ranPropagation: false});
    }

    video?.addEventListener('sessionStarted', onSessionStarted);

    function onSessionStartFailed() {
      setIsSessionStartFailed(true);
    }

    video?.addEventListener('sessionStartFailed', onSessionStartFailed);

    function onTrackletsUpdated(event: TrackletsEvent) {
      const tracklets = event.tracklets;
      if (tracklets.length === 0) {
        resetSession();
      }
      setTrackletObjects(tracklets);
    }

    video?.addEventListener('trackletsUpdated', onTrackletsUpdated);

    function onRenderingError(event: RenderingErrorEvent) {
      setRenderingError(event.error);
    }

    video?.addEventListener('renderingError', onRenderingError);

    video?.initializeTracker('Video Background Remover', {
      inferenceEndpoint: settings.inferenceAPIEndpoint,
    });

    video?.startSession(inputVideo.path);

    return () => {
      video?.closeSession();
      video?.removeEventListener('frameUpdate', onFrameUpdate);
      video?.removeEventListener('sessionStarted', onSessionStarted);
      video?.removeEventListener('sessionStartFailed', onSessionStartFailed);
      video?.removeEventListener('trackletsUpdated', onTrackletsUpdated);
      video?.removeEventListener('renderingError', onRenderingError);
    };
  }, [
    setFrameIndex,
    setSession,
    setTrackletObjects,
    resetSession,
    inputVideo,
    video,
    settings.inferenceAPIEndpoint,
    settings.videoAPIEndpoint,
  ]);

  async function handleOptimisticPointUpdate(newPoints: SegmentationPoint[]) {
    if (session == null) {
      return;
    }

    async function createActiveTracklet() {
      if (!isAddObjectEnabled || newPoints.length === 0) {
        return;
      }
      const tracklet = await video?.createTracklet();
      if (tracklet != null && newPoints.length > 0) {
        setActiveTrackletObjectId(tracklet.id);
        video?.updatePoints(tracklet.id, [newPoints[newPoints.length - 1]]);
      }
    }

    if (activeTrackletId != null) {
      video?.updatePoints(activeTrackletId, newPoints);
    } else {
      await createActiveTracklet();
    }
    enqueueMessage('pointClick');
  }

  async function handleAddPoint(point: SegmentationPoint) {
    if (streamingState === 'partial' || streamingState === 'requesting') {
      return;
    }
    if (isPlaying) {
      return video?.pause();
    }
    handleOptimisticPointUpdate([...points, point]);
  }

  function handleRemovePoint(point: SegmentationPoint) {
    if (
      isPlaying ||
      streamingState === 'partial' ||
      streamingState === 'requesting'
    ) {
      return;
    }
    handleOptimisticPointUpdate(points.filter(p => p !== point));
  }

  // The interaction layer handles clicks onto the video canvas. It is used
  // to get absolute point clicks within the video's coordinate system.
  // The PointsLayer handles rendering of input points and allows removing
  // individual points by clicking on them.
  const layers = (
    <>
      {tabIndex === OBJECT_TOOLBAR_INDEX && (
        <>
          <InteractionLayer
            key="interaction-layer"
            onPoint={point => handleAddPoint(point)}
          />
          <PointsLayer
            key="points-layer"
            points={points}
            onRemovePoint={handleRemovePoint}
          />
        </>
      )}
      <MessagesSnackbar key="snackbar-layer" />
    </>
  );

  return (
    <>
      {isSessionStartFailed && (
        <LoadingStateScreen
          title="Did we just break the internet?"
          description={
            <>Uh oh, it looks like there was an issue starting a session.</>
          }
          linkProps={{to: '..', label: 'Back to homepage'}}
        />
      )}
      <div {...stylex.props(styles.container)}>
        <VideoEditor
          video={inputVideo}
          layers={layers}
          loading={session == null}>
          <div className="w-full px20">
            <VideoFilmstripWithPlayback />
            <TrackletsAnnotation />
          </div>
        </VideoEditor>
      </div>
    </>
  );
}
