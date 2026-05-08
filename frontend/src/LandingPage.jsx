import { useEffect, useRef, useState } from "react";
import "./landing.css";

/* ── Intersection-observer reveal hook ───────────────────────────────────── */
function useReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ── Hero canvas — subtle flowing contour lines ──────────────────────────── */
function HeroCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, t = 0;
    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);
    function draw() {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      // Radial amber glow center
      const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, W * 0.55);
      g.addColorStop(0,   "rgba(180, 100, 40, 0.12)");
      g.addColorStop(0.5, "rgba(120, 60, 20, 0.05)");
      g.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // Contour lines
      for (let i = 0; i < 18; i++) {
        const p = i / 18;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(245,213,184,${0.015 + p * 0.025})`;
        ctx.lineWidth = 0.7;
        const yBase = H * 0.2 + p * H * 0.55;
        ctx.moveTo(0, yBase);
        for (let x = 0; x <= W; x += 4) {
          const nx = x / W;
          ctx.lineTo(x,
            yBase
            + Math.sin(nx * Math.PI * 3 + t + i * 0.45) * (20 - i * 0.6)
            + Math.cos(nx * Math.PI * 5 + t * 0.6 + i)  * (8  - i * 0.2)
          );
        }
        ctx.stroke();
      }
      t += 0.004;
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="lp2-hero-canvas" />;
}

/* ── Bento card animated wave ────────────────────────────────────────────── */
function BentoWave({ color = "rgba(245,213,184," }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, t = 0;
    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    function draw() {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < 10; i++) {
        const p = i / 10;
        ctx.beginPath();
        ctx.strokeStyle = `${color}${0.04 + p * 0.06})`;
        ctx.lineWidth = 1.2;
        const yBase = H * 0.3 + p * H * 0.55;
        ctx.moveTo(0, yBase);
        for (let x = 0; x <= W; x += 3) {
          const nx = x / W;
          ctx.lineTo(x,
            yBase
            + Math.sin(nx * Math.PI * 3.5 + t + i * 0.6) * 16
            + Math.cos(nx * Math.PI * 2   + t * 0.7 + i)  * 8
          );
        }
        ctx.stroke();
      }
      t += 0.007;
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [color]);
  return <canvas ref={ref} className="lp2-bento-wave" />;
}

/* ── Sparkline SVG (Investor Velocity) ───────────────────────────────────── */
function Sparkline() {
  const pts = [18, 35, 22, 48, 38, 55, 42, 68, 58, 72, 65, 80];
  const W = 120, H = 48;
  const max = Math.max(...pts), min = Math.min(...pts);
  const scaleY = v => H - ((v - min) / (max - min)) * (H - 8) - 4;
  const scaleX = i => (i / (pts.length - 1)) * W;
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${scaleX(i)},${scaleY(v)}`).join(" ");
  const area = `${d} L${W},${H} L0,${H} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5D5B8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#F5D5B8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={d} stroke="#F5D5B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={scaleX(pts.length - 1)} cy={scaleY(pts[pts.length - 1])} r="3" fill="#F5D5B8" />
    </svg>
  );
}

/* ── Topographic rings (Due Diligence card) ──────────────────────────────── */
function TopoRings() {
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" fill="none" className="lp2-topo-svg">
      {[36, 28, 20, 13, 7].map((r, i) => (
        <ellipse
          key={r} cx="44" cy="44"
          rx={r * 1.55} ry={r}
          stroke={`rgba(245,213,184,${0.1 + i * 0.08})`}
          strokeWidth="1"
          transform={`rotate(-20 44 44)`}
        />
      ))}
      <circle cx="44" cy="44" r="5" fill="rgba(245,213,184,0.6)" />
      <circle cx="44" cy="44" r="9" stroke="rgba(245,213,184,0.25)" strokeWidth="1" />
    </svg>
  );
}

/* ── Animated progress bar ───────────────────────────────────────────────── */
function ProgressBar({ label, pct, visible, delay = 0 }) {
  return (
    <div className="lp2-prog-row">
      <div className="lp2-prog-label">{label}</div>
      <div className="lp2-prog-track">
        <div
          className="lp2-prog-fill"
          style={{
            width: visible ? `${pct}%` : "0%",
            transitionDelay: `${delay}ms`,
          }}
        />
      </div>
      <span className="lp2-prog-pct">{pct}%</span>
    </div>
  );
}

/* ── Main Landing Page ───────────────────────────────────────────────────── */
export default function LandingPage({ onLogin, onSignUp, onEnterApp }) {
  const [heroRef, heroVisible]     = useReveal(0.05);
  const [bentoRef, bentoVisible]   = useReveal(0.08);
  const [engineRef, engineVisible] = useReveal(0.1);
  const [ctaRef, ctaVisible]       = useReveal(0.1);

  return (
    <div className="lp2-root">

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="lp2-nav">
        <div className="lp2-nav-logo">VentureScope</div>
        <div className="lp2-nav-links">
          <button className="lp2-nav-outline" onClick={onLogin}>LOGIN</button>
          <button className="lp2-nav-outline lp2-nav-outline--accent" onClick={onSignUp || onEnterApp}>
            SIGN UP
          </button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="lp2-hero" ref={heroRef}>
        <HeroCanvas />
        <div className={`lp2-hero-inner ${heroVisible ? "lp2-reveal" : ""}`}>
          <p className="lp2-hero-eyebrow">● INTELLIGENCE LAYER FOR FOUNDERS</p>
          <h1 className="lp2-hero-heading">
            The fastest way to<br />
            discover what to<br />
            build next.
          </h1>
          <p className="lp2-hero-sub">
            VentureScope scans research, products, and funding signals to surface<br />
            unmet opportunities before they become crowded.
          </p>
          <button className="lp2-hero-cta" onClick={() =>
            document.getElementById('discovery-section')?.scrollIntoView({ behavior: 'smooth' })
          }>
            START DISCOVERING &nbsp;→
          </button>
        </div>
      </section>

      {/* ── BENTO GRID ───────────────────────────────────────────────────── */}
      <section id="discovery-section" className="lp2-bento-section" ref={bentoRef}>
        <div className={`lp2-bento-grid ${bentoVisible ? "lp2-reveal" : ""}`}>

          {/* Card 1 — ArXiv Pulse (tall, col 1, row 1-2) */}
          <div className="lp2-bento-card lp2-card-arxiv">
            <BentoWave />
            <div className="lp2-card-body">
              <span className="lp2-card-pill">● LIVE</span>
              <h3 className="lp2-card-title">ArXiv Pulse</h3>
              <p className="lp2-card-text">
                Track emerging research breakthroughs before they reach the
                commercialised market. Updated daily.
              </p>
            </div>
          </div>

          {/* Card 2 — Market Saturation (col 2, row 1) */}
          <div className="lp2-bento-card lp2-card-market">
            <div className="lp2-market-tag">● ANALYSIS · EST CLOSE: 2025</div>
            <h3 className="lp2-card-title">Market<br />Saturation.</h3>
            <p className="lp2-card-text">
              Cross-reference multiple investors to find niches while space still exists.
            </p>
            <div className="lp2-market-metrics">
              <div className="lp2-metric">
                <span className="lp2-metric-num">247</span>
                <span className="lp2-metric-lbl">COMPETITORS<br />FOUND</span>
              </div>
              <div className="lp2-metric">
                <span className="lp2-metric-num">89%</span>
                <span className="lp2-metric-lbl">MORE<br />PROFITABLE</span>
              </div>
            </div>
          </div>

          {/* Card 3 — Investor Velocity (col 3, row 1) */}
          <div className="lp2-bento-card lp2-card-velocity">
            <div className="lp2-card-body">
              <span className="lp2-card-pill lp2-card-pill--dim">◎ TRACKING</span>
              <h3 className="lp2-card-title">Investor<br />Velocity</h3>
              <p className="lp2-card-text">
                Follow where capital flows through SEI, STAK, and RSS signals.
              </p>
            </div>
            <div className="lp2-sparkline-wrap">
              <Sparkline />
              <span className="lp2-sparkline-label">↑ 34% YTD momentum</span>
            </div>
          </div>

          {/* Card 4 — Unbiased Due Diligence (col 2-3, row 2) */}
          <div className="lp2-bento-card lp2-card-dd">
            <div className="lp2-dd-body">
              <span className="lp2-card-pill">● INTELLIGENCE</span>
              <h3 className="lp2-card-title">Unbiased Due<br />Diligence</h3>
              <p className="lp2-card-text">
                Remove cognitive bias from your research with hard computational evidence
                and historical pattern matching.
              </p>
            </div>
            <div className="lp2-topo-wrap">
              <TopoRings />
            </div>
          </div>

        </div>
      </section>

      {/* ── DISCOVERY ENGINE ─────────────────────────────────────────────── */}
      <section className="lp2-engine-section" ref={engineRef}>
        <div className={`lp2-engine-grid ${engineVisible ? "lp2-reveal" : ""}`}>

          {/* Left */}
          <div className="lp2-engine-left">
            <p className="lp2-card-pill" style={{ marginBottom: "24px" }}>
              ● AUTONOMOUSLY COMPILING: ACTIVE
            </p>
            <h2 className="lp2-engine-heading">
              <em>The Discovery<br />Engine</em>
            </h2>
            <p className="lp2-engine-body">
              Our autonomous pipeline analyses research, products, and funding signals
              to generate your personalised opportunity feed — updated every week.
            </p>
          </div>

          {/* Right — progress bars */}
          <div className="lp2-engine-right">
            <div className="lp2-engine-stats-row">
              {[
                { num: "12K+", lbl: "Papers\nIndexed" },
                { num: "850+", lbl: "Signals\nDaily"  },
                { num: "99%",  lbl: "Uptime"           },
              ].map(s => (
                <div key={s.num} className="lp2-engine-stat">
                  <span className="lp2-engine-stat-num">{s.num}</span>
                  <span className="lp2-engine-stat-lbl">{s.lbl}</span>
                </div>
              ))}
            </div>
            <div className="lp2-prog-stack">
              <ProgressBar label="RESEARCH PAPERS"    pct={87} visible={engineVisible} delay={200} />
              <ProgressBar label="COMMERCIAL PRODUCTS" pct={63} visible={engineVisible} delay={400} />
            </div>
          </div>

        </div>
      </section>

      {/* ── LOGO ROW ─────────────────────────────────────────────────────── */}
      <section className="lp2-logos-section">
        <p className="lp2-logos-label">BACKED BY INSIGHTS FROM THE WORLD'S TOP INVESTORS</p>
        <div className="lp2-logos-row">
          {["Sequoia", "Andreessen", "Benchmark", "Pulse"].map(l => (
            <span key={l} className="lp2-logo-item">{l}</span>
          ))}
        </div>
      </section>

      {/* ── FOOTER CTA ───────────────────────────────────────────────────── */}
      <section className="lp2-cta-section" ref={ctaRef}>
        <div className={`lp2-cta-inner ${ctaVisible ? "lp2-reveal" : ""}`}>
          <h2 className="lp2-cta-heading">
            <em>Stop guessing.<br />Start building.</em>
          </h2>
          <p className="lp2-cta-sub">
            Join the exclusive layer of founders using GenAI research to lead<br />
            the next decade of innovation.
          </p>
          <button className="lp2-cta-btn" onClick={onSignUp || onEnterApp}>
            JOIN VENTURESCOPE &nbsp;→
          </button>
        </div>
      </section>

      {/* ── PAGE FOOTER ──────────────────────────────────────────────────── */}
      <footer className="lp2-footer">
        <div className="lp2-footer-brand">
          <span className="lp2-footer-logo">VentureScope</span>
          <p className="lp2-footer-copy">
            Mapping the opportunities · Radar for first movers
          </p>
        </div>
        <div className="lp2-footer-links">
          {["Platform", "Privacy", "Terms", "Support"].map(l => (
            <a key={l} href="#" className="lp2-footer-link">{l}</a>
          ))}
        </div>
      </footer>

    </div>
  );
}
