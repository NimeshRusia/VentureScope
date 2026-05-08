import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib/supabase";

// ── Components ───────────────────────────────────────────────────────────────
import Navbar       from "./components/Navbar";
import Sidebar      from "./components/Sidebar";
import TabNav       from "./components/TabNav";
import { GapRadar } from "./components/GapRadar";
import { CopilotChat } from "./components/CopilotChat";
import InvestorIntel  from "./components/InvestorIntel";
import WeeklyDigest   from "./components/WeeklyDigest";
import CoFounderMatch from "./components/CoFounderMatch";
import HeartbeatLog   from "./components/HeartbeatLog";

import { getContext, getOpportunities, updateContext, API_BASE_URL } from './lib/api';

const API_BASE = API_BASE_URL || "http://localhost:8000";

// ─────────────────────────────────────────────────────────────────────────────
// user_domains helpers
// Table: { id, user_id, domain, added_at, gap_score }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all domain rows for a given user, ordered by when they were added.
 * Returns { names: string[], meta: { [domain]: { added_at, gap_score } } }
 */
async function fetchUserDomains(userId) {
  const { data, error } = await supabase
    .from("user_domains")
    .select("domain, added_at, gap_score")
    .eq("user_id", userId)
    .order("added_at", { ascending: true });

  if (error) {
    console.error("[VentureScope] fetchUserDomains error:", error.message);
    return { names: [], meta: {} };
  }

  const rows  = data || [];
  const names = rows.map((r) => r.domain);
  const meta  = {};
  rows.forEach((r) => {
    meta[r.domain] = { added_at: r.added_at, gap_score: r.gap_score ?? null };
  });

  return { names, meta };
}

