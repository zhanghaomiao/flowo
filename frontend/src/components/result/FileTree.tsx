import { FolderOutlined } from "@ant-design/icons";

import type { TreeDataNode } from "../../api/api";
import { getFileIcon, isSupportedFile } from "./FileUtils";
import type { AntdTreeNode } from "./types";

// Filter tree nodes to only include supported files and directories
// For lazy loading: keep all directories since their children will be loaded later
export const filterSupportedFiles = (
  nodes: (TreeDataNode & { fileSize?: number | null })[],
): (TreeDataNode & { fileSize?: number | null })[] => {
  return nodes
    .map((node) => {
      if (node.isLeaf) {
        // For files, only include if supported
        return isSupportedFile(node.title || "") ? node : null;
      } else {
        // For directories, always include them (children will be loaded later)
        // If children are already loaded, recursively filter them
        const filteredChildren = node.children
          ? filterSupportedFiles(
              node.children as (TreeDataNode & { fileSize?: number | null })[],
            )
          : undefined; // Keep undefined for lazy loading

        return {
          ...node,
          children: filteredChildren,
        };
      }
    })
    .filter(Boolean) as (TreeDataNode & { fileSize?: number | null })[];
};

export const convertToAntdTreeData = (
  nodes: (TreeDataNode & { fileSize?: number | null })[],
  parentPath = "",
  onLoadData?: (node: AntdTreeNode) => Promise<void>,
): AntdTreeNode[] => {
  const filteredNodes = filterSupportedFiles(nodes);

  return filteredNodes.map((node) => {
    const fullPath = parentPath ? `${parentPath}/${node.title}` : node.title;
    const fileExtension = node.isLeaf ? getFileExtension(node.title || "") : "";

    return {
      title: node.title || "",
      key: node.key || "",
      icon: node.isLeaf ? getFileIcon(node.title || "") : <FolderOutlined />,
      children: node.children
        ? convertToAntdTreeData(
            node.children as (TreeDataNode & { fileSize?: number | null })[],
            fullPath,
            onLoadData,
          )
        : node.isLeaf
          ? undefined
          : [], // Empty array for directories to enable lazy loading
      isLeaf: node.isLeaf || false,
      fullPath,
      type: node.isLeaf ? "file" : "directory",
      fileExtension,
      nodeData: node, // Store original node data for preview
      loadData:
        onLoadData && !node.isLeaf
          ? () =>
              onLoadData({
                title: node.title || "",
                key: node.key || "",
                icon: <FolderOutlined />,
                children: [],
                isLeaf: false,
                fullPath,
                type: "directory",
                fileExtension: "",
                nodeData: node,
              })
          : undefined,
    };
  });
};

// Get file extension from filename (duplicate from FileUtils for tree-specific use)
const getFileExtension = (filename: string): string => {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

// Convert array of file paths to tree structure for rule output
export const convertRuleOutputToTreeData = (
  filePaths: string[],
  basepath: string | null = null,
): AntdTreeNode[] => {
  const treeMap = new Map<string, AntdTreeNode>();

  filePaths.forEach((filePath) => {
    const parts = filePath.split("/");
    let currentPath = "";

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const parentPath = currentPath;
      currentPath = parentPath ? `${parentPath}/${part}` : part;

      if (!treeMap.has(currentPath)) {
        const fileExtension = isFile ? getFileExtension(part) : "";

        const node: AntdTreeNode = {
          title: part,
          key: currentPath,
          icon: isFile ? getFileIcon(part) : <FolderOutlined />,
          children: isFile ? undefined : [],
          isLeaf: isFile,
          fullPath: basepath ? `${basepath}/${currentPath}` : currentPath,
          type: isFile ? "file" : "directory",
          fileExtension,
          nodeData: {
            title: part,
            key: currentPath,
            isLeaf: isFile,
            children: isFile ? undefined : [],
            fileSize: null,
          },
        };

        treeMap.set(currentPath, node);

        // Add to parent's children if parent exists
        if (parentPath && treeMap.has(parentPath)) {
          const parent = treeMap.get(parentPath)!;
          if (
            parent.children &&
            !parent.children.some((child) => child.key === currentPath)
          ) {
            parent.children.push(node);
          }
        }
      }
    });
  });

  // Return only root level nodes
  const rootNodes: AntdTreeNode[] = [];
  treeMap.forEach((node, path) => {
    if (!path.includes("/")) {
      rootNodes.push(node);
    }
  });

  return rootNodes;
};
