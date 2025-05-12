# Copyright (c) Meta Platforms, Inc. and affiliates.
# All rights reserved.
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

logger = logging.getLogger(__name__)

class QueueManager:
    """
    简化版队列管理器，只使用一个文件保存排队中的会话
    """
    
    def __init__(self, queue_dir: str = None):
        """
        初始化队列管理器
        
        Args:
            queue_dir: 队列数据存储目录，默认为 data/queue
        """
        if queue_dir is None:
            # 默认使用 data/queue 目录
            self.queue_dir = Path(os.path.dirname(os.path.abspath(__file__))) / "queue"
        else:
            self.queue_dir = Path(queue_dir)
            
        # 确保目录存在
        os.makedirs(self.queue_dir, exist_ok=True)
        
        # 队列文件路径 - 只使用一个文件保存所有排队数据
        self.queue_file = self.queue_dir / "queue_data.json"
        
        logger.info(f"队列管理器初始化完成，数据存储在: {self.queue_file}")
        
    def save_queue(self, session_queue: List[Tuple[str, Any, float]]) -> bool:
        """
        保存排队中的会话到文件
        
        Args:
            session_queue: 会话队列，格式为 [(session_id, request_data, enqueue_time)]
            
        Returns:
            bool: 保存是否成功
        """
        try:
            # 将队列数据转换为可序列化的格式
            serializable_queue = []
            for session_id, request_data, enqueue_time in session_queue:
                # 将请求对象转换为字典
                if hasattr(request_data, "to_dict"):
                    request_dict = request_data.to_dict()
                elif hasattr(request_data, "to_json"):
                    request_dict = json.loads(request_data.to_json())
                else:
                    # 如果没有to_dict方法，尝试使用__dict__
                    request_dict = request_data.__dict__
                
                serializable_queue.append({
                    "session_id": session_id,
                    "request_data": request_dict,
                    "enqueue_time": enqueue_time
                })
            
            # 写入文件
            with open(self.queue_file, 'w') as f:
                json.dump(serializable_queue, f)
                
            logger.debug(f"成功保存队列数据，共 {len(serializable_queue)} 条记录")
            return True
        except Exception as e:
            logger.error(f"保存队列数据失败: {e}")
            return False
    
    def load_queue(self) -> Optional[List[Tuple[str, Dict, float]]]:
        """
        从文件加载排队中的会话
        
        Returns:
            Optional[List[Tuple[str, Dict, float]]]: 会话队列，如果加载失败则返回空列表
        """
        try:
            if not os.path.exists(self.queue_file):
                logger.info(f"队列文件不存在: {self.queue_file}")
                return []
                
            with open(self.queue_file, 'r') as f:
                serialized_queue = json.load(f)
            
            # 将序列化数据转换回队列格式
            # 注意：这里只返回原始数据，不转换回请求对象，由调用者负责转换
            queue = []
            for item in serialized_queue:
                queue.append((
                    item["session_id"],
                    item["request_data"],
                    item["enqueue_time"]
                ))
                
            logger.info(f"成功加载队列数据，共 {len(queue)} 条记录")
            return queue
        except Exception as e:
            logger.error(f"加载队列数据失败: {e}")
            return []
