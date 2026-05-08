import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import "./login.css";

/* ── Subtle background contour lines ─────────────────────────────────────── */
function BgCanvas() {
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
      for (let i = 0; i < 20; i++) {
        const p = i / 20;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(245,213,184,${0.012 + p * 0.018})`;
        ctx.lineWidth = 0.6;
        const yBase = H * 0.1 + p * H * 0.75;
        ctx.moveTo(0, yBase);
        for (let x = 0; x <= W; x += 4) {
          const nx = x / W;
          ctx.lineTo(x,
            yBase
            + Math.sin(nx * Math.PI * 2.8 + t + i * 0.5) * (18 - i * 0.5)
            + Math.cos(nx * Math.PI * 5   + t * 0.6 + i)  * (7  - i * 0.2)
          );
        }
        ctx.stroke();
      }
      t += 0.003;
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="lgi2-bg-canvas" />;
}

/* ── Main Login Page ─────────────────────────────────────────────────────── */
export default function LoginPage({ onLogin, onBack, onRequestAccess }) {
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus,  setPassFocus]  = useState(false);

  // ── Real Supabase auth ───────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        console.error("Supabase login error:", authError);
        setError(authError.message || "Invalid credentials. Please try again.");
      } else {
        onLogin();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lgi2-root">
      <BgCanvas />

      {/* ── TOP NAV ── only logo, no buttons ────────────────────────────── */}
      <nav className="lgi2-nav">
        <button className="lgi2-logo" onClick={onBack}>VentureScope</button>
      </nav>

      {/* ── FORM AREA ────────────────────────────────────────────────────── */}
      <main className="lgi2-main">
        <form className="lgi2-form" onSubmit={handleSubmit} noValidate>

          {/* Heading */}
          <h1 className="lgi2-heading">Sign in</h1>
          <p className="lgi2-subtitle">
            Enter your credentials to access the intelligence layer
          </p>

          {error && <p className="lgi2-error">{error}</p>}

          {/* Email field */}
          <div className={`lgi2-field ${emailFocus ? "lgi2-field--focus" : ""}`}>
            <label className="lgi2-label" htmlFor="lgi-email">Email Address</label>
            <input
              id="lgi-email"
              type="email"
              className="lgi2-input"
              placeholder="name@institution.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setEmailFocus(true)}
              onBlur={() => setEmailFocus(false)}
              autoComplete="email"
              required
            />
            <div className="lgi2-underline" />
          </div>

          {/* Password field */}
          <div className={`lgi2-field ${passFocus ? "lgi2-field--focus" : ""}`}>
            <div className="lgi2-label-row">
              <label className="lgi2-label" htmlFor="lgi-password">Password</label>
              <button
                type="button"
                className="lgi2-show-toggle"
                onClick={() => setShowPass(p => !p)}
                tabIndex={-1}
              >
                ⊙ {showPass ? "HIDE" : "SHOW"}
              </button>
            </div>
            <input
              id="lgi-password"
              type={showPass ? "text" : "password"}
              className="lgi2-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onFocus={() => setPassFocus(true)}
              onBlur={() => setPassFocus(false)}
              autoComplete="current-password"
              required
            />
            <div className="lgi2-underline" />
          </div>

          {/* Sign in button */}
          <button
            id="lgi-submit"
            type="submit"
            className={`lgi2-submit ${loading ? "lgi2-submit--loading" : ""}`}
            disabled={loading}
          >
            {loading ? <span className="lgi2-spinner" /> : "SIGN IN"}
          </button>

          {/* Forgot */}
          <button type="button" className="lgi2-link" onClick={() => {}}>
            Forgot Username / Password?
          </button>

          {/* Divider */}
          <div style={{ borderTop: "1px solid rgba(240,232,216,0.1)", margin: "8px 0 20px" }} />

          {/* Sign up row */}
          <p className="lgi2-register">
            Don&apos;t have an account?&nbsp;
            <button
              type="button"
              className="lgi2-link lgi2-link--accent"
              onClick={onRequestAccess}
            >
              SIGNUP
            </button>
          </p>

        </form>
      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="lgi2-footer">
        <div className="lgi2-footer-inner">
          <div className="lgi2-footer-left">
            <span className="lgi2-footer-logo">VentureScope</span>
            <p className="lgi2-footer-tagline">
              Building the computational foundation for<br />
              the next decade of venture capital.
            </p>
          </div>
          <div className="lgi2-footer-right">
            <nav className="lgi2-footer-nav">
              {["Platform", "Privacy", "Terms"].map(l => (
                <a key={l} href="#" className="lgi2-footer-link">{l}</a>
              ))}
            </nav>
            <p className="lgi2-footer-copy">
              © 2024 VentureScope AI — Designed for Excellence
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
