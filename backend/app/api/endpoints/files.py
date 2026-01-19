from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
import os
from typing import List, Optional
from pydantic import BaseModel

class FileNode(BaseModel):
    title: str          #文件名
    key: str            # 核心：相对路径作为 Key
    isLeaf: bool        # True=文件, False=文件夹
    fileSize: Optional[int] = None
    icon: str           # 辅助字段，告诉前端用什么图标

VALID_EXTENSIONS = {".png", ".pdf", ".html", ".svg", ".jpeg", ".jpg"}

# 优化后的检查函数：只看当前层，或者使用 fast scan
# 现在的逻辑是：不预先检查文件夹是否包含有效文件。
# 原因：为了性能。如果文件夹是空的，用户点开发现是空的即可。
# 预先检查太耗时了。

router = APIRouter()

@router.get("/files/list", response_model=List[FileNode])
def list_files(
    workflow_id: str, 
    path: str = Query("", description="Parent directory path (relative)")
):
    # 1. 获取 Workflow 的根目录 (假设你有这个 helper function)
    # root_dir = get_flowo_directory(workflow_id) 
    root_dir = Path("/work_dir/projects/flowo_v1") # 示例
    
    # 2. 安全构建目标路径
    target_path = (root_dir / path).resolve()
    
    # 防止路径逃逸 (比如 path="../../etc")
    if not str(target_path).startswith(str(root_dir)):
        raise HTTPException(status_code=403, detail="Access denied")
        
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    nodes = []
    
    # 3. 只需要扫描当前这一层 (Iterdir)
    # 不需要递归！不需要 rglob！速度极快。
    try:
        with os.scandir(target_path) as entries:
            for entry in entries:
                # 过滤隐藏文件
                if entry.name.startswith('.'): continue
                
                is_dir = entry.is_dir()
                
                # 如果是文件，检查后缀
                if not is_dir:
                    ext = os.path.splitext(entry.name)[1].lower()
                    if ext not in VALID_EXTENSIONS:
                        continue
                
                # 构造 Key：如果是根目录，key就是文件名；否则是 "父路径/文件名"
                # 注意使用 forward slash '/' 保证全平台兼容
                relative_key = f"{path}/{entry.name}" if path else entry.name
                if relative_key.startswith("/"): relative_key = relative_key[1:]

                nodes.append({
                    "title": entry.name,
                    "key": relative_key,   # 前端拿到这个直接可以去下载
                    "isLeaf": not is_dir,  # 文件夹 isLeaf=False，这样前端会显示展开三角
                    "fileSize": entry.stat().st_size if not is_dir else None,
                    "icon": "folder" if is_dir else "file"
                })
                
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    # 4. 排序：文件夹排前面，文件排后面，按名称排序
    nodes.sort(key=lambda x: (x['isLeaf'], x['title'].lower()))
    
    return nodes