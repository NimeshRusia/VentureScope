import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ─── Animated Hexagon Logo SVG ──────────────────────────────────────────────
// A geometric hexagon outline that slowly rotates, rendered in amber.
// The inner shape is a hollow hexagon made of two overlapping paths.
function HexLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: "hexSpin 12s linear infinite" }}
      aria-hidden="true"
    >
      {/* Outer hexagon */}
      <polygon
        points="14,2 25,8 25,20 14,26 3,20 3,8"
        stroke="#75563F"
        strokeWidth="1.5"
        fill="none"
        opacity="0.9"
      />
      {/* Inner hexagon — rotated 30deg */}
      <polygon
        points="14,6 21.5,10.5 21.5,17.5 14,22 6.5,17.5 6.5,10.5"
        stroke="#75563F"
        strokeWidth="0.75"
        fill="none"
        opacity="0.45"
        style={{ transformOrigin: "14px 14px", transform: "rotate(15deg)" }}
      />
      {/* Center dot */}
      <circle cx="14" cy="14" r="2" fill="#75563F" opacity="0.8" />
    </svg>
  );
}

// ─── Pipeline Health Chip ───────────────────────────────────────────────────
// Polls /opportunities every 10 seconds to check backend reachability.
// Shows LIVE (amber pulse) or OFFLINE (danger pulse) accordingly.
function PipelineHealthChip({ apiBase }) {
  const [status, setStatus] = useState("checking"); // "live" | "offline" | "checking"
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/opportunities`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        setStatus("live");
      } else {
        setStatus("offline");
      }
    } catch {
      setStatus("offline");
    } finally {
      setLastChecked(new Date());
    }
  }, [apiBase]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10_000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const isLive    = status === "live";
  const isChecking = status === "checking";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "5px 14px",
        borderRadius: "var(--radius-pill)",
        background: isChecking
          ? "rgba(107, 88, 64, 0.15)"
          : isLive
            ? "rgba(92, 158, 110, 0.12)"
            : "rgba(192, 68, 42, 0.12)",
        border: `1px solid ${
          isChecking
            ? "rgba(107, 88, 64, 0.3)"
            : isLive
              ? "rgba(92, 158, 110, 0.3)"
              : "rgba(192, 68, 42, 0.35)"
        }`,
        transition: "all 400ms ease",
      }}
      title={lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : "Checking..."}
    >
      {/* Status dot */}
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: isChecking
            ? "var(--fog)"
            : isLive
              ? "var(--success)"
              : "var(--danger)",
          flexShrink: 0,
          animation: isChecking
            ? "none"
            : isLive
              ? "amberPulse 2s ease-out infinite"
              : "dangerPulse 2s ease-out infinite",
          // Override pulse color for success dot
          boxShadow: isLive
            ? "0 0 0 0 rgba(92, 158, 110, 0.55)"
            : undefined,
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: "500",
          letterSpacing: "0.08em",
          color: isChecking
            ? "var(--fog)"
            : isLive
              ? "#7ec99a"
              : "#e07060",
          textTransform: "uppercase",
          userSelect: "none",
        }}
      >
        {isChecking ? "Checking..." : isLive ? "Pipeline Live" : "Offline"}
      </span>
    </div>
  );
}

// ─── Sign Out Button ────────────────────────────────────────────────────────
function SignOutButton({ onSignOut }) {
  const handleSignOut = async () => {
    if (onSignOut) {
      await onSignOut();
    } else {
      if (supabase) {
        await supabase.auth.signOut();
      }
      window.location.href = "/";
    }
  };

  return (
    <button
      onClick={handleSignOut}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "7px",
        padding: "5px 12px",
        borderRadius: "var(--radius-pill)",
        background: "rgba(117, 86, 63, 0.10)",
        border: "1px solid rgba(117, 86, 63, 0.22)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        outline: "none",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "rgba(245, 213, 184, 0.5)";
        e.currentTarget.style.boxShadow = "0 0 8px rgba(245, 213, 184, 0.2)";
        e.currentTarget.children[1].style.opacity = "1";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "rgba(117, 86, 63, 0.22)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.children[1].style.opacity = "0.85";
      }}
    >
      {/* Log Out Icon (Arrow leaving box) */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: "500",
          letterSpacing: "0.08em",
          color: "var(--amber-light)",
          textTransform: "uppercase",
          userSelect: "none",
          opacity: 0.85,
          transition: "opacity 0.2s ease",
        }}
      >
        Sign Out
      </span>
    </button>
  );
}

// ─── Mobile Hamburger Button ────────────────────────────────────────────────
function HamburgerButton({ isOpen, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      style={{
        display: "none", // shown via CSS media query override below
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        color: "var(--parchment)",
        cursor: "pointer",
        padding: "6px 8px",
        alignItems: "center",
        justifyContent: "center",
        transition: "background-color 150ms ease",
      }}
      className="hamburger-btn"
    >
      {/* Three line icon */}
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
        <rect x="0" y="0" width="18" height="2" rx="1" fill="currentColor"
          style={{
            transformOrigin: "9px 1px",
            transition: "transform 250ms ease",
            transform: isOpen ? "rotate(45deg) translateY(6px)" : "none",
          }}
        />
        <rect x="0" y="6" width="18" height="2" rx="1" fill="currentColor"
          style={{ opacity: isOpen ? 0 : 1, transition: "opacity 200ms ease" }}
        />
        <rect x="0" y="12" width="18" height="2" rx="1" fill="currentColor"
          style={{
            transformOrigin: "9px 13px",
            transition: "transform 250ms ease",
            transform: isOpen ? "rotate(-45deg) translateY(-6px)" : "none",
          }}
        />
      </svg>
    </button>
  );
}

// ─── Navbar Main Component ──────────────────────────────────────────────────
export default function Navbar({ apiBase, isSidebarOpen, onToggleSidebar, onSignOut }) {
  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .hamburger-btn { display: flex !important; }
          .navbar-pipeline-health { display: none !important; }
        }
      `}</style>

      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "var(--navbar-height)",
          background: "rgba(220, 203, 190, 0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          zIndex: 100,
          boxShadow: "0 1px 0 rgba(117, 86, 63, 0.08), 0 4px 24px rgba(117, 86, 63, 0.1)",
        }}
      >
        {/* LEFT: Hamburger (mobile) + Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <HamburgerButton isOpen={isSidebarOpen} onClick={onToggleSidebar} />

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <HexLogo />
            <span
              style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: "24px",
                fontWeight: "700",
                color: "#1A0A04",
                letterSpacing: "normal",
                textTransform: "capitalize",
                userSelect: "none",
              }}
            >
              VentureScope
            </span>
          </div>
        </div>

        {/* CENTER: Pipeline Health */}
        <div className="navbar-pipeline-health">
          <PipelineHealthChip apiBase={apiBase} />
        </div>

        {/* RIGHT: Sign Out button */}
        <SignOutButton onSignOut={onSignOut} />
      </nav>
    </>
  );
}
