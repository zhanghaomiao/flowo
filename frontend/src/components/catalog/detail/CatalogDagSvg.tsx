import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Alert, Button, Spin, Typography } from 'antd';

const { Text, Link } = Typography;

const apiBase = '/api/v1/catalog';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

interface Props {
  /** Catalog slug when ``variant`` is ``catalog`` (default). */
  slug?: string;
  /** ``catalog`` uses ``/{slug}/dag/svg``; ``snake-template`` uses ``/snake-template/dag/svg``. */
  variant?: 'catalog' | 'snake-template';
}

/**
 * On-demand Snakevision DAG: POST to queue generation, poll GET until SVG is ready.
 */
const CatalogDagSvg: React.FC<Props> = ({ slug, variant = 'catalog' }) => {
  const [phase, setPhase] = useState<'boot' | 'polling' | 'ready' | 'error'>(
    'boot',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const pollRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);

  const dagEndpoint = useCallback(() => {
    if (variant === 'snake-template') {
      return `${apiBase}/snake-template/dag/svg`;
    }
    return `${apiBase}/${encodeURIComponent(slug ?? '')}/dag/svg`;
  }, [slug, variant]);

  const releaseBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setImgSrc(null);
  }, []);

  const tryLoadSvg = useCallback(async (): Promise<boolean> => {
    const res = await fetch(dagEndpoint(), {
      headers: authHeaders(),
    });
    if (res.ok) {
      const blob = await res.blob();
      releaseBlob();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setImgSrc(url);
      setPhase('ready');
      setErrorMessage(null);
      return true;
    }
    if (res.status === 500) {
      let msg = 'DAG generation failed';
      try {
        const body = (await res.json()) as { detail?: string };
        if (body?.detail) msg = body.detail;
      } catch {
        msg = await res.text();
      }
      setPhase('error');
      setErrorMessage(msg);
      return true;
    }
    return false;
  }, [dagEndpoint, releaseBlob]);

  useEffect(() => {
    if (variant === 'catalog' && !slug) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setPhase('boot');
      setErrorMessage(null);
      releaseBlob();
      attemptsRef.current = 0;

      const postRes = await fetch(dagEndpoint(), {
        method: 'POST',
        headers: authHeaders(),
      });

      if (cancelled) return;

      if (postRes.status === 204) {
        const ok = await tryLoadSvg();
        if (!cancelled && !ok) {
          setPhase('error');
          setErrorMessage('SVG was reported ready but could not be loaded.');
        }
        return;
      }

      if (postRes.status === 202) {
        setPhase('polling');
        const poll = async () => {
          if (cancelled) return;
          attemptsRef.current += 1;
          if (attemptsRef.current > 90) {
            setPhase('error');
            setErrorMessage('Timed out waiting for DAG. Try again.');
            return;
          }
          const done = await tryLoadSvg();
          if (cancelled || done) return;
          pollRef.current = window.setTimeout(poll, 2000);
        };
        pollRef.current = window.setTimeout(poll, 1500);
        return;
      }

      let msg = `Could not start DAG generation (${postRes.status})`;
      try {
        const body = (await postRes.json()) as { detail?: string };
        if (body?.detail) msg = body.detail;
      } catch {
        /* ignore */
      }
      setPhase('error');
      setErrorMessage(msg);
    };

    void run();

    return () => {
      cancelled = true;
      if (pollRef.current) window.clearTimeout(pollRef.current);
      pollRef.current = null;
      releaseBlob();
    };
  }, [slug, variant, retryNonce, tryLoadSvg, releaseBlob, dagEndpoint]);

  if (phase === 'error' && errorMessage) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 p-6">
        <Alert
          type="error"
          message="DAG preview"
          description={errorMessage}
          showIcon
        />
        <Button
          type="primary"
          onClick={() => {
            setRetryNonce((n) => n + 1);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (phase === 'ready' && imgSrc) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-auto bg-slate-50/80 p-3">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <Text type="secondary" className="text-xs">
            Rule graph (Snakevision SVG)
          </Text>
          <Link href={imgSrc} target="_blank" rel="noreferrer">
            Open in new tab
          </Link>
        </div>
        <div className="flex min-h-0 flex-1 justify-center overflow-auto rounded border border-slate-200 bg-white p-2">
          <img
            src={imgSrc}
            alt="Snakemake rule graph"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 p-8">
      <Spin size="large" />
      <Text type="secondary">
        {phase === 'polling'
          ? 'Generating DAG (Snakevision)…'
          : 'Preparing DAG preview…'}
      </Text>
    </div>
  );
};

export default CatalogDagSvg;
