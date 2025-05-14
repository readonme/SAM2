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
from typing import Any, Dict, Generator, List, Optional, Tuple
import gc
import json

import numpy as np
import torch
from app_conf import APP_ROOT, MODEL_SIZE
from data.queue_manager import QueueManager
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
    QueueStatusRequest,
    QueueStatusResponse,
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
        
        # 会话队列相关配置
        self.max_concurrent_sessions = 5  # 最大并发会话数
        self.session_queue = []  # 等待处理的会话队列 [(session_id, request_data, enqueue_time)]
        self.queue_lock = Lock()  # 队列锁
        self.active_sessions = set()  # 当前活跃的会话ID集合
        self.session_metadata = {}  # 存储会话元数据，包括排队时间、视频路径等
        self.avg_processing_time = 60  # 平均处理时间（秒），初始值为60秒
        
        # 初始化队列管理器
        self.queue_manager = QueueManager()
        
        # 从文件恢复队列状态
        self._restore_queue_state()

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

        # 完成初始化后处理队列
        self._process_queue()

    def autocast_context(self):
        if self.device.type == "cuda":
            return torch.autocast("cuda", dtype=torch.bfloat16)
        else:
            return contextlib.nullcontext()
            
    def _persist_queue_state(self, already_has_lock=False):
        """将排队中的会话持久化到文件
        
        Args:
            already_has_lock: 是否已经持有queue_lock锁，避免重复加锁导致死锁
        """
        if already_has_lock:
            # 调用方已持有锁，直接执行保存操作
            self.queue_manager.save_queue(self.session_queue)
        else:
            # 调用方未持有锁，需要获取锁
            with self.queue_lock:
                # 只保存排队中的会话数据
                self.queue_manager.save_queue(self.session_queue)
        
        logger.debug("排队会话数据已持久化到文件")
        
    def _restore_queue_state(self):
        """从文件恢复排队中的会话"""
        try:
            # 从文件加载队列数据
            loaded_queue = self.queue_manager.load_queue()
            
            if not loaded_queue:
                logger.info("没有可恢复的队列数据")
                return
                
            # 恢复队列和元数据
            restored_queue = []
            
            for session_id, request_data, enqueue_time in loaded_queue:
                # 根据请求数据创建相应的请求对象
                # 检查请求数据类型
                if isinstance(request_data, dict) and 'path' in request_data:
                    # 恢复 StartSessionRequest
                    request = StartSessionRequest(
                        type="start_session",  # 添加必需的type参数
                        session_id=session_id,
                        path=request_data.get('path', ''),
                    )
                    
                    # 恢复视频元数据（如果有）
                    if 'video_metadata' in request_data and request_data['video_metadata']:
                        video_meta = request_data['video_metadata']
                        if isinstance(video_meta, dict):
                            request.video_metadata = VideoMetadata(
                                width=video_meta.get('width', 0),
                                height=video_meta.get('height', 0),
                                fps=video_meta.get('fps', 0),
                                frame_count=video_meta.get('frame_count', 0),
                            )
                    
                    # 恢复会话元数据
                    if session_id not in self.session_metadata:
                        self.session_metadata[session_id] = {
                            'path': request.path,
                            'enqueue_time': enqueue_time,
                            'status': 'queued',
                            'video_metadata': request.video_metadata if hasattr(request, 'video_metadata') else None
                        }
                        
                    # 添加到恢复队列
                    restored_queue.append((session_id, request, enqueue_time))
                else:
                    # 如果无法识别请求类型，跳过该条记录
                    logger.warning(f"无法识别的请求数据格式: {request_data}，跳过恢复")
                    continue
            
            self.session_queue = restored_queue
            logger.info(f"已从文件恢复排队会话数据，共 {len(self.session_queue)} 条记录")
            
            # 注意：不在这里直接处理队列，而是在完全初始化后处理
            # 在__init__方法结束时处理队列
            
        except Exception as e:
            logger.error(f"恢复队列状态失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
    
    def _check_and_cleanup_sessions(self, force=False):
        """检查并清理过期的会话"""
        current_time = time.time()
        queue_updated = False
        expired_sessions = []
        
        logger.info(f"开始检查会话超时状态，当前时间: {current_time}")
        logger.info(f"当前有 {len(self.session_states)} 个会话状态，{len(self.active_sessions)} 个活跃会话，{len(self.session_queue)} 个排队会话")
            
        # 首先获取需要清理的会话列表，减少锁的持有时间
        with self.cleanup_lock:
            logger.info("获取清理锁，检查超时会话")
            for session_id, session in list(self.session_states.items()):
                # 检查会话是否已超时
                last_active_time = session.get('last_active_time', 0)
                inactive_time = current_time - last_active_time
                if inactive_time > self.session_timeout:
                    expired_sessions.append(session_id)
                    logger.info(f"会话 {session_id} 已超时，上次活动时间: {last_active_time}，不活动时间: {inactive_time:.2f}秒")
        
        # 如果没有过期会话，直接返回
        if not expired_sessions:
            logger.info("没有发现超时会话，清理结束")
            return
        
        logger.info(f"发现 {len(expired_sessions)} 个超时会话，开始清理")
            
        # 清理过期会话
        for session_id in expired_sessions:
            logger.info(f"清理超时会话: {session_id}")
            # 检查是否在队列中，使用小粒度锁
            with self.queue_lock:
                logger.info(f"获取队列锁，检查会话 {session_id} 是否在队列中")
                # 检查并从队列中移除
                for i, (queued_id, _, _) in enumerate(self.session_queue):
                    if queued_id == session_id:
                        self.session_queue.pop(i)
                        queue_updated = True
                        logger.info(f"从队列中移除超时会话 {session_id}，位置: {i}")
                        break
                
                # 从活跃会话集合中移除
                if session_id in self.active_sessions:
                    self.active_sessions.remove(session_id)
                    logger.info(f"从活跃会话集合中移除超时会话 {session_id}")
                    # 如果从活跃会话中移除，也需要触发队列处理
                    queue_updated = True
            
            # 在锁外清理会话状态
            logger.info(f"清理会话 {session_id} 的状态")
            self.__clear_session_state(session_id, reason="timeout")
        
        # 更新最后清理时间并触发垃圾回收
        with self.cleanup_lock:
            logger.info("获取清理锁，更新最后清理时间并触发垃圾回收")
            self.last_cleanup_time = current_time
            
            # 主动触发垃圾回收
            logger.info("触发垃圾回收")
            gc.collect()
            if self.device.type == "cuda":
                logger.info("清理CUDA缓存")
                torch.cuda.empty_cache()
                
            logger.info(f"会话清理完成。已移除 {len(expired_sessions)} 个超时会话; {self.__get_session_stats()}")
        
        # 如果队列有更新，持久化队列状态
        if queue_updated:
            logger.info("队列已更新，准备持久化队列状态")
            with self.queue_lock:
                logger.info("获取队列锁，持久化队列状态")
                self._persist_queue_state(already_has_lock=True)
            
        # 在锁外处理队列中的会话
        if queue_updated:
            logger.info("队列已更新，开始处理队列")
            self._process_queue()
        
    def _process_queue(self):
        """处理队列中的会话，如果有空闲资源则启动下一个会话"""
        with self.queue_lock:
            # 如果没有等待的会话或已达到最大并发数，则直接返回
            if not self.session_queue or len(self.active_sessions) >= self.max_concurrent_sessions:
                return
                
            # 获取队列中的下一个会话
            session_id, request_data, enqueue_time = self.session_queue.pop(0)
            
            # 检查会话是否已存在（可能是由于某些原因已经被处理）
            if session_id in self.active_sessions or session_id not in self.session_metadata:
                logger.warning(f"Session {session_id} already processed or metadata missing")
                # 继续处理下一个会话
                # 注意：这里递归调用可能导致栈溢出，改为在锁释放后启动新线程处理
                Thread(target=self._process_queue, daemon=True).start()
                return
                
            # 将会话添加到活跃会话集合
            self.active_sessions.add(session_id)
            
            # 更新会话元数据
            self.session_metadata[session_id]['status'] = 'processing'
            self.session_metadata[session_id]['processing_start_time'] = time.time()
            
            # 队列已修改，触发持久化（传递already_has_lock=True表示已持有锁）
            self._persist_queue_state(already_has_lock=True)
        
        # 在锁外启动异步处理会话线程，避免长时间占用锁
        Thread(target=self._process_session, args=(session_id, request_data), daemon=True).start()
            
        logger.info(f"Started processing session {session_id} from queue; {len(self.session_queue)} sessions remaining in queue")
            
    def _process_session(self, session_id, request_data):
        """异步处理会话"""
        try:
            # 获取视频路径
            video_path = request_data.path
            
            with self.autocast_context(), self.inference_lock:
                # 对于所有设备类型，默认都将视频帧卸载到CPU，避免GPU内存碎片和泄露
                offload_video_to_cpu = True
                if hasattr(request_data, 'keep_frames_on_gpu') and request_data.keep_frames_on_gpu:
                    offload_video_to_cpu = self.device.type != "cuda"
                    
                # 初始化会话状态
                inference_state = self.predictor.init_state(
                    video_path,
                    offload_video_to_cpu=offload_video_to_cpu,
                )
                
                # 保存会话状态
                self.session_states[session_id] = {
                    "canceled": False,
                    "state": inference_state,
                    "last_active_time": time.time(),
                    "offload_video_to_cpu": offload_video_to_cpu
                }
                
                # 更新处理时间统计
                processing_time = time.time() - self.session_metadata[session_id]['processing_start_time']
                self.session_metadata[session_id]['processing_time'] = processing_time
                
                # 更新平均处理时间（使用移动平均）
                self.avg_processing_time = 0.7 * self.avg_processing_time + 0.3 * processing_time
                
                logger.info(f"Completed processing session {session_id}; Processing time: {processing_time:.2f}s; New avg time: {self.avg_processing_time:.2f}s")
                
        except Exception as e:
            logger.error(f"Error processing session {session_id}: {e}")
            # 从活跃会话中移除
            with self.queue_lock:
                if session_id in self.active_sessions:
                    self.active_sessions.remove(session_id)
                # 更新会话元数据
                if session_id in self.session_metadata:
                    self.session_metadata[session_id]['status'] = 'error'
                    self.session_metadata[session_id]['error'] = str(e)
        finally:
            # 处理完成后，尝试处理队列中的下一个会话
            self._process_queue()

    def start_session(self, request: StartSessionRequest) -> StartSessionResponse:
        # 生成会话 ID
        logger.info(f"开始处理会话启动请求")
        if request.session_id:
            session_id = request.session_id
            logger.info(f"使用客户端提供的会话ID: {session_id}")
        else:
            session_id = str(uuid.uuid4())
            logger.info(f"生成新的会话ID: {session_id}")
        
        # 首先检查会话是否已存在，使用小粒度锁
        need_queue = False
        existing_status = None
        enqueue_time = time.time()
        logger.info(f"会话 {session_id} 请求时间: {enqueue_time}")
        
        with self.queue_lock:
            logger.info(f"获取队列锁，检查会话 {session_id} 状态")
            # 检查会话是否已存在
            if session_id in self.session_metadata:
                existing_status = self.session_metadata[session_id]['status']
                logger.info(f"会话 {session_id} 已存在，当前状态: {existing_status}")
                if existing_status in ['processing', 'completed']:
                    # 如果会话已存在且状态为处理中或已完成，直接返回当前状态
                    logger.info(f"会话 {session_id} 已在处理中或已完成，直接返回当前状态")
                    return StartSessionResponse(
                        session_id=session_id,
                        queued=(existing_status == 'queued'),
                        queue_position=0,
                        estimated_wait_time=0
                    )
            
            # 检查是否需要排队
            need_queue = len(self.active_sessions) >= self.max_concurrent_sessions
            logger.info(f"当前活跃会话数: {len(self.active_sessions)}/{self.max_concurrent_sessions}，是否需要排队: {need_queue}")
        
        # 如果需要排队，将会话加入队列
        if need_queue:
            logger.info(f"会话 {session_id} 需要排队，准备加入队列")
            with self.queue_lock:
                logger.info(f"获取队列锁，将会话 {session_id} 加入队列")
                # 创建会话元数据
                self.session_metadata[session_id] = {
                    'path': request.path,
                    'enqueue_time': enqueue_time,
                    'status': 'queued',
                    'video_metadata': request.video_metadata if hasattr(request, 'video_metadata') else None
                }
                logger.info(f"创建会话 {session_id} 元数据，视频路径: {request.path}")
                
                # 将会话加入队列
                self.session_queue.append((session_id, request, enqueue_time))
                queue_position = len(self.session_queue)
                # 估算等待时间（基于队列位置和平均处理时间）
                estimated_wait_time = int(queue_position * self.avg_processing_time)
                logger.info(f"会话 {session_id} 加入队列，位置: {queue_position}，估计等待时间: {estimated_wait_time}秒")
                
                # 队列已修改，触发持久化（传递already_has_lock=True表示已持有锁）
                self._persist_queue_state(already_has_lock=True)
            
            logger.info(f"会话 {session_id} 已成功排队，位置: {queue_position}，估计等待时间: {estimated_wait_time}秒")
            
            return StartSessionResponse(
                session_id=session_id,
                queued=True,
                queue_position=queue_position,
                estimated_wait_time=estimated_wait_time
            )
        else:
            logger.info(f"会话 {session_id} 无需排队，准备立即处理")
            # 直接处理会话，首先更新会话元数据
            with self.queue_lock:
                logger.info(f"获取队列锁，更新会话 {session_id} 元数据")
                self.session_metadata[session_id] = {
                    'path': request.path,
                    'enqueue_time': enqueue_time,
                    'processing_start_time': enqueue_time,
                    'status': 'processing',
                    'video_metadata': request.video_metadata if hasattr(request, 'video_metadata') else None
                }
                logger.info(f"创建会话 {session_id} 元数据，视频路径: {request.path}")
                self.active_sessions.add(session_id)
                logger.info(f"将会话 {session_id} 添加到活跃会话集合，当前活跃会话数: {len(self.active_sessions)}")
            
            # 在锁外启动异步处理线程
            logger.info(f"启动异步线程处理会话 {session_id}")
            Thread(target=self._process_session, args=(session_id, request), daemon=True).start()
            
            logger.info(f"会话 {session_id} 已开始处理; {self.__get_session_stats()}")
            
            return StartSessionResponse(
                session_id=session_id,
                queued=False,
                queue_position=0,
                estimated_wait_time=0
            )

    def close_session(self, request: CloseSessionRequest) -> CloseSessionResponse:
        session_id = request.session_id
        queue_updated = False
        
        logger.info(f"开始关闭会话 {session_id}")
        
        # 首先检查会话是否在队列中
        logger.info(f"检查会话 {session_id} 是否在队列中")
        with self.queue_lock:
            logger.info(f"获取队列锁，准备清理会话 {session_id}")
            # 从队列中移除会话（如果存在）
            for i, (queued_id, _, _) in enumerate(self.session_queue):
                if queued_id == session_id:
                    self.session_queue.pop(i)
                    queue_updated = True
                    logger.info(f"从队列中移除会话 {session_id}，位置: {i}")
                    break
            
            # 从活跃会话集合中移除
            active_session_removed = False
            if session_id in self.active_sessions:
                self.active_sessions.remove(session_id)
                active_session_removed = True
                logger.info(f"从活跃会话集合中移除会话 {session_id}，当前活跃会话数: {len(self.active_sessions)}")
                
            # 更新会话元数据
            if session_id in self.session_metadata:
                self.session_metadata[session_id]['status'] = 'completed'
                logger.info(f"更新会话 {session_id} 元数据状态为 'completed'")
            
            # 队列已修改，触发持久化（传递already_has_lock=True表示已持有锁）
            if queue_updated:
                logger.info(f"队列已更新，触发队列状态持久化")
                self._persist_queue_state(already_has_lock=True)
                logger.info(f"已从队列中移除会话 {session_id}")
        
        # 在锁外启动异步处理队列线程
        # 如果队列更新了或者从活跃会话中移除了会话，都需要触发队列处理
        if queue_updated or active_session_removed:
            logger.info(f"队列已更新或活跃会话已减少，启动异步队列处理线程")
            Thread(target=self._process_queue, daemon=True).start()
        
        # 清理会话状态
        logger.info(f"开始清理会话 {session_id} 的状态")
        is_successful = self.__clear_session_state(session_id)
        logger.info(f"会话 {session_id} 清理状态 {'成功' if is_successful else '失败'}")
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
    
    def get_queue_status(self, request: QueueStatusRequest) -> QueueStatusResponse:
        """获取会话的排队状态"""
        session_id = request.session_id
        
        # 首先获取基本信息，如果会话不存在或不在队列中，可以快速返回
        with self.queue_lock:
            # 检查会话是否存在于元数据中
            if session_id not in self.session_metadata:
                return QueueStatusResponse(
                    session_id=session_id,
                    status='not_found',
                    position=-1,
                    estimated_wait_time=-1
                )
            
            # 获取会话状态
            status = self.session_metadata[session_id]['status']
            
            # 如果会话正在处理或已完成，则位置为0
            if status in ['processing', 'completed', 'error']:
                return QueueStatusResponse(
                    session_id=session_id,
                    status=status,
                    position=0,
                    estimated_wait_time=0
                )
            
            # 如果会话在队列中，复制队列信息以便在锁外计算
            queue_copy = [(q_id, None, None) for q_id, _, _ in self.session_queue]
            avg_processing_time = self.avg_processing_time
        
        # 在锁外计算位置和等待时间
        position = 0
        for i, (queued_id, _, _) in enumerate(queue_copy):
            if queued_id == session_id:
                position = i + 1
                break
        
        # 估算等待时间
        estimated_wait_time = int(position * avg_processing_time)
        
        return QueueStatusResponse(
            session_id=session_id,
            status='queued',
            position=position,
            estimated_wait_time=estimated_wait_time
        )
            
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
            # 即使会话状态不存在，也要从会话元数据中移除
            with self.queue_lock:
                if session_id in self.session_metadata:
                    self.session_metadata[session_id]['status'] = 'completed'
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
