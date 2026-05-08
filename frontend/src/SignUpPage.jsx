/**
 * SignUpPage.jsx
 *
 * Auth flow: sendOtp → verifyOtp → supabase.auth.signUp → profiles.upsert
 * UI: Precisely matches reference — centered "Create Account" heading,
 *     all-caps subtitle, 2-col name grid, two consent checkboxes, full footer.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import { sendOtp, verifyOtp as verifyEmailOtp } from "./lib/emailOtp";
import "./login.css";

const RESEND_COOLDOWN = 30;

/* ── Background canvas ────────────────────────────────────────────────────── */
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
        ctx.strokeStyle = `rgba(245,213,184,${0.01 + p * 0.016})`;
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

/* ── Underline field ──────────────────────────────────────────────────────── */
function Field({ id, label, type = "text", placeholder, value, onChange, autoComplete, children }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={`lgi2-field ${focused ? "lgi2-field--focus" : ""}`}>
      <label className="lgi2-label" htmlFor={id}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          id={id} type={type} className="lgi2-input"
          placeholder={placeholder}
          value={value} onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
        />
        {children}
      </div>
      <div className="lgi2-underline" />
    </div>
  );
}

/* ── Main SignUp Page ─────────────────────────────────────────────────────── */
export default function SignUpPage({ onSuccess, onBack }) {
  const [step, setStep] = useState("form"); // "form" | "otp"

  // Form fields
  const [firstName,  setFirstName]  = useState("");
  const [lastName,   setLastName]   = useState("");
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [agreedTos,  setAgreedTos]  = useState(false);
  const [agreedNews, setAgreedNews] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [formError,  setFormError]  = useState("");

  // OTP
  const [otp,       setOtp]       = useState(["", "", "", "", "", ""]);
  const [otpError,  setOtpError]  = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown,  setCooldown]  = useState(0);
  const otpRefs     = useRef([]);
  const passwordRef = useRef("");

  // Countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /* ── Step 1: send OTP ────────────────────────────────────────────────────*/
  async function handleSendOtp(e) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setFormError("Please enter your first and last name."); return; }
    if (!email.trim())    { setFormError("Please enter your corporate email."); return; }
    if (!password)        { setFormError("Please enter a password."); return; }
    if (password.length < 6) { setFormError("Password must be at least 6 characters."); return; }
    if (!agreedTos)       { setFormError("Please agree to the Terms of Service to continue."); return; }
    setFormError("");
    setLoading(true);
    try {
      passwordRef.current = password;
      await sendOtp(email.trim(), firstName.trim());
      setCooldown(RESEND_COOLDOWN);
      setStep("otp");
    } catch (err) {
      setFormError(err.message || "Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Step 2: verify OTP then create account ──────────────────────────────*/
  async function handleVerify(e) {
    e.preventDefault();
    const token = otp.join("");
    if (token.length < 6) { setOtpError("Please enter the full 6-digit code."); return; }
    setOtpError("");
    setVerifying(true);
    try {
      const result = await verifyEmailOtp(token);
      if (!result.ok) throw new Error(result.reason);

      if (supabase) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: passwordRef.current,
          options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } },
        });
        if (signUpError) throw new Error(signUpError.message);

        if (signUpData?.user) {
          const { error: profileError } = await supabase.from("profiles").upsert({
            id:              signUpData.user.id,
            first_name:      firstName.trim(),
            last_name:       lastName.trim(),
            email:           email.trim(),
            tracked_domains: [],
          });
          if (profileError) console.warn("[SignUp/profiles]", profileError.message);
        }
      }

      onSuccess();
    } catch (err) {
      setOtpError(err.message || "Incorrect or expired code. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  /* ── Resend ───────────────────────────────────────────────────────────── */
  async function handleResend() {
    if (cooldown > 0) return;
    try {
      await sendOtp(email.trim(), firstName.trim());
      setCooldown(RESEND_COOLDOWN);
      setOtpError("");
    } catch {
      setOtpError("Failed to resend code. Please try again.");
    }
  }

  /* ── OTP helpers ──────────────────────────────────────────────────────── */
  function handleOtpChange(idx, val) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp]; next[idx] = digit; setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
  }
  function handleOtpKeyDown(idx, e) {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowLeft"  && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 5) otpRefs.current[idx + 1]?.focus();
  }
  function handleOtpPaste(e) {
    const raw = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!raw) return;
    e.preventDefault();
    setOtp(Array(6).fill("").map((_, i) => raw[i] || ""));
    otpRefs.current[Math.min(raw.length, 5)]?.focus();
  }

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="lgi2-root">
      <BgCanvas />

      {/* NAV — only logo, no buttons */}
      <nav className="lgi2-nav">
        <button className="lgi2-logo" onClick={onBack}>VentureScope</button>
      </nav>

      <main className="lgi2-main lgi2-main--signup">

        {/* ── STEP 1: Create Account form ──────────────────────────────── */}
        {step === "form" && (
          <form className="lgi2-form lgi2-form--su" onSubmit={handleSendOtp} noValidate>

            {/* Header — centered, large italic */}
            <h1 className="lgi2-heading lgi2-heading--su">Create Account</h1>
            <p className="lgi2-subtitle lgi2-subtitle--su">
              Enter your credentials to access the intelligence platform.
            </p>

            {formError && <p className="lgi2-error">{formError}</p>}

            {/* Two-column name row */}
            <div className="lgi2-grid-2">
              <Field id="su-first" label="First Name" placeholder="Alexander"
                value={firstName} onChange={e => setFirstName(e.target.value)}
                autoComplete="given-name" />
              <Field id="su-last" label="Last Name" placeholder="Hamilton"
                value={lastName} onChange={e => setLastName(e.target.value)}
                autoComplete="family-name" />
            </div>

            {/* Corporate Email */}
            <Field id="su-email" label="Corporate Email" type="email"
              placeholder="name@firm.com"
              value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" />

            {/* Password with show toggle */}
            <div className="lgi2-field">
              <div className="lgi2-label-row">
                <label className="lgi2-label" htmlFor="su-password">Password</label>
                <button type="button" className="lgi2-show-toggle"
                  onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                  ⊙ {showPass ? "HIDE" : "SHOW"}
                </button>
              </div>
              <input
                id="su-password"
                type={showPass ? "text" : "password"}
                className="lgi2-input"
                placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <div className="lgi2-underline" />
            </div>

            {/* Checkbox 1 — Terms of Service */}
            <label className="lgi2-checkbox-row">
              <input
                type="checkbox"
                className="lgi2-checkbox"
                checked={agreedTos}
                onChange={e => setAgreedTos(e.target.checked)}
              />
              <span className="lgi2-checkbox-label">
                I agree to the{" "}
                <a href="#" className="lgi2-inline-link">Terms of Service</a>
                {" "}and acknowledge the{" "}
                <a href="#" className="lgi2-inline-link">Privacy Policy</a>.
              </span>
            </label>

            {/* Checkbox 2 — Newsletter */}
            <label className="lgi2-checkbox-row">
              <input
                type="checkbox"
                className="lgi2-checkbox"
                checked={agreedNews}
                onChange={e => setAgreedNews(e.target.checked)}
              />
              <span className="lgi2-checkbox-label">
                Subscribe to our weekly Venture Intelligence newsletter and platform updates.
              </span>
            </label>

            {/* Submit */}
            <button id="su-submit" type="submit"
              className={`lgi2-submit ${loading ? "lgi2-submit--loading" : ""}`}
              disabled={loading}
              style={{ marginTop: "12px", marginBottom: "24px" }}>
              {loading ? <span className="lgi2-spinner" /> : "CREATE ACCOUNT"}
            </button>

            {/* Login link */}
            <p className="lgi2-register">
              Already have an account?&nbsp;
              <button type="button" className="lgi2-link lgi2-link--accent" onClick={onBack}>
                Log In
              </button>
            </p>

          </form>
        )}

        {/* ── STEP 2: OTP verification ──────────────────────────────────── */}
        {step === "otp" && (
          <form className="lgi2-form" onSubmit={handleVerify} noValidate>
            <h1 className="lgi2-heading" style={{ fontSize: "40px" }}>Check email</h1>
            <p className="lgi2-subtitle" style={{ marginBottom: "12px" }}>
              We sent a 6-digit code to
            </p>
            <p style={{
              textAlign: "center", marginBottom: "36px",
              color: "var(--lgi2-peach)", fontSize: "13px", fontWeight: 400,
            }}>
              {email}
            </p>

            {otpError && <p className="lgi2-error">{otpError}</p>}

            {/* 6-box OTP */}
            <div className="lgi2-otp-row" onPaste={handleOtpPaste}>
              {otp.map((digit, idx) => (
                <input
                  key={idx} ref={el => (otpRefs.current[idx] = el)}
                  type="text" inputMode="numeric" maxLength={1}
                  className="lgi2-otp-box"
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(idx, e)}
                  autoFocus={idx === 0}
                  aria-label={`Digit ${idx + 1} of 6`}
                />
              ))}
            </div>

            <button type="submit"
              className={`lgi2-submit ${verifying ? "lgi2-submit--loading" : ""}`}
              disabled={verifying || otp.join("").length < 6}
              style={{ marginTop: "28px" }}>
              {verifying ? <span className="lgi2-spinner" /> : "VERIFY CODE"}
            </button>

            <button type="button" className="lgi2-link"
              onClick={handleResend} disabled={cooldown > 0}
              style={{ opacity: cooldown > 0 ? 0.45 : 1, cursor: cooldown > 0 ? "not-allowed" : "pointer" }}>
              {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
            </button>

            <button type="button" className="lgi2-link"
              onClick={() => { setStep("form"); setOtp(["","","","","",""]); setOtpError(""); }}>
              ← Back to sign up
            </button>

            <p className="lgi2-security-note" style={{ marginTop: "32px" }}>
              🔒 Protected by enterprise-grade 256-bit encryption.
            </p>
          </form>
        )}
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
            <p className="lgi2-footer-security">
              Protected by enterprise-grade 256-bit encryption. All institutional data is siloed and anonymized by default.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
