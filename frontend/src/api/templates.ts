/**
 * Template API module — manual API calls for template management.
 * These will be replaced by auto-generated SDK calls once the OpenAPI client is regenerated.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { client } from '@/client/client.gen';

const TEMPLATES_BASE = '/api/v1/templates';

// ---- Types ----

export interface TemplateFileInfo {
  name: string;
  path: string;
  lines: number;
  size: number;
  modified: string;
}

export interface CategoryInfo {
  dir: string;
  required: boolean;
  extensions: string[];
  count: number;
}

export interface TemplateSummary {
  name: string;
  slug: string;
  description: string;
  version: string;
  owner: string;
  tags: string[];
  is_public: boolean;
  source_url: string;
  created_at: string;
  updated_at: string;
  file_count: number;
  has_snakefile: boolean;
}

export interface TemplateDetail extends TemplateSummary {
  files: Record<string, TemplateFileInfo[]>;
  categories: Record<string, CategoryInfo>;
}

export interface TemplateFileContent {
  path: string;
  name: string;
  content: string;
  language: string;
  lines: number;
  size: number;
}

// ---- Raw API calls ----

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await client.get<T, unknown, false>({
    url,
    security: [{ scheme: 'bearer', type: 'http' }],
  });
  return res.data as T;
}

// ---- React Query Hooks ----

export function useTemplates(search?: string, tags?: string) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (tags) params.set('tags', tags);
  const qs = params.toString();
  const url = qs ? `${TEMPLATES_BASE}?${qs}` : TEMPLATES_BASE;

  return useQuery<TemplateSummary[]>({
    queryKey: ['templates', search, tags],
    queryFn: () => fetchJSON<TemplateSummary[]>(url),
  });
}

export function useTemplate(slug: string) {
  return useQuery<TemplateDetail>({
    queryKey: ['template', slug],
    queryFn: () => fetchJSON<TemplateDetail>(`${TEMPLATES_BASE}/${slug}`),
    enabled: !!slug,
  });
}

export function useTemplateFile(slug: string, filePath: string | null) {
  return useQuery<TemplateFileContent>({
    queryKey: ['template-file', slug, filePath],
    queryFn: () =>
      fetchJSON<TemplateFileContent>(
        `${TEMPLATES_BASE}/${slug}/files/${filePath}`,
      ),
    enabled: !!slug && !!filePath,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      tags?: string[];
    }) => {
      const res = await client.post({
        url: TEMPLATES_BASE,
        body: data,
        security: [{ scheme: 'bearer', type: 'http' }],
        headers: { 'Content-Type': 'application/json' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await client.patch({
        url: `${TEMPLATES_BASE}/${slug}`,
        body: data,
        security: [{ scheme: 'bearer', type: 'http' }],
        headers: { 'Content-Type': 'application/json' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template', slug] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      const res = await client.delete({
        url: `${TEMPLATES_BASE}/${slug}`,
        security: [{ scheme: 'bearer', type: 'http' }],
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useWriteTemplateFile(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { filePath: string; content: string }) => {
      const res = await client.put({
        url: `${TEMPLATES_BASE}/${slug}/files/${data.filePath}`,
        body: { content: data.content },
        security: [{ scheme: 'bearer', type: 'http' }],
        headers: { 'Content-Type': 'application/json' },
      });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['template-file', slug, variables.filePath],
      });
      queryClient.invalidateQueries({ queryKey: ['template', slug] });
    },
  });
}

export function useDeleteTemplateFile(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (filePath: string) => {
      const res = await client.delete({
        url: `${TEMPLATES_BASE}/${slug}/files/${filePath}`,
        security: [{ scheme: 'bearer', type: 'http' }],
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template', slug] });
    },
  });
}

export function useTemplateDag(slug: string, enabled = false) {
  return useQuery({
    queryKey: ['template-dag', slug],
    queryFn: () => fetchJSON<{ success: boolean; error: string | null; dot: string | null }>(`${TEMPLATES_BASE}/${slug}/dag`),
    enabled: !!slug && enabled,
  });
}
