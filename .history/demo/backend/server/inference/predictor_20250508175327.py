# Copyright (c) Meta Platforms, Inc. and affiliates.
# All rights reserved.
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

import contextlib
import logging
import os
import time
import uuid
from pathlib import Path
from threading import Lock, Thread
from typing import Any, Dict, Generator, List, Optional
import gc

import numpy as np
import torch
from app_conf import APP_ROOT, MODEL_SIZE
from inference.data_types import (
    AddMaskRequest,
    AddPointsRequest,
    CancelPorpagateResponse,
    CancelPropagateInVideoRequest,
    ClearPointsInFrameRequest,
    ClearPointsInVideoRequest,
    ClearPointsInVideoResponse,
    CloseSessionRequest,
    CloseSessionResponse,
    Mask,
    PropagateDataResponse,
    PropagateDataValue,
    PropagateInVideoRequest,
    RemoveObjectRequest,
    RemoveObjectResponse,
    StartSessionRequest,
    StartSessionResponse,
)
from pycocotools.mask import decode as decode_masks, encode as encode_masks
from sam2.build_sam import build_sam2_video_predictor


logger = logging.getLogger(__name__)


class InferenceAPI:

    def __init__(self) -> None:
        super(InferenceAPI, self).__init__()

        self.session_states: Dict[str, Any] = {}
        self.score_thresh = 0
        self.session_timeout = 300  # 会话超时时间（秒）
        self.cleanup_interval = 300  # 清理检查间隔（秒）
        self.last_cleanup_time = time.time()
        self.cleanup_lock = Lock()

        if MODEL_SIZE == "tiny":
            checkpoint = Path(APP_ROOT) / "checkpoints/sam2.1_hiera_tiny.pt"
            model_cfg = "configs/sam2.1/sam2.1_hiera_t.yaml"
        elif MODEL_SIZE == "small":
            checkpoint = Path(APP_ROOT) / "checkpoints/sam2.1_hiera_small.pt"
            model_cfg = "configs/sam2.1/sam2.1_hiera_s.yaml"
        elif MODEL_SIZE == "large":
            checkpoint = Path(APP_ROOT) / "checkpoints/sam2.1_hiera_large.pt"
            model_cfg = "configs/sam2.1/sam2.1_hiera_l.yaml"
        else:  # base_plus (default)
            checkpoint = Path(APP_ROOT) / "checkpoints/sam2.1_hiera_base_plus.pt"
            model_cfg = "configs/sam2.1/sam2.1_hiera_b+.yaml"

        # select the device for computation
        force_cpu_device = os.environ.get("SAM2_DEMO_FORCE_CPU_DEVICE", "0") == "1"
        if force_cpu_device:
            logger.info("forcing CPU device for SAM 2 demo")
        if torch.cuda.is_available() and not force_cpu_device:
            device = torch.device("cuda")
        elif torch.backends.mps.is_available() and not force_cpu_device:
            device = torch.device("mps")
        else:
            device = torch.device("cpu")
        logger.info(f"using device: {device}")

        if device.type == "cuda":
            # turn on tfloat32 for Ampere GPUs (https://pytorch.org/docs/stable/notes/cuda.html#tensorfloat-32-tf32-on-ampere-devices)
            if torch.cuda.get_device_properties(0).major >= 8:
                torch.backends.cuda.matmul.allow_tf32 = True
                torch.backends.cudnn.allow_tf32 = True
        elif device.type == "mps":
            logging.warning(
                "\nSupport for MPS devices is preliminary. SAM 2 is trained with CUDA and might "
                "give numerically different outputs and sometimes degraded performance on MPS. "
                "See e.g. https://github.com/pytorch/pytorch/issues/84936 for a discussion."
            )

        self.device = device
        self.predictor = build_sam2_video_predictor(
            model_cfg, checkpoint, device=device
        )
        self.inference_lock = Lock()

    def autocast_context(self):
        if self.device.type == "cuda":
            return torch.autocast("cuda", dtype=torch.bfloat16)
        else:
            return contextlib.nullcontext()
            
    def _check_and_cleanup_sessions(self, force=False):
        """检查并清理过期的会话"""
        current_time = time.time()
            
        with self.cleanup_lock:
            expired_sessions = []
            for session_id, session in list(self.session_states.items()):
                # 检查会话是否已超时
                if current_time - session.get('last_active_time', 0) > self.session_timeout:
                    expired_sessions.append(session_id)
            
            # 清理过期会话
            for session_id in expired_sessions:
                self.__clear_session_state(session_id, reason="timeout")
                
            self.last_cleanup_time = current_time
            
            # 主动触发垃圾回收
            gc.collect()
            if self.device.type == "cuda":
                torch.cuda.empty_cache()
                
            logger.info(f"Session cleanup completed. Removed {len(expired_sessions)} expired sessions; {self.__get_session_stats()}")

    def start_session(self, request: StartSessionRequest) -> StartSessionResponse:
        with self.autocast_context(), self.inference_lock:
            session_id = str(uuid.uuid4())
            # 对于所有设备类型，默认都将视频帧卸载到CPU，避免GPU内存碎片和泄露
            # 只有在明确指定不卸载时才保留在GPU中
            offload_video_to_cpu = True
            if hasattr(request, 'keep_frames_on_gpu') and request.keep_frames_on_gpu:
                offload_video_to_cpu = self.device.type != "cuda"
                
            inference_state = self.predictor.init_state(
                request.path,
                offload_video_to_cpu=offload_video_to_cpu,
            )
            self.session_states[session_id] = {
                "canceled": False,
                "state": inference_state,
                "last_active_time": time.time(),  # 记录会话创建时间
                "offload_video_to_cpu": offload_video_to_cpu  # 记录是否将视频帧卸载到CPU
            }
            
            # 记录当前内存使用情况
            logger.info(f"Started new session {session_id}; {self.__get_session_stats()}")
            return StartSessionResponse(session_id=session_id)

    def close_session(self, request: CloseSessionRequest) -> CloseSessionResponse:
        is_successful = self.__clear_session_state(request.session_id)
        return CloseSessionResponse(success=is_successful)

    def add_points(
        self, request: AddPointsRequest, test: str = ""
    ) -> PropagateDataResponse:
        with self.autocast_context(), self.inference_lock:
            try:
                session = self.__get_session(request.session_id)
                # 更新会话最后活动时间
                session["last_active_time"] = time.time()
                inference_state = session["state"]

                frame_idx = request.frame_index
                obj_id = request.object_id
                points = request.points
                labels = request.labels
                clear_old_points = request.clear_old_points

                # add new prompts and instantly get the output on the same frame
                frame_idx, object_ids, masks = self.predictor.add_new_points_or_box(
                    inference_state=inference_state,
                    frame_idx=frame_idx,
                    obj_id=obj_id,
                    points=points,
                    labels=labels,
                    clear_old_points=clear_old_points,
                    normalize_coords=False,
                )

                # 确保将张量移动到CPU，并转换为numpy数组
                masks_binary = (masks > self.score_thresh)[:, 0].cpu().numpy()

                rle_mask_list = self.__get_rle_mask_list(
                    object_ids=object_ids, masks=masks_binary
                )
                
                # 显式释放不再需要的张量
                del masks
                if self.device.type == "cuda":
                    torch.cuda.empty_cache()

                return PropagateDataResponse(
                    frame_index=frame_idx,
                    results=rle_mask_list,
                )
            except Exception as e:
                logger.error(f"Error in add_points: {e}")
                raise

    def add_mask(self, request: AddMaskRequest) -> PropagateDataResponse:
        """
        Add new points on a specific video frame.
        - mask is a numpy array of shape [H_im, W_im] (containing 1 for foreground and 0 for background).
        Note: providing an input mask would overwrite any previous input points on this frame.
        """
        with self.autocast_context(), self.inference_lock:
            session_id = request.session_id
            frame_idx = request.frame_index
            obj_id = request.object_id
            rle_mask = {
                "counts": request.mask.counts,
                "size": request.mask.size,
            }

            mask = decode_masks(rle_mask)

            logger.info(
                f"add mask on frame {frame_idx} in session {session_id}: {obj_id=}, {mask.shape=}"
            )
            session = self.__get_session(session_id)
            inference_state = session["state"]

            frame_idx, obj_ids, video_res_masks = self.model.add_new_mask(
                inference_state=inference_state,
                frame_idx=frame_idx,
                obj_id=obj_id,
                mask=torch.tensor(mask > 0),
            )
            masks_binary = (video_res_masks > self.score_thresh)[:, 0].cpu().numpy()

            rle_mask_list = self.__get_rle_mask_list(
                object_ids=obj_ids, masks=masks_binary
            )

            return PropagateDataResponse(
                frame_index=frame_idx,
                results=rle_mask_list,
            )

    def clear_points_in_frame(
        self, request: ClearPointsInFrameRequest
    ) -> PropagateDataResponse:
        """
        Remove all input points in a specific frame.
        """
        with self.autocast_context(), self.inference_lock:
            session_id = request.session_id
            frame_idx = request.frame_index
            obj_id = request.object_id

            logger.info(
                f"clear inputs on frame {frame_idx} in session {session_id}: {obj_id=}"
            )
            session = self.__get_session(session_id)
            inference_state = session["state"]
            frame_idx, obj_ids, video_res_masks = (
                self.predictor.clear_all_prompts_in_frame(
                    inference_state, frame_idx, obj_id
                )
            )
            masks_binary = (video_res_masks > self.score_thresh)[:, 0].cpu().numpy()

            rle_mask_list = self.__get_rle_mask_list(
                object_ids=obj_ids, masks=masks_binary
            )

            return PropagateDataResponse(
                frame_index=frame_idx,
                results=rle_mask_list,
            )

    def clear_points_in_video(
        self, request: ClearPointsInVideoRequest
    ) -> ClearPointsInVideoResponse:
        """
        Remove all input points in all frames throughout the video.
        """
        with self.autocast_context(), self.inference_lock:
            session_id = request.session_id
            logger.info(f"clear all inputs across the video in session {session_id}")
            session = self.__get_session(session_id)
            inference_state = session["state"]
            self.predictor.reset_state(inference_state)
            return ClearPointsInVideoResponse(success=True)

    def remove_object(self, request: RemoveObjectRequest) -> RemoveObjectResponse:
        """
        Remove an object id from the tracking state.
        """
        with self.autocast_context(), self.inference_lock:
            session_id = request.session_id
            obj_id = request.object_id
            logger.info(f"remove object in session {session_id}: {obj_id=}")
            session = self.__get_session(session_id)
            inference_state = session["state"]
            new_obj_ids, updated_frames = self.predictor.remove_object(
                inference_state, obj_id
            )

            results = []
            for frame_index, video_res_masks in updated_frames:
                masks = (video_res_masks > self.score_thresh)[:, 0].cpu().numpy()
                rle_mask_list = self.__get_rle_mask_list(
                    object_ids=new_obj_ids, masks=masks
                )
                results.append(
                    PropagateDataResponse(
                        frame_index=frame_index,
                        results=rle_mask_list,
                    )
                )

            return RemoveObjectResponse(results=results)

    def propagate_in_video(
        self, request: PropagateInVideoRequest
    ) -> Generator[PropagateDataResponse, None, None]:
        session_id = request.session_id
        start_frame_idx = request.start_frame_index
        propagation_direction = "both"
        max_frame_num_to_track = None

        """
        Propagate existing input points in all frames to track the object across video.
        """

        # Note that as this method is a generator, we also need to use autocast_context
        # in caller to this method to ensure that it's called under the correct context
        # (we've added `autocast_context` to `gen_track_with_mask_stream` in app.py).
        with self.autocast_context(), self.inference_lock:
            logger.info(
                f"propagate in video in session {session_id}: "
                f"{propagation_direction=}, {start_frame_idx=}, {max_frame_num_to_track=}"
            )

            try:
                session = self.__get_session(session_id)
                # 更新会话最后活动时间
                session["last_active_time"] = time.time()
                session["canceled"] = False

                inference_state = session["state"]
                if propagation_direction not in ["both", "forward", "backward"]:
                    raise ValueError(
                        f"invalid propagation direction: {propagation_direction}"
                    )

                # 记录处理前的内存使用情况
                pre_mem_stats = self.__get_memory_stats()
                processed_frames = 0

                # First doing the forward propagation
                if propagation_direction in ["both", "forward"]:
                    for outputs in self.predictor.propagate_in_video(
                        inference_state=inference_state,
                        start_frame_idx=start_frame_idx,
                        max_frame_num_to_track=max_frame_num_to_track,
                        reverse=False,
                    ):
                        if session["canceled"]:
                            # 清理资源并返回
                            if self.device.type == "cuda":
                                torch.cuda.empty_cache()
                            return None

                        frame_idx, obj_ids, video_res_masks = outputs
                        # 确保张量移动到CPU
                        masks_binary = (
                            (video_res_masks > self.score_thresh)[:, 0].cpu().numpy()
                        )

                        rle_mask_list = self.__get_rle_mask_list(
                            object_ids=obj_ids, masks=masks_binary
                        )
                        
                        # 显式释放不再需要的张量
                        del video_res_masks
                        processed_frames += 1
                        
                        # 每处理10帧，主动清理一次缓存
                        if processed_frames % 10 == 0 and self.device.type == "cuda":
                            torch.cuda.empty_cache()
                            
                        # 更新会话最后活动时间
                        session["last_active_time"] = time.time()

                        yield PropagateDataResponse(
                            frame_index=frame_idx,
                            results=rle_mask_list,
                        )

                # Then doing the backward propagation (reverse in time)
                if propagation_direction in ["both", "backward"]:
                    for outputs in self.predictor.propagate_in_video(
                        inference_state=inference_state,
                        start_frame_idx=start_frame_idx,
                        max_frame_num_to_track=max_frame_num_to_track,
                        reverse=True,
                    ):
                        if session["canceled"]:
                            # 清理资源并返回
                            if self.device.type == "cuda":
                                torch.cuda.empty_cache()
                            return None

                        frame_idx, obj_ids, video_res_masks = outputs
                        # 确保张量移动到CPU
                        masks_binary = (
                            (video_res_masks > self.score_thresh)[:, 0].cpu().numpy()
                        )

                        rle_mask_list = self.__get_rle_mask_list(
                            object_ids=obj_ids, masks=masks_binary
                        )
                        
                        # 显式释放不再需要的张量
                        del video_res_masks
                        processed_frames += 1
                        
                        # 每处理10帧，主动清理一次缓存
                        if processed_frames % 10 == 0 and self.device.type == "cuda":
                            torch.cuda.empty_cache()
                            
                        # 更新会话最后活动时间
                        session["last_active_time"] = time.time()

                        yield PropagateDataResponse(
                            frame_index=frame_idx,
                            results=rle_mask_list,
                        )
            finally:
                # 处理完成后主动清理GPU缓存
                if self.device.type == "cuda":
                    torch.cuda.empty_cache()
                    
                # Log upon completion (so that e.g. we can see if two propagations happen in parallel).
                # Using `finally` here to log even when the tracking is aborted with GeneratorExit.
                post_mem_stats = self.__get_memory_stats()
                logger.info(
                    f"propagation ended in session {session_id}; processed {processed_frames} frames; "
                    f"memory before: {pre_mem_stats}, after: {post_mem_stats}; {self.__get_session_stats()}"
                )

    def cancel_propagate_in_video(
        self, request: CancelPropagateInVideoRequest
    ) -> CancelPorpagateResponse:
        session = self.__get_session(request.session_id)
        session["canceled"] = True
        return CancelPorpagateResponse(success=True)

    def __get_rle_mask_list(
        self, object_ids: List[int], masks: np.ndarray
    ) -> List[PropagateDataValue]:
        """
        Return a list of data values, i.e. list of object/mask combos.
        """
        return [
            self.__get_mask_for_object(object_id=object_id, mask=mask)
            for object_id, mask in zip(object_ids, masks)
        ]

    def __get_mask_for_object(
        self, object_id: int, mask: np.ndarray
    ) -> PropagateDataValue:
        """
        Create a data value for an object/mask combo.
        """
        mask_rle = encode_masks(np.array(mask, dtype=np.uint8, order="F"))
        mask_rle["counts"] = mask_rle["counts"].decode()
        return PropagateDataValue(
            object_id=object_id,
            mask=Mask(
                size=mask_rle["size"],
                counts=mask_rle["counts"],
            ),
        )

    def __get_session(self, session_id: str):
        session = self.session_states.get(session_id, None)
        if session is None:
            raise RuntimeError(
                f"Cannot find session {session_id}; it might have expired"
            )
        return session

    def __get_memory_stats(self):
        """获取当前内存使用情况的统计信息"""
        if self.device.type == "cuda":
            return {
                "allocated_mb": torch.cuda.memory_allocated() // 1024**2,
                "reserved_mb": torch.cuda.memory_reserved() // 1024**2,
                "max_allocated_mb": torch.cuda.max_memory_allocated() // 1024**2,
                "max_reserved_mb": torch.cuda.max_memory_reserved() // 1024**2
            }
        else:
            return {"device": self.device.type, "stats": "not available"}
    
    def __get_session_stats(self):
        """Get a statistics string for live sessions and their GPU usage."""
        # print both the session ids and their video frame numbers
        live_session_strs = []
        for session_id, session in self.session_states.items():
            last_active = time.time() - session.get("last_active_time", 0)
            offload_status = "offloaded" if session.get("offload_video_to_cpu", False) else "on GPU"
            live_session_strs.append(
                f"'{session_id}' ({session['state']['num_frames']} frames, "
                f"{len(session['state']['obj_ids'])} objects, "
                f"last active: {last_active:.1f}s ago, frames: {offload_status})"
            )
            
        mem_stats = self.__get_memory_stats()
        if self.device.type == "cuda":
            session_stats_str = (
                f"live sessions: [{', '.join(live_session_strs)}], GPU memory: "
                f"{mem_stats['allocated_mb']} MiB used and "
                f"{mem_stats['reserved_mb']} MiB reserved"
                f" (max over time: {mem_stats['max_allocated_mb']} MiB used "
                f"and {mem_stats['max_reserved_mb']} MiB reserved)"
            )
        else:
            session_stats_str = f"live sessions: [{', '.join(live_session_strs)}], Device: {self.device.type}"
            
        return session_stats_str

    def __clear_session_state(self, session_id: str, reason: str = "user_request") -> bool:
        session = self.session_states.pop(session_id, None)
        if session is None:
            logger.warning(
                f"cannot close session {session_id} as it does not exist (it might have expired); "
                f"{self.__get_session_stats()}"
            )
            return False
        else:
            # 获取清理前的内存统计
            pre_mem_stats = self.__get_memory_stats()
            
            # 显式清理会话中的资源
            if "state" in session:
                # 尝试释放会话状态中的所有张量
                for key, value in session["state"].items():
                    if isinstance(value, torch.Tensor):
                        del value
                del session["state"]
            
            # 强制进行垃圾回收
            gc.collect()
            if self.device.type == "cuda":
                torch.cuda.empty_cache()
            
            # 获取清理后的内存统计
            post_mem_stats = self.__get_memory_stats()
            
            logger.info(
                f"removed session {session_id} (reason: {reason}); "
                f"memory before: {pre_mem_stats}, after: {post_mem_stats}; "
                f"{self.__get_session_stats()}"
            )
            return True
