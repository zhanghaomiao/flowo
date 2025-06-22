import { FolderOutlined } from "@ant-design/icons";
import React from "react";

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

// Convert API TreeDataNode to Antd Tree format with filtering and lazy loading support
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
        : node.isLeaf ? undefined : [], // Empty array for directories to enable lazy loading
      isLeaf: node.isLeaf || false,
      fullPath,
      type: node.isLeaf ? "file" : "directory",
      fileExtension,
      nodeData: node, // Store original node data for preview
      loadData: onLoadData && !node.isLeaf ? () => onLoadData({
        title: node.title || "",
        key: node.key || "",
        icon: <FolderOutlined />,
        children: [],
        isLeaf: false,
        fullPath,
        type: "directory",
        fileExtension: "",
        nodeData: node,
      }) : undefined,
    };
  });
};

// Get file extension from filename (duplicate from FileUtils for tree-specific use)
const getFileExtension = (filename: string): string => {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};
