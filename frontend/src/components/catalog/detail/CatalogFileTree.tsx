import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { NodeRendererProps } from 'react-arborist';
import { Tree } from 'react-arborist';

import {
  CodeOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PushpinOutlined,
  SettingOutlined,
} from '@ant-design/icons';

import type { CatalogDetail, CatalogFileInfo } from '@/client/types.gen';

const FILE_ICON_MAP: Record<string, React.ReactNode> = {
  Snakefile: <PushpinOutlined style={{ color: '#10b981' }} />,
  '.smk': <CodeOutlined style={{ color: '#10b981' }} />,
  '.py': <CodeOutlined style={{ color: '#3b82f6' }} />,
  '.yaml': <SettingOutlined style={{ color: '#8b5cf6' }} />,
  '.yml': <SettingOutlined style={{ color: '#8b5cf6' }} />,
  '.ipynb': <ExperimentOutlined style={{ color: '#f59e0b' }} />,
  '.rst': <FileTextOutlined style={{ color: '#64748b' }} />,
  '.md': <FileTextOutlined style={{ color: '#3b82f6' }} />,
};

export type CatalogArboristNode = {
  id: string;
  name: string;
  isFile: boolean;
  children?: CatalogArboristNode[];
};

function fileLeafIcon(name: string): React.ReactNode {
  const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
  return (
    FILE_ICON_MAP[name] ||
    FILE_ICON_MAP[ext] || <FileTextOutlined style={{ color: '#8c8c8c' }} />
  );
}

function buildNestedTree(files: CatalogFileInfo[]): CatalogArboristNode[] {
  const root: CatalogArboristNode[] = [];
  const map: Record<string, CatalogArboristNode> = {};

  for (const file of files) {
    if (file.path.startsWith('.snakemake/') || file.path === '.snakemake') {
      continue;
    }
    const parts = file.path.split('/');
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const isFile = isLast && !file.is_dir;
      const prevPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!map[currentPath]) {
        const node: CatalogArboristNode = {
          id: currentPath,
          name: part,
          isFile,
          ...(isFile ? {} : { children: [] }),
        };
        map[currentPath] = node;

        if (!prevPath) {
          root.push(node);
        } else {
          const parent = map[prevPath];
          if (!parent.children) parent.children = [];
          parent.children.push(node);
        }
      }
    }
  }

  const sortNodes = (nodes: CatalogArboristNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => n.children?.length && sortNodes(n.children));
  };

  sortNodes(root);
  return root;
}

interface Props {
  catalog: CatalogDetail;
  catalogRef: string;
  onOpenFile: (path: string) => void;
}

const CatalogFileTree: React.FC<Props> = ({
  catalog,
  catalogRef,
  onOpenFile,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 300, height: 400 });

  const treeData = useMemo(() => {
    if (!catalog?.files?.length) return [];
    return buildNestedTree(catalog.files as unknown as CatalogFileInfo[]);
  }, [catalog.files]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.max(100, el.clientWidth);
      const h = Math.max(120, el.clientHeight);
      setSize({ width: w, height: h });
    });
    ro.observe(el);
    setSize({
      width: Math.max(100, el.clientWidth),
      height: Math.max(120, el.clientHeight),
    });
    return () => ro.disconnect();
  }, []);

  const CatalogRow = ({
    node,
    style,
    dragHandle,
  }: NodeRendererProps<CatalogArboristNode>) => {
    return (
      <div
        ref={dragHandle}
        style={style}
        className="group mx-0.5 flex min-w-0 items-center justify-between gap-2 rounded-md py-0.5 pr-1 pl-0.5 hover:bg-slate-100 data-[selected=true]:bg-indigo-50/90"
        data-selected={node.isSelected ? 'true' : 'false'}
      >
        <span className="inline-flex min-w-0 flex-1 select-none items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap pl-1">
          {node.data.isFile ? (
            fileLeafIcon(node.data.name)
          ) : node.isOpen ? (
            <FolderOpenOutlined style={{ color: '#595959' }} />
          ) : (
            <FolderOutlined style={{ color: '#595959' }} />
          )}
          <span>{node.data.name}</span>
        </span>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200/90 bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-slate-500">
          Files
        </span>
      </div>

      <div className="relative box-border min-h-0 w-full flex-1 px-2 pb-2 pt-0.5">
        <div className="relative h-full min-h-0 w-full" ref={wrapRef}>
          <Tree<CatalogArboristNode>
            key={`${catalogRef}-ro`}
            className="text-sm font-sans leading-snug"
            data={treeData}
            width={size.width}
            height={size.height}
            indent={16}
            rowHeight={34}
            openByDefault={false}
            disableDrag
            disableDrop
            disableEdit
            overscanCount={8}
            onActivate={(node) => {
              if (node.data.isFile) {
                onOpenFile(node.id);
              } else {
                node.toggle();
              }
            }}
          >
            {CatalogRow}
          </Tree>
        </div>
      </div>
    </div>
  );
};

export default CatalogFileTree;
