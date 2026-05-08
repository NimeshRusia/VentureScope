// Tab definitions. "coming-soon" tabs are visually locked.
export const TABS = [
  { id: "radar",     label: "Gap Radar",        icon: "◎",  status: "live" },
  { id: "intel",     label: "Investor Intel",   icon: "📡", status: "live" },
  { id: "digest",    label: "Weekly Digest",    icon: "📋", status: "live" },
  { id: "cofounder", label: "Co-Founder Match", icon: "🤝", status: "live" },
  { id: "heartbeat", label: "HEARTBEAT Log",    icon: "💓", status: "live" },
];

export default function TabNav({ activeTab, onTabChange }) {
  return (
    <nav
      style={{
        display: "flex",
        gap: "4px",
        padding: "12px 24px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(220, 203, 190, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        flexShrink: 0,
      }}
      role="tablist"
      aria-label="Main navigation"
    >
      <style>{`
        nav::-webkit-scrollbar { display: none; }
      `}</style>

      {TABS.map((tab) => {
        const isActive      = activeTab === tab.id;
        const isComingSoon  = tab.status === "coming-soon";

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-label={`${tab.label}${isComingSoon ? " (coming soon)" : ""}`}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "7px 16px",
              borderRadius: "var(--radius-pill)",
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              fontWeight: isActive ? "600" : "500",
              border: isActive
                ? "1px solid rgba(117, 86, 63, 0.35)"
                : "1px solid transparent",
              background: isActive
                ? "linear-gradient(135deg, rgba(117, 86, 63, 0.15), rgba(117, 86, 63, 0.08))"
                : "transparent",
              color: isActive
                ? "var(--amber)"
                : isComingSoon
                  ? "var(--fog)"
                  : "var(--parchment)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 180ms ease",
              position: "relative",
              opacity: isComingSoon ? 0.65 : 1,
              boxShadow: isActive
                ? "0 0 12px rgba(117, 86, 63, 0.15), inset 0 1px 0 rgba(117, 86, 63, 0.1)"
                : "none",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "var(--surface)";
                e.currentTarget.style.color = isComingSoon ? "var(--fog)" : "var(--cream)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = isComingSoon ? "var(--fog)" : "var(--parchment)";
              }
            }}
          >
            <span style={{ fontSize: "14px", lineHeight: 1 }}>{tab.icon}</span>
            <span>{tab.label}</span>
            {isComingSoon && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  fontWeight: "600",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--fog)",
                  padding: "1px 5px",
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid var(--border)",
                  marginLeft: "2px",
                }}
              >
                Soon
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
