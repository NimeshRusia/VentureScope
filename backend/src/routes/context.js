/**
 * GET  /context   — Load the authenticated user's SOUL memory
 * PATCH /context  — Update user SOUL memory and trigger pipeline
 *
 * Each authenticated user has their own isolated SOUL file at:
 *   openclaw/souls/user-{uid}.md
 * Unauthenticated requests fall back to the global legacy SOUL.md.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { requireSupabaseSession } = require('../middleware/auth');
const { loadSoulMemory, updateSoulMemory, buildSoulMarkdown } = require('../lib/soul');
const { soulPath: globalSoulPath } = require('../config');

const router = express.Router();

const SOULS_DIR = path.resolve(__dirname, '../../../openclaw/souls');

/** Returns the path to a user's personal SOUL.md, creating it if absent. */
function ensureUserSoulPath(uid) {
  if (!fs.existsSync(SOULS_DIR)) {
    fs.mkdirSync(SOULS_DIR, { recursive: true });
  }

  const filePath = path.join(SOULS_DIR, `user-${uid}.md`);

  if (!fs.existsSync(filePath)) {
    // Bootstrap a blank soul for this user
    const markdown = buildSoulMarkdown({
      user_profile: {
        user_id: uid,
        domains: [],
        interests: [],
        exclusions: [],
        risk_appetite: 'medium',
        behavior_signals: [],
        discovery_preferences: [],
        last_updated: null,
      },
    });
    fs.writeFileSync(filePath, markdown, 'utf8');
    console.log(`[context] Created new SOUL for user ${uid.slice(0, 8)}…`);
  }

  return filePath;
}

/** Resolve the active SOUL path — per-user when authenticated, global otherwise */
function resolveSoulPath(req) {
  if (req.user?.id) {
    return ensureUserSoulPath(req.user.id);
  }
  return globalSoulPath;
}

// GET /context
router.get('/', requireSupabaseSession, (req, res) => {
  const activeSoulPath = resolveSoulPath(req);
  const soul = loadSoulMemory(activeSoulPath);
  return res.json({ user: req.user, soul });
});

// PATCH /context
router.patch('/', requireSupabaseSession, async (req, res) => {
  const { user_profile: userProfile = {} } = req.body || {};

  const activeSoulPath = resolveSoulPath(req);
  const soul = updateSoulMemory(activeSoulPath, { user_profile: userProfile });

  try {
    const runPipeline = require('../../../openclaw/skills/pipeline');
    // Pass the soul path so the pipeline reads from the correct user's file
    await runPipeline(soul, activeSoulPath);
  } catch (err) {
    console.error('[context] Pipeline trigger failed:', err);
  }

  return res.json({ user: req.user, soul });
});

module.exports = router;