// ─────────────────────────────────────────────────────────────────────────────
// SOUL.md sync — fire-and-forget, non-critical
// ─────────────────────────────────────────────────────────────────────────────
async function pushSoulSync(domainNames, riskAppetite) {
  try {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(`${API_BASE}/soul-sync`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ domains: domainNames, risk_appetite: riskAppetite }),
    });
  } catch (err) {
    console.warn("[VentureScope] SOUL.md sync skipped:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {

  // ── UI state ─────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab,   setActiveTab]   = useState("radar");
  const [copilotOpen, setCopilotOpen] = useState(false);
  const copilotPanelRef = useRef(null);
  const fabRef          = useRef(null);

  // ── Data state ───────────────────────────────────────────────────────────
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [context,       setContext]       = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  // ── SOUL Context state ───────────────────────────────────────────────────
  // domains: string[]   — plain names consumed by all child components
  // domainMeta: object  — { [name]: { added_at, gap_score } } for upserts
  const [domains,       setDomains]       = useState([]);
  const [domainMeta,    setDomainMeta]    = useState({});
  const [riskAppetite,  setRiskAppetite]  = useState("medium");
  const [isSaving,      setIsSaving]      = useState(false);
  const [lastSaved,     setLastSaved]     = useState(null);

  // ── Pipeline run counter ─────────────────────────────────────────────────
  const [pipelineRuns, setPipelineRuns] = useState(() =>
    parseInt(localStorage.getItem("vs_pipeline_runs") || "0", 10)
  );

  // ── Scan state ───────────────────────────────────────────────────────────
  const [isScanning, setIsScanning] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // loadDomainsForUser — called on initial mount AND on every SIGNED_IN event
  // so User B's login always wipes User A's state and loads fresh data
  // ─────────────────────────────────────────────────────────────────────────
  const loadDomainsForUser = useCallback(async (userId) => {
    const { names, meta } = await fetchUserDomains(userId);
    setDomains(names);
    setDomainMeta(meta);
    console.log(
      `[VentureScope] ✅ Restored ${names.length} domain(s) for user ${userId.slice(0, 8)}…`
    );
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Initialisation effect
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    // ── Part A: Load dashboard data (opportunities, context) ─────────────
    async function loadDashboard() {
      try {
        const [oppPayload, ctx] = await Promise.all([
          getOpportunities().catch(() => ({ opportunities: [] })),
          getContext().catch(() => null),
        ]);
        if (!mounted) return;

        const opps = oppPayload.opportunities || [];
        setOpportunities(opps);
        setContext(ctx);

        if (opps.length > 0) {
          const mostRecent = opps.reduce((latest, opp) =>
            new Date(opp.updated_at || opp.created_at) >
            new Date(latest.updated_at || latest.created_at)
              ? opp : latest
          );
          setLastUpdatedAt(mostRecent.updated_at || mostRecent.created_at);
        }
      } catch (err) {
        if (mounted) console.error("[VentureScope] Dashboard load error:", err);
      }
    }

    // ── Part B: Auth + domain fetch ────────────────────────────────────────
    async function init() {
      if (!supabase) {
        await loadDashboard();
        if (mounted) setLoading(false);
        return;
      }

      // Check the current session synchronously first
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (!mounted) return;

      if (authErr || !user) {
        console.warn("[VentureScope] No session — redirecting to /login");
        window.location.href = "/login";
        return;
      }

      // Load this user's domain history from user_domains (source of truth)
      await loadDomains(user.id);

      // Load risk appetite from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("risk_appetite")
        .eq("id", user.id)
        .single();
      if (mounted && profile?.risk_appetite) {
        setRiskAppetite(profile.risk_appetite);
      }

      // Load shared dashboard data
      await loadDashboard();

      if (mounted) setLoading(false);
    }

    async function loadDomains(userId) {
      if (!mounted) return;
      await loadDomains_impl(userId);
    }

    async function loadDomains_impl(userId) {
      const { names, meta } = await fetchUserDomains(userId);
      if (!mounted) return;
      setDomains(names);
      setDomainMeta(meta);
      console.log(`[VentureScope] ✅ Loaded ${names.length} domain(s) for user ${userId.slice(0, 8)}…`);
    }

    // ── Part C: Auth state listener ────────────────────────────────────────
    // SIGNED_IN fires when:
    //   • a fresh session starts (new login)
    //   • the page reloads with an existing session
    // This is the canonical trigger for loading per-user data.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === "SIGNED_IN" && session?.user) {
          // A (possibly different) user just signed in — load their data
          const { names, meta } = await fetchUserDomains(session.user.id);
          if (!mounted) return;
          setDomains(names);
          setDomainMeta(meta);
          console.log(
            `[VentureScope] ✅ onAuthStateChange: loaded ${names.length} domain(s) for ${session.user.id.slice(0, 8)}…`
          );
        }

        if (event === "SIGNED_OUT") {
          // ── Part 3: Clear local state only — NEVER delete from Supabase ──
          // When User A returns, their rows are still in user_domains and
          // will be fetched fresh on the next SIGNED_IN event.
          setDomains([]);
          setDomainMeta({});
          setRiskAppetite("medium");
          setOpportunities([]);
          setContext(null);
          if (mounted) window.location.href = "/login";
        }
      }
    );

    init();

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // SOUL Context handlers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Part 1 — Write on Add:
   * Immediately upsert { user_id, domain, added_at, gap_score } to user_domains.
   * user_id is always pulled from the live session — never from client state.
   */
  const handleAddDomain = useCallback(async (domain) => {
    const trimmed = domain.trim().toLowerCase();
    if (!trimmed || domains.includes(trimmed)) return;

    // Optimistic UI update so the sidebar feels instant
    const nextDomains = [...domains, trimmed];
    const nextMeta    = {
      ...domainMeta,
      [trimmed]: { added_at: new Date().toISOString(), gap_score: null },
    };
    setDomains(nextDomains);
    setDomainMeta(nextMeta);

    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // ── Part 1: upsert to user_domains ──────────────────────────────
        const { error } = await supabase
          .from("user_domains")
          .upsert(
            {
              user_id:  user.id,
              domain:   trimmed,
              added_at: nextMeta[trimmed].added_at,
              gap_score: null,
            },
            { onConflict: "user_id,domain" }
          );

        if (error) {
          console.error("[VentureScope] Failed to add domain to DB:", error.message);
        }
      }
    }

    // Sync per-user SOUL.md for the pipeline (fire-and-forget)
    pushSoulSync(nextDomains, riskAppetite);
  }, [domains, domainMeta, riskAppetite]);

  /**
   * Remove a domain — deletes the row from user_domains for this user only.
   * Never touches any other user's rows (RLS enforces this server-side too).
   */
  const handleRemoveDomain = useCallback(async (domain) => {
    const nextDomains = domains.filter((d) => d !== domain);
    const nextMeta    = { ...domainMeta };
    delete nextMeta[domain];

    setDomains(nextDomains);
    setDomainMeta(nextMeta);

    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("user_domains")
          .delete()
          .eq("user_id", user.id)
          .eq("domain", domain);

        if (error) {
          console.error("[VentureScope] Failed to remove domain from DB:", error.message);
        }
      }
    }

    pushSoulSync(nextDomains, riskAppetite);
  }, [domains, domainMeta, riskAppetite]);

  const handleChangeRisk = useCallback(async (level) => {
    setRiskAppetite(level);
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .upsert(
          { id: user.id, risk_appetite: level, updated_at: new Date().toISOString() },
          { onConflict: "id" }
        );
      await supabase.auth.updateUser({ data: { risk_appetite: level } });
    }
  }, []);

  const handleSaveSOUL = useCallback(async () => {
    if (domains.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const nextUserProfile = {
        ...context?.soul?.profile?.user_profile,
        domains,
        risk_appetite: riskAppetite,
      };

      const result = await updateContext(nextUserProfile);
      setContext(result);
      setLastSaved(new Date().toISOString());

      // Refresh radar data
      const opResult = await getOpportunities().catch(() => ({ opportunities: [] }));
      const opps = opResult.opportunities || [];
      setOpportunities(opps);

      if (opps.length > 0) {
        const mostRecent = opps.reduce((latest, opp) =>
          new Date(opp.updated_at || opp.created_at) >
          new Date(latest.updated_at || latest.created_at)
            ? opp : latest
        );
        setLastUpdatedAt(mostRecent.updated_at || mostRecent.created_at);

        // Update gap_score in user_domains for matched domains
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            for (const opp of opps) {
              const name = opp.title?.toLowerCase();
              if (name && domains.includes(name) && opp.score != null) {
                await supabase
                  .from("user_domains")
                  .update({ gap_score: opp.score })
                  .eq("user_id", user.id)
                  .eq("domain", name);
              }
            }
          }
        }
      }

      const prev = parseInt(localStorage.getItem("vs_pipeline_runs") || "0", 10);
      const next = prev + 1;
      localStorage.setItem("vs_pipeline_runs", next.toString());
      setPipelineRuns(next);

    } catch (err) {
      console.error("[VentureScope] Failed to save SOUL context:", err);
    } finally {
      setIsSaving(false);
    }
  }, [domains, riskAppetite, isSaving, context]);

  // ── Trigger Scan ─────────────────────────────────────────────────────────
  const handleTriggerScan = useCallback(async () => {
    if (isScanning || domains.length === 0) return;
    setIsScanning(true);
    try {
      const opResult = await getOpportunities();
      const opps = opResult.opportunities || [];
      setOpportunities(opps);
      if (opps.length > 0) {
        const mostRecent = opps.reduce((latest, opp) =>
          new Date(opp.updated_at || opp.created_at) >
          new Date(latest.updated_at || latest.created_at)
            ? opp : latest
        );
        setLastUpdatedAt(mostRecent.updated_at || mostRecent.created_at);
      }
      setLastSaved(new Date().toISOString());
    } catch (err) {
      console.error("[VentureScope] Scan trigger failed:", err);
    } finally {
      setIsScanning(false);
    }
  }, [domains, isScanning]);

  // ── Part 3 — Sign Out: clear local state, never delete from DB ───────────
  const handleSignOut = useCallback(async () => {
    setDomains([]);
    setDomainMeta({});
    setRiskAppetite("medium");
    setOpportunities([]);
    setContext(null);

    if (supabase) await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

  // ── Copilot FAB click-outside ────────────────────────────────────────────
  useEffect(() => {
    if (!copilotOpen) return;
    const handleClickOutside = (e) => {
      if (
        copilotPanelRef.current &&
        !copilotPanelRef.current.contains(e.target) &&
        fabRef.current &&
        !fabRef.current.contains(e.target)
      ) {
        setCopilotOpen(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClickOutside), 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [copilotOpen]);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
  }, []);

  // ── Tab content renderer ──────────────────────────────────────────────────
  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex h-[400px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--panel)] m-6">
          <div className="flex flex-col items-center gap-4">
            <span className="h-8 w-8 animate-spin-slow rounded-full border-2 border-[var(--aurora)] border-t-transparent" />
            <span className="text-sm uppercase tracking-widest text-[var(--mist)]">
              Initializing Dashboard...
            </span>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case "radar":
        return (
          <div key="radar" className="animate-tab-enter" style={{ padding: "24px" }}>
            <GapRadar
              opportunities={opportunities}
              riskAppetite={riskAppetite}
              domains={domains}
              onRemoveDomain={handleRemoveDomain}
            />
          </div>
        );
      case "intel":
        return (
          <div key="intel" className="animate-tab-enter" style={{ padding: "24px" }}>
            <InvestorIntel domains={domains} opportunities={opportunities} />
          </div>
        );
      case "digest":
        return (
          <div key="digest" className="animate-tab-enter" style={{ padding: "24px" }}>
            <WeeklyDigest domains={domains} riskAppetite={riskAppetite} opportunities={opportunities} />
          </div>
        );
      case "cofounder":
        return (
          <div key="cofounder" className="animate-tab-enter" style={{ padding: "24px" }}>
            <CoFounderMatch />
          </div>
        );
      case "heartbeat":
        return (
          <div key="heartbeat" className="animate-tab-enter" style={{ padding: "24px" }}>
            <HeartbeatLog />
          </div>
        );
      default:
        return null;
    }
  };

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <>
      <Navbar
        apiBase={API_BASE}
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((p) => !p)}
        onSignOut={handleSignOut}
      />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        lastUpdatedAt={lastUpdatedAt}
        onTriggerScan={handleTriggerScan}
        isScanning={isScanning}
        domains={domains}
        riskAppetite={riskAppetite}
        onAddDomain={handleAddDomain}
        onRemoveDomain={handleRemoveDomain}
        onChangeRisk={handleChangeRisk}
        onSave={handleSaveSOUL}
        isSaving={isSaving}
        lastSaved={lastSaved}
        signalsCount={opportunities.length}
        domainsCount={domains.length}
        pipelineRuns={pipelineRuns}
      />

      <main
        style={{
          marginTop: "var(--navbar-height)",
          marginLeft: "var(--sidebar-width)",
          minHeight: "calc(100vh - var(--navbar-height))",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <style>{`
          @media (max-width: 767px)               { main { margin-left: 0 !important; } }
          @media (min-width: 768px) and (max-width: 1100px) { main { margin-left: 240px !important; } }
        `}</style>

        <div style={{ position: "sticky", top: "var(--navbar-height)", zIndex: 50 }}>
          <TabNav activeTab={activeTab} onTabChange={handleTabChange} />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {error && (
            <p style={{ color: "var(--danger)", padding: "24px", textAlign: "center" }}>{error}</p>
          )}
          {renderTabContent()}
        </div>
      </main>

      {!loading && (
        <>
          <button
            ref={fabRef}
            id="copilot-fab"
            aria-label={copilotOpen ? "Close Venture Copilot" : "Open Venture Copilot"}
            aria-expanded={copilotOpen}
            onClick={() => setCopilotOpen((p) => !p)}
            className={pipelineRuns > 0 ? "vs-fab vs-fab--pulsing" : "vs-fab"}
          >
            <span style={{ fontSize: "24px", lineHeight: 1 }}>⚡</span>
          </button>

          <div
            ref={copilotPanelRef}
            id="copilot-panel"
            aria-hidden={!copilotOpen}
            className={copilotOpen ? "vs-copilot-panel vs-copilot-panel--open" : "vs-copilot-panel vs-copilot-panel--closed"}
          >
            <CopilotChat apiBase={API_BASE} domains={domains} />
          </div>
        </>
      )}
    </>
  );
}