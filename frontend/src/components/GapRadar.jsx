import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AXIS_DESCRIPTIONS = {
  'Opportunity': 'Overall whitespace gap between research and market.',
  'Research': 'Academic momentum and volume of scientific papers.',
  'Product': 'Existing market saturation and active product repositories.',
  'Velocity': 'Speed of emergence based on research acceleration.',
  'Readiness': 'Commercial viability based on current market activity.'
};

function extractMetrics(opp) {
  const score = Number(opp.score ?? 50);
  const researchMatch = opp.summary?.match(/Research signals?:\s*(\d+)/i);
  const productMatch  = opp.summary?.match(/Product signals?:\s*(\d+)/i);
  const rCount = researchMatch ? Number(researchMatch[1]) : 0;
  const pCount = productMatch  ? Number(productMatch[1])  : 0;

  // Derive fixed 5 axes to ensure the radar is always a beautiful pentagon
  const researchVelocity = Math.min(100, Math.max(10, rCount * 15 + 20));
  const productActivity = Math.min(100, Math.max(10, pCount * 20 + 15));
  const velocity = Math.min(100, score * 0.5 + researchVelocity * 0.5);
  const readiness = Math.min(100, score * 0.4 + productActivity * 0.6);

  return [
    { axis: 'Opportunity', value: score },
    { axis: 'Research', value: researchVelocity },
    { axis: 'Product', value: productActivity },
    { axis: 'Velocity', value: velocity },
    { axis: 'Readiness', value: readiness }
  ];
}

/* ── Research Papers Panel ──────────────────────────────────────────────── */
function ResearchPanel({ opp, onClose }) {
  const [papers,  setPapers]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [source,  setSource]  = useState(null);
  const [attempt, setAttempt] = useState(0); // increment to retry

  const domain = opp.domain || opp.title || opp.name || '';
  const score  = Number(opp.score ?? 50);
  const researchMatch = opp.summary?.match(/Research signals?:\s*(\d+)/i);
  const productMatch  = opp.summary?.match(/Product signals?:\s*(\d+)/i);
  const rCount = researchMatch ? Number(researchMatch[1]) : 0;
  const pCount = productMatch  ? Number(productMatch[1])  : 0;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPapers([]);

    const url = `${API_BASE}/papers?query=${encodeURIComponent(domain)}&limit=6`;

    fetch(url)
      .then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || `Server error ${r.status}`);
        return json;
      })
      .then(json => {
        if (cancelled) return;
        // Backend returns { data: Paper[], source: string }
        const items = (json.data || []).filter(p => p.title);
        setPapers(items);
        setSource(json.source || null);
        setLoading(false);
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Unable to load papers. Please try again.');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [domain, attempt]); // re-run on manual retry

  // Gap rationale
  const gapRationale = (() => {
    if (rCount > 5000 && pCount < 1000)  return `Strong academic signal (${rCount.toLocaleString()} papers) with thin product coverage (${pCount.toLocaleString()} repos) — a wide-open commercialisation gap.`;
    if (rCount > 1000 && pCount < 5000)  return `Growing research base (${rCount.toLocaleString()} papers) outpacing market build-out (${pCount.toLocaleString()} repos) — early-mover advantage available.`;
    if (pCount > rCount * 5)             return `High product saturation (${pCount.toLocaleString()} repos) relative to research (${rCount.toLocaleString()} papers) — focus on differentiation.`;
    return `Research volume (${rCount.toLocaleString()}) vs product volume (${pCount.toLocaleString()}) yields an opportunity score of ${score}/100.`;
  })();

  return (
    <div
      style={{
        marginTop: '12px',
        background: 'rgba(28, 14, 6, 0.95)',
        border: '1px solid rgba(220,203,190,0.15)',
        borderRadius: '12px',
        padding: '20px 22px',
        animation: 'fadeSlideUp 300ms cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(220,203,190,0.4)', marginBottom: '4px' }}>● RESEARCH INTELLIGENCE</p>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '600', color: '#DCCBBE' }}>Top Papers — {domain}</h4>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'rgba(220,203,190,0.4)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '2px 6px', borderRadius: '4px', transition: 'color 150ms ease' }}
          onMouseEnter={e => e.target.style.color = '#DCCBBE'}
          onMouseLeave={e => e.target.style.color = 'rgba(220,203,190,0.4)'}
          title="Close"
        >✕</button>
      </div>

      {/* Gap rationale chip */}
      <div style={{ background: 'rgba(220,203,190,0.06)', border: '1px solid rgba(220,203,190,0.12)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>🔍</span>
        <p style={{ fontSize: '11.5px', color: 'rgba(220,203,190,0.65)', lineHeight: '1.6', margin: 0 }}>
          <strong style={{ color: '#DCCBBE' }}>Why this gap scores {score}/100:</strong>&nbsp;{gapRationale}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0', color: 'rgba(220,203,190,0.45)', fontSize: '12px' }}>
          <span style={{ width: 16, height: 16, border: '2px solid rgba(220,203,190,0.2)', borderTopColor: '#DCCBBE', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
          Fetching research papers… (trying Semantic Scholar, arXiv fallback ready)
        </div>
      )}

      {/* Error + retry */}
      {!loading && error && (
        <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '12px', color: '#e05c3a', margin: 0 }}>⚠ {error}</p>
          <button
            onClick={() => setAttempt(a => a + 1)}
            style={{ fontSize: '11px', padding: '4px 12px', background: 'rgba(220,203,190,0.08)', border: '1px solid rgba(220,203,190,0.2)', borderRadius: '6px', color: '#DCCBBE', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'background 150ms ease' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,203,190,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,203,190,0.08)'}
          >↺ Retry</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && papers.length === 0 && (
        <p style={{ fontSize: '12px', color: 'rgba(220,203,190,0.4)', padding: '12px 0' }}>No papers found for this domain.</p>
      )}

      {/* Papers list */}
      {!loading && !error && papers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {papers.map((paper, idx) => {
            // Backend normalizes: { title, authors[], year, abstract, citationCount, url, source }
            const authors  = Array.isArray(paper.authors) ? paper.authors.join(', ') : (paper.authors || '');
            const abstract = paper.abstract ? paper.abstract.slice(0, 200) + (paper.abstract.length > 200 ? '…' : '') : null;

            return (
              <div
                key={paper.id || idx}
                style={{
                  background: 'rgba(220,203,190,0.04)',
                  border: '1px solid rgba(220,203,190,0.09)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  animation: `fadeSlideUp 400ms cubic-bezier(0.16,1,0.3,1) ${idx * 60}ms both`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: '600', color: '#DCCBBE', textDecoration: 'none', lineHeight: '1.4', flex: 1 }}
                    onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                    onMouseLeave={e => e.target.style.textDecoration = 'none'}
                  >
                    {paper.title}
                  </a>
                  {paper.citationCount != null && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(220,203,190,0.5)', background: 'rgba(220,203,190,0.08)', padding: '2px 7px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      ★ {paper.citationCount.toLocaleString()} cited
                    </span>
                  )}
                </div>

                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(220,203,190,0.4)', marginBottom: abstract ? '6px' : 0 }}>
                  {[authors, paper.year].filter(Boolean).join(' · ')}
                </p>

                {abstract && (
                  <p style={{ fontSize: '11.5px', color: 'rgba(220,203,190,0.5)', lineHeight: '1.55', margin: 0 }}>{abstract}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: '10px', color: 'rgba(220,203,190,0.25)', marginTop: '14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
        {source ? `Source: ${source}` : 'Semantic Scholar · arXiv · Open Research Corpus'}
      </p>
    </div>
  );
}

export function GapRadar({ opportunities = [], riskAppetite = 'medium', domains = [], onRemoveDomain }) {
  const [hoveredData, setHoveredData] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const [exploredId, setExploredId] = useState(null);

  const [isAnimating, setIsAnimating] = useState(true);

  const radarData = useMemo(() => {
    if (!opportunities || opportunities.length === 0) {
      return [{
        domain: 'No data',
        metrics: [
          { axis: 'Opportunity', value: 0 },
          { axis: 'Research', value: 0 },
          { axis: 'Product', value: 0 },
          { axis: 'Velocity', value: 0 },
          { axis: 'Readiness', value: 0 }
        ]
      }];
    }
    // Plot up to top 3 domains
    return opportunities.slice(0, 3).map((opp, i) => ({
      domain: opp.domain || opp.title || opp.name || `Signal ${i+1}`,
      metrics: extractMetrics(opp),
      summary: opp.summary,
      score: opp.score
    }));
  }, [opportunities]);

  useEffect(() => {
    setIsAnimating(true);
    const t = setTimeout(() => setIsAnimating(false), 50);
    return () => clearTimeout(t);
  }, [radarData]);

  const width = 560;
  const height = 420;
  const radius = Math.min(width, height) / 2 - 60;
  const centerX = width / 2;
  const centerY = height / 2 + 10;
  
  const axesLabels = ['Opportunity', 'Research', 'Product', 'Velocity', 'Readiness'];
  const angleStep = (Math.PI * 2) / axesLabels.length;
  const maxScore = 100;

  const line = d3.lineRadial()
    .radius(d => (d.value / maxScore) * radius)
    .angle((_, i) => i * angleStep)
    .curve(d3.curveLinearClosed);

  return (
    <div className="relative rounded-[24px] p-6" style={{ position: "relative", background: "#5a3d28", border: "1px solid rgba(220,203,190,0.12)", boxShadow: "0 8px 32px rgba(42,20,8,0.25)" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: "700", color: "#DCCBBE", marginBottom: "4px" }}>Market Landscape</h2>
        <p style={{ fontSize: "13px", color: "rgba(220,203,190,0.6)", marginBottom: '14px' }}>
          Multi-dimensional analysis for your tracked domains.
        </p>

        {/* ── Domain Token Pills — source of truth: Supabase profiles.tracked_domains ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '32px' }}>
          {domains.length === 0 ? (
            <span style={{
              fontSize: '12px',
              color: 'rgba(245,213,184,0.35)',
              fontFamily: 'var(--font-mono)',
              fontStyle: 'italic',
              letterSpacing: '0.04em',
            }}>No domains tracked — add one in the sidebar</span>
          ) : (
            domains.map((domain) => (
              <span
                key={domain}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(245,213,184,0.35)',
                  background: 'rgba(245,213,184,0.07)',
                  color: '#F5D5B8',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11.5px',
                  fontWeight: '500',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  transition: 'background 150ms ease, border-color 150ms ease',
                  cursor: 'default',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,213,184,0.13)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,213,184,0.07)'}
              >
                {domain}
                {onRemoveDomain && (
                  <button
                    onClick={() => onRemoveDomain(domain)}
                    title={`Remove ${domain}`}
                    aria-label={`Remove ${domain}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(245,213,184,0.45)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      lineHeight: 1,
                      padding: '0 0 0 2px',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'color 150ms ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#F5D5B8'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(245,213,184,0.45)'}
                  >×</button>
                )}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="relative" style={{ width: '100%', maxWidth: '560px', margin: '0 auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <radialGradient id="radarRingGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(220,203,190,0.15)" />
              <stop offset="100%" stopColor="rgba(220,203,190,0.02)" />
            </radialGradient>

            <radialGradient id="fill-0" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(220,203,190,0.22)" />
              <stop offset="100%" stopColor="rgba(220,203,190,0.04)" />
            </radialGradient>
            <radialGradient id="fill-1" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(200, 170, 120, 0.20)" />
              <stop offset="100%" stopColor="rgba(200, 170, 120, 0.04)" />
            </radialGradient>
            <radialGradient id="fill-2" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(168, 133, 106, 0.20)" />
              <stop offset="100%" stopColor="rgba(168, 133, 106, 0.04)" />
            </radialGradient>

            <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={`translate(${centerX}, ${centerY})`}>
            {/* Concentric rings */}
            {[0.25, 0.5, 0.75, 1].map((fraction, i) => (
              <circle
                key={`ring-${fraction}`}
                r={radius * fraction}
                  fill="none"
                  stroke="rgba(117, 86, 63, 0.12)"
                  strokeWidth={0.75}
                style={{
                  opacity: isAnimating ? 0 : 1,
                  transition: `opacity 600ms ease ${i * 100}ms`
                }}
              />
            ))}

            {radarData[0].domain === 'No data' ? (
              <text fill="var(--tw-colors-mist, #7a93b0)" fontSize="14" textAnchor="middle">
                No discovery data yet
              </text>
            ) : (
              <>
                {/* Axes and labels */}
                {axesLabels.map((axis, i) => {
                  const angle = i * angleStep - Math.PI / 2;
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;
                  
                  const labelRadius = radius + 35;
                  const labelX = Math.cos(angle) * labelRadius;
                  const labelY = Math.sin(angle) * labelRadius;
                  const labelWidth = axis.length * 8 + 16;

                  return (
                    <g key={`axis-${i}`}>
                      <line x1={0} y1={0} x2={x} y2={y} stroke="rgba(220, 203, 190, 0.12)" strokeWidth={0.5} />
                      <g transform={`translate(${labelX}, ${labelY})`}>
                        <rect x={-(labelWidth / 2)} y={-12} width={labelWidth} height={24} fill="rgba(60,35,18,0.85)" rx={4} />
                        <text
                          fill="#DCCBBE"
                          fontFamily="var(--font-display)"
                          fontSize="13px"
                          textAnchor="middle"
                          alignmentBaseline="middle"
                        >  {axis}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* Radar paths */}
                {/* We reverse so the top domain (index 0) renders last and sits on top */}
                {[...radarData].reverse().map((dItem) => {
                  const reverseIdx = radarData.indexOf(dItem);
                  const color = reverseIdx === 0 ? "var(--amber)" : reverseIdx === 1 ? "#7a93b0" : "#a86a42";
                  const fill = `url(#fill-${reverseIdx})`;
                  const pathString = line(dItem.metrics);
                  
                  // Calculate raw length approx for animation or just use opacity
                  // We'll use opacity for smoother multi-polygon transitions
                  
                  return (
                    <g key={`path-${reverseIdx}`}>
                      <path
                        d={pathString}
                        stroke={color}
                        strokeWidth={1.5}
                        strokeOpacity={0.9}
                        style={{
                          fill: fill,
                          opacity: isAnimating ? 0 : 1,
                          transform: isAnimating ? "scale(0.8)" : "scale(1)",
                          transformOrigin: "center",
                          transition: "opacity 600ms ease, transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)"
                        }}
                      />
                      
                      {/* Data dots */}
                      {dItem.metrics.map((m, i) => {
                        const angle = i * angleStep - Math.PI / 2;
                        const cx = Math.cos(angle) * ((m.value / maxScore) * radius);
                        const cy = Math.sin(angle) * ((m.value / maxScore) * radius);
                        return (
                          <g
                            key={`dot-${reverseIdx}-${i}`}
                            transform={`translate(${cx}, ${cy})`}
                            onMouseEnter={() => {
                                setHoveredData({ domain: dItem.domain, metric: m.axis, value: m.value, color, summary: dItem.summary });
                                setTooltipPos({ x: cx + centerX, y: cy + centerY });
                            }}
                            onMouseLeave={() => {
                                setHoveredData(null);
                                setTooltipPos(null);
                            }}
                            style={{ cursor: "pointer", opacity: isAnimating ? 0 : 1, transition: "opacity 300ms ease 400ms" }}
                          >
                            <circle r={8} fill="rgba(60,35,18,0.9)" />
                            <circle r={5.5} fill={color} filter="url(#dotGlow)" />
                          </g>
                        )
                      })}
                    </g>
                  );
                })}
              </>
            )}
          </g>
        </svg>

        {/* Floating Tooltip */}
        {hoveredData && tooltipPos && (
          <div
            className="vs-tooltip animate-fade-up"
            style={{
              position: "absolute",
              left: tooltipPos.x + 16,
              top: tooltipPos.y - 8,
              zIndex: 200,
              pointerEvents: "none",
              background: "rgba(220, 203, 190, 0.95)",
              border: `1px solid ${hoveredData.color}`,
              backdropFilter: "blur(8px)",
              padding: "16px",
              borderRadius: "8px",
              width: "240px",
              boxShadow: "0 8px 32px rgba(117, 86, 63, 0.2)"
            }}
          >
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: hoveredData.color, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "4px" }}>
              {hoveredData.domain}
            </p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: "600", color: "var(--cream)", marginBottom: "12px" }}>
              {hoveredData.metric}
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--fog)" }}>Score</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: hoveredData.color, fontWeight: "500" }}>
                {Math.round(hoveredData.value)}/100
              </span>
            </div>
            <div className="vs-progress-bar" style={{ height: "4px", background: "rgba(220, 203, 190, 0.12)", borderRadius: "2px", overflow: "hidden", marginBottom: "8px" }}>
              <div
                className="vs-progress-bar-fill"
                style={{ width: `${hoveredData.value}%`, height: "100%", background: hoveredData.color, borderRadius: "2px" }}
              />
            </div>

            <p style={{ fontSize: "11px", color: "rgba(60,35,18,0.7)", fontStyle: "italic", marginBottom: "8px", lineHeight: "1.4" }}>
              {AXIS_DESCRIPTIONS[hoveredData.metric]}
            </p>

            <p style={{ fontSize: "11px", color: "rgba(60,35,18,0.6)", lineHeight: "1.5", borderTop: "1px solid rgba(60,35,18,0.1)", paddingTop: "8px" }}>
              {hoveredData.summary}
            </p>
          </div>
        )}
      </div>

      {/* Score Card Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "14px",
          marginTop: "28px",
        }}
      >
        {opportunities.map((opp, i) => {
          const score = Number(opp.score ?? 50);
          const scoreClass = score >= 75 ? "score-high" : score >= 45 ? "score-mid" : "score-low";

          let oppRiskLevel = "low";
          if (score >= 70) oppRiskLevel = "high";
          else if (score >= 40) oppRiskLevel = "medium";

          const isRiskMatch = riskAppetite.toLowerCase() === oppRiskLevel;

          const researchMatch = opp.summary?.match(/Research signals?:\s*(\d+)/i);
          const productMatch  = opp.summary?.match(/Product signals?:\s*(\d+)/i);
          const researchCount = researchMatch ? researchMatch[1] : null;
          const productCount  = productMatch  ? productMatch[1]  : null;

          const domain = opp.domain || opp.title || opp.name || `Signal ${i + 1}`;

          return (
            <div
              key={domain || i}
              style={{
                background: "rgba(40, 22, 10, 0.6)",
                borderTop: isRiskMatch ? "1px solid var(--amber)" : "1px solid rgba(220, 203, 190, 0.10)",
                borderRight: isRiskMatch ? "1px solid var(--amber)" : "1px solid rgba(220, 203, 190, 0.10)",
                borderBottom: isRiskMatch ? "1px solid var(--amber)" : "1px solid rgba(220, 203, 190, 0.10)",
                borderLeft: score >= 75 ? "4px solid #DCCBBE" : score >= 45 ? "4px solid rgba(220,203,190,0.5)" : "4px solid rgba(220,203,190,0.2)",
                borderRadius: "var(--radius-lg)",
                padding: "16px 20px",
                position: "relative",
                overflow: "hidden",
              }}
              className={`animate-fade-up animate-fade-up-d${Math.min(i + 1, 5)}`}
            >
              <h4 style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: "600", color: "#DCCBBE", marginBottom: "6px", paddingLeft: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{domain}</span>
                {isRiskMatch && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", background: "var(--amber)", color: "var(--panel)", padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.05em" }}>
                    ★ Risk Match
                  </span>
                )}
              </h4>

              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", paddingLeft: "10px", marginBottom: "12px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "44px", fontWeight: "500", color: "#DCCBBE", lineHeight: 1 }}>{score}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "rgba(220,203,190,0.5)", fontWeight: "400" }}>/100</span>
              </div>

              <div style={{ marginLeft: "10px", marginBottom: "14px", height: "6px", background: "rgba(220,203,190,0.12)", borderRadius: "9999px", overflow: "hidden" }}>
                <div style={{ width: `${score}%`, height: "100%", background: "linear-gradient(90deg, rgba(220,203,190,0.5), #DCCBBE)", borderRadius: "9999px", transition: "width 600ms cubic-bezier(0.16,1,0.3,1)" }} />
              </div>

              {(researchCount || productCount) && (
                <div style={{ display: "flex", gap: "8px", paddingLeft: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
                  {researchCount && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", padding: "3px 8px", borderRadius: "var(--radius-pill)", background: "rgba(220, 203, 190, 0.10)", color: "#DCCBBE", border: "1px solid rgba(220, 203, 190, 0.2)" }}>
                      📄 {researchCount} research
                    </span>
                  )}
                  {productCount && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", padding: "3px 8px", borderRadius: "var(--radius-pill)", background: "rgba(92, 158, 110, 0.12)", color: "#7ec99a", border: "1px solid rgba(92, 158, 110, 0.25)" }}>
                      ⚡ {productCount} product
                    </span>
                  )}
                </div>
              )}

              <p style={{ fontSize: "12px", color: "rgba(220,203,190,0.55)", paddingLeft: "10px", lineHeight: "1.55", marginBottom: "14px" }}>
                {opp.summary}
              </p>

              <div style={{ paddingLeft: "10px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setExploredId(prev => prev === (domain || i) ? null : (domain || i))}
                  style={{
                    fontSize: "12px",
                    padding: "5px 14px",
                    cursor: "pointer",
                    background: exploredId === (domain || i) ? "rgba(220,203,190,0.12)" : "transparent",
                    border: exploredId === (domain || i) ? "1px solid rgba(220,203,190,0.5)" : "1px solid rgba(220,203,190,0.2)",
                    borderRadius: "var(--radius-md)",
                    color: exploredId === (domain || i) ? "#DCCBBE" : "rgba(220,203,190,0.6)",
                    fontFamily: "var(--font-body)",
                    transition: "all 180ms ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                  onMouseEnter={e => { if (exploredId !== (domain || i)) { e.currentTarget.style.background = 'rgba(220,203,190,0.06)'; e.currentTarget.style.color = '#DCCBBE'; } }}
                  onMouseLeave={e => { if (exploredId !== (domain || i)) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(220,203,190,0.6)'; } }}
                >
                  {exploredId === (domain || i) ? '▾ Collapse' : '▸ Explore Research'}
                </button>
              </div>

              {/* Research panel — injected inline below the card */}
              {exploredId === (domain || i) && (
                <ResearchPanel opp={opp} onClose={() => setExploredId(null)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}