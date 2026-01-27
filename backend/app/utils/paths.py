import os
from pathlib import Path
from pydantic import BaseModel
from app.core.config import settings


class PathContent(BaseModel):
    content: str    
    path: str


class PathResolver:
    def __init__(self):
        self.source_root = settings.FOLWO_WORKING_PATH
        self.current_root = settings.CONTAINER_MOUNT_PATH

    def resolve(self, db_path_str: str) -> Path:
        """
        将数据库中的路径转换为当前环境可访问的路径
        """
        if not db_path_str:
            raise ValueError("Path cannot be empty")

        original_path = Path(db_path_str)

        # 情况 A: 数据库存的是相对路径 
        if not original_path.is_absolute():
            return Path(self.current_root) / original_path

        # 情况 B: 数据库存的是绝对路径
        if self.source_root:
            source_base = Path(self.source_root).resolve()
            try:
                relative_part = original_path.resolve().relative_to(source_base)
                return Path(self.current_root) / relative_part
            except ValueError:
                print(f"CRITICAL: Path {original_path} is outside configured source root {source_base}")
                return original_path 
        
        return original_path

path_resolver = PathResolver()



def get_file_content(file_path: str) -> PathContent:
    resolved_path = path_resolver.resolve(file_path)

    if not resolved_path.exists():
        raise FileNotFoundError(f"File not found: {resolved_path}")

    if not resolved_path.is_file():
        raise IsADirectoryError(f"Path is a directory, not a file: {resolved_path}")

    content = resolved_path.read_text(encoding='utf-8')
    return PathContent(content=content, path=str(resolved_path))