import type {
  CatalogFileContent,
  SnakeTemplateOverview,
  SnakeTemplatePullResponse,
} from '@/client/types.gen';

export const snakeTemplateQueryKey = ['snake-template'] as const;

export type { SnakeTemplateOverview, SnakeTemplatePullResponse };

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchSnakeTemplateOverview(): Promise<SnakeTemplateOverview> {
  const res = await fetch('/api/v1/catalog/snake-template', {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as SnakeTemplateOverview;
}

export async function pullSnakeTemplate(): Promise<SnakeTemplatePullResponse> {
  const res = await fetch('/api/v1/catalog/snake-template/pull', {
    method: 'POST',
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as SnakeTemplatePullResponse;
}

export async function fetchSnakeTemplateFile(
  path: string,
): Promise<CatalogFileContent> {
  const q = new URLSearchParams({ path });
  const res = await fetch(`/api/v1/catalog/snake-template/file?${q}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as CatalogFileContent;
}
