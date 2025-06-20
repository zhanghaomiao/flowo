from ..schemas import TreeDataNode
from anytree import Node, RenderTree
from typing import List
from pathlib import Path

TreeDataNode.model_rebuild()

VALID_EXTENSIONS = {".png", ".pdf", ".html", ".svg", ".jpeg"}


def has_valid_file(path: Path) -> bool:
    try:
        for item in path.rglob("*"):
            if item.is_file() and item.suffix in VALID_EXTENSIONS:
                return True
    except Exception:
        pass
    return False


def build_tree_with_anytree(
    directory_path: str, max_depth: int = 2, visualize: bool = False
) -> List[TreeDataNode]:
    path = Path(directory_path)
    if not path.exists():
        raise FileNotFoundError(f"Directory '{directory_path}' does not exist")
    if not path.is_dir():
        raise NotADirectoryError(f"'{directory_path}' is not a directory")

    root = Node(name=path.name, path=path, key="0", is_dir=True, is_file=False)

    def create_anytree_nodes(
        current_path: Path,
        parent_node: Node,
        current_depth: int = 0,
        parent_key: str = "",
    ):
        if current_depth >= max_depth:
            return

        try:
            items = sorted(
                current_path.iterdir(), key=lambda x: (x.is_file(), x.name.lower())
            )
        except PermissionError:
            return

        for index, item_path in enumerate(items):
            if item_path.name.startswith("."):
                continue

            # 文件必须后缀合法，目录必须包含合法文件
            if item_path.is_file():
                if item_path.suffix.lower() not in VALID_EXTENSIONS:
                    continue
            elif item_path.is_dir():
                if not has_valid_file(item_path):
                    continue

            key = f"{parent_key}-{index}" if parent_key else f"0-{index}"
            node = Node(
                name=item_path.name,
                parent=parent_node,
                path=item_path,
                key=key,
                is_dir=item_path.is_dir(),
                is_file=item_path.is_file(),
            )

            if item_path.is_dir():
                create_anytree_nodes(
                    item_path,
                    parent_node=node,
                    current_depth=current_depth + 1,
                    parent_key=key,
                )

    create_anytree_nodes(path, root, current_depth=0, parent_key="0")

    def convert_anytree_to_tree_data(node: Node) -> TreeDataNode:
        children = (
            [convert_anytree_to_tree_data(child) for child in node.children]
            if node.children
            else None
        )
        is_leaf = not bool(children)
        return TreeDataNode(
            title=node.name,
            key=node.key,
            icon="folder" if node.is_dir else "file",
            children=children,
            isLeaf=is_leaf if is_leaf else None,
        )

    if visualize:
        for pre, _, node in RenderTree(root):
            print(f"{pre}{node.name}")

    return [convert_anytree_to_tree_data(child) for child in root.children]
