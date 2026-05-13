import { useEffect, useRef, useState } from 'react';

interface PerfMetric {
  label: string;
  value: number; // ms
}

function getColor(ms: number): string {
  if (ms < 500) return '#4ade80'; // green
  if (ms < 1500) return '#facc15'; // yellow
  return '#f87171'; // red
}

export default function PerformanceDashboard() {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<PerfMetric[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const collect = () => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const paints = performance.getEntriesByType('paint');
      const fp = paints.find((p) => p.name === 'first-paint');
      const fcp = paints.find((p) => p.name === 'first-contentful-paint');

      const result: PerfMetric[] = [];

      if (nav) {
        const dns = nav.domainLookupEnd - nav.domainLookupStart;
        const tcp = nav.connectEnd - nav.connectStart;
        const ttfb = nav.responseStart - nav.fetchStart;
        const domReady = nav.domContentLoadedEventEnd - nav.fetchStart;
        const load = nav.loadEventEnd - nav.fetchStart;

        if (dns > 0) result.push({ label: 'DNS Lookup', value: Math.round(dns) });
        if (tcp > 0) result.push({ label: 'TCP Connect', value: Math.round(tcp) });
        result.push({ label: 'TTFB', value: Math.round(ttfb) });
        if (fp) result.push({ label: 'First Paint', value: Math.round(fp.startTime) });
        if (fcp) result.push({ label: 'FCP', value: Math.round(fcp.startTime) });
        result.push({ label: 'DOM Ready', value: Math.round(domReady) });
        result.push({ label: 'Page Load', value: Math.round(load) });
      }

      setMetrics(result);
    };

    // Wait until after load event to ensure all timings are available
    if (document.readyState === 'complete') {
      collect();
    } else {
      window.addEventListener('load', collect, { once: true });
    }

    // Also observe LCP
    let lcpValue = 0;
    let lcpObserver: PerformanceObserver | null = null;
    try {
      lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
        lcpValue = Math.round(last.startTime);
        setMetrics((prev) => {
          const filtered = prev.filter((m) => m.label !== 'LCP');
          return [...filtered, { label: 'LCP', value: lcpValue }];
        });
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // LCP not supported in this browser
    }

    return () => {
      lcpObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const max = metrics.length > 0 ? Math.max(...metrics.map((m) => m.value)) : 1;

  return (
    <>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          background: 'none',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '10px',
          padding: '2px 6px',
          cursor: 'pointer',
          letterSpacing: '0.1em',
          borderRadius: '2px',
          marginLeft: '12px',
          fontFamily: 'inherit',
        }}
        title="Show performance metrics"
      >
        PERF
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            bottom: '36px',
            left: '0',
            right: '0',
            zIndex: 1000,
            background: '#0a0a0a',
            borderTop: '1px solid rgba(255,255,255,0.12)',
            padding: '16px 20px',
            fontFamily: 'monospace',
            fontSize: '11px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: 'rgba(255,255,255,0.8)', letterSpacing: '0.15em', fontSize: '10px' }}>
              LOAD PERFORMANCE
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1,
                padding: '0 4px',
              }}
            >
              ×
            </button>
          </div>

          {metrics.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.3)' }}>Collecting metrics…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {metrics
                .sort((a, b) => a.value - b.value)
                .map((m) => (
                  <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.45)', width: '90px', flexShrink: 0, textAlign: 'right', fontSize: '10px' }}>
                      {m.label}
                    </span>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '2px', height: '10px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.max(2, (m.value / max) * 100)}%`,
                          height: '100%',
                          background: getColor(m.value),
                          borderRadius: '2px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                    <span style={{ color: getColor(m.value), width: '52px', flexShrink: 0, textAlign: 'right' }}>
                      {m.value}ms
                    </span>
                  </div>
                ))}
            </div>
          )}

          <div style={{ marginTop: '12px', display: 'flex', gap: '16px', color: 'rgba(255,255,255,0.25)', fontSize: '9px' }}>
            <span style={{ color: '#4ade80' }}>● &lt;500ms good</span>
            <span style={{ color: '#facc15' }}>● &lt;1500ms ok</span>
            <span style={{ color: '#f87171' }}>● ≥1500ms slow</span>
          </div>
        </div>
      )}
    </>
  );
}
