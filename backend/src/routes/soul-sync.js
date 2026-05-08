/**
 * POST /soul-sync
 *
 * Writes (or overwrites) the authenticated user's personal SOUL.md file at:
 *   openclaw/souls/user-{uid}.md
 *
 * This file is the OpenClaw agent's per-user memory layer, consumed by
 * the HEARTBEAT pipeline so it always operates on the correct user context.
 *
 * Security: the uid is taken from the verified JWT — the client never
 * controls which file is written.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { requireSupabaseSession } = require('../middleware/auth');
const { buildSoulMarkdown } = require('../lib/soul');

const router = express.Router();

/** Absolute path to the souls directory (sibling of backend/ and openclaw/) */
const SOULS_DIR = path.resolve(__dirname, '../../../openclaw/souls');

function ensureSoulsDir() {
  if (!fs.existsSync(SOULS_DIR)) {
    fs.mkdirSync(SOULS_DIR, { recursive: true });
  }
}

function userSoulPath(uid) {
  return path.join(SOULS_DIR, `user-${uid}.md`);
}

// POST /soul-sync
router.post('/', requireSupabaseSession, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized — valid Supabase session required.' });
  }

  const uid = req.user.id;
  const { domains = [], risk_appetite = 'medium' } = req.body || {};

  if (!Array.isArray(domains)) {
    return res.status(400).json({ error: '`domains` must be an array of strings.' });
  }

  try {
    ensureSoulsDir();

    const profile = {
      user_profile: {
        user_id: uid,
        domains,
        interests: [],
        exclusions: [],
        risk_appetite,
        behavior_signals: [],
        discovery_preferences: [],
        last_updated: new Date().toISOString(),
      },
    };

    const markdown = buildSoulMarkdown(profile);
    const filePath = userSoulPath(uid);
    fs.writeFileSync(filePath, markdown, 'utf8');

    console.log(`[soul-sync] Updated ${filePath} for user ${uid.slice(0, 8)}…`);

    return res.json({
      ok: true,
      soul_path: `souls/user-${uid}.md`,
      domains_synced: domains.length,
    });
  } catch (err) {
    console.error('[soul-sync] Failed to write SOUL.md:', err);
    return res.status(500).json({ error: 'Failed to write SOUL context.' });
  }
});

module.exports = router;
