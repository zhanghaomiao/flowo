import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

import { Alert, Button, Spin, Tooltip, Typography } from 'antd';
import { Maximize, RotateCcw, Search, ZoomIn, ZoomOut } from 'lucide-react';

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
 * Includes interactive Zoom & Pan capabilities.
 */
const CatalogDagSvg: React.FC<Props> = ({ slug, variant = 'catalog' }) => {
  const [phase, setPhase] = useState<'boot' | 'polling' | 'ready' | 'error'>(
    'boot',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [isForced, setIsForced] = useState(false);
  const pollRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);

  const dagEndpoint = useCallback(
    (isPost = false) => {
      let base = apiBase;
      if (variant === 'snake-template') {
        base = `${apiBase}/snake-template/dag/svg`;
      } else {
        base = `${apiBase}/${encodeURIComponent(slug ?? '')}/dag/svg`;
      }
      if (isPost && isForced) {
        return `${base}?force=true`;
      }
      return base;
    },
    [slug, variant, isForced],
  );

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
      setIsForced(false);
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

      const postRes = await fetch(dagEndpoint(true), {
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
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/80 p-3">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Text type="secondary" className="text-xs">
              Rule graph (Snakevision SVG)
            </Text>
            <Button
              size="small"
              type="link"
              className="p-0 text-[11px] font-medium text-indigo-600 hover:text-indigo-500"
              onClick={() => {
                setIsForced(true);
                setRetryNonce((n) => n + 1);
              }}
            >
              Regenerate
            </Button>
          </div>
          <Link href={imgSrc} target="_blank" rel="noreferrer">
            Open in new tab
          </Link>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <TransformWrapper
            initialScale={1}
            centerOnInit={true}
            minScale={0.1}
            maxScale={8}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <React.Fragment>
                {/* Floating controls */}
                <div className="absolute right-4 top-4 z-20 flex flex-col gap-2 rounded-lg bg-white/90 p-1.5 shadow-md backdrop-blur-sm border border-slate-100">
                  <Tooltip title="Zoom In" placement="left">
                    <Button
                      size="small"
                      type="text"
                      icon={<ZoomIn size={16} />}
                      onClick={() => zoomIn()}
                      className="flex items-center justify-center text-slate-600 hover:text-indigo-600"
                    />
                  </Tooltip>
                  <Tooltip title="Zoom Out" placement="left">
                    <Button
                      size="small"
                      type="text"
                      icon={<ZoomOut size={16} />}
                      onClick={() => zoomOut()}
                      className="flex items-center justify-center text-slate-600 hover:text-indigo-600"
                    />
                  </Tooltip>
                  <Tooltip title="Reset View" placement="left">
                    <Button
                      size="small"
                      type="text"
                      icon={<RotateCcw size={16} />}
                      onClick={() => resetTransform()}
                      className="flex items-center justify-center text-slate-600 hover:text-indigo-600"
                    />
                  </Tooltip>
                  <div className="h-px bg-slate-100 mx-1 my-0.5" />
                  <Tooltip title="Fullscreen" placement="left">
                    <Link href={imgSrc} target="_blank">
                      <Button
                        size="small"
                        type="text"
                        icon={<Maximize size={16} />}
                        className="flex items-center justify-center text-slate-600 hover:text-indigo-600"
                      />
                    </Link>
                  </Tooltip>
                </div>

                {/* Mouse interaction hint */}
                <div className="absolute bottom-4 left-4 z-20 pointer-events-none hidden md:block">
                  <div className="flex items-center gap-2 rounded-full bg-slate-900/50 px-3 py-1 text-[10px] text-white backdrop-blur-sm">
                    <Search size={10} />
                    <span>Scroll to zoom · Drag to pan</span>
                  </div>
                </div>

                <TransformComponent
                  wrapperStyle={{
                    width: '100%',
                    height: '100%',
                    cursor: 'grab',
                  }}
                  contentStyle={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div className="flex h-full w-full items-center justify-center p-4">
                    <img
                      src={imgSrc}
                      alt="Snakemake rule graph"
                      className="max-h-full max-w-full select-none"
                      style={{ pointerEvents: 'none' }}
                    />
                  </div>
                </TransformComponent>
              </React.Fragment>
            )}
          </TransformWrapper>
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
