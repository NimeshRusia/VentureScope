/**
 * OpenClaw HEARTBEAT Pipeline
 *
 * Domain source priority:
 *   1. PRIMARY   — Supabase `user_domains` table (all users, deduplicated)
 *   2. SECONDARY — Per-user SOUL files in openclaw/souls/user-*.md
 *   3. FALLBACK  — Global intelligence/SOUL.md
 *   4. DEFAULT   — Hard-coded list so the pipeline never stalls
 *
 * For every unique domain it:
 *   • Queries ArXiv  for research momentum
 *   • Queries GitHub for product saturation
 *   • Computes a gap score (0–100)
 *   • Upserts the result into Supabase `opportunities`
 *   • Cleans up stale rows (domains no longer tracked by anyone)
 *
 * @param {object} context         — optional soul context passed from context.js
 * @param {string} explicitSoulPath — optional per-user soul path from context.js
 */
module.exports = async function runPipeline(context, explicitSoulPath) {
  const { createClient } = require('@supabase/supabase-js');
  const path = require('path');
  const fs   = require('fs');

  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase env vars missing — pipeline aborted.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ─────────────────────────────────────────────────────────────────────────
  // GAP SCORE — 3-part composite
  // ─────────────────────────────────────────────────────────────────────────
  function computeGapScore(research, products) {
    if (research === 0) return 1;
    const rNorm    = Math.log10(research + 1) / Math.log10(50001);
    const pNorm    = Math.log10(products + 1) / Math.log10(2000001);
    const space    = 1 - pNorm * 0.85;
    return Math.min(100, Math.max(1, Math.round(rNorm * space * 100)));
  }

  async function fetchArxivCount(query) {
    try {
      const fetch = (await import('node-fetch')).default;
      const res   = await fetch(
        `http://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=10`
      );
      const text  = await res.text();
      const m     = text.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
      return m ? parseInt(m[1], 10) : 0;
    } catch (err) {
      console.error('❌ ArXiv fetch failed:', err.message);
      return 0;
    }
  }

  async function fetchGithubCount(query) {
    try {
      const fetch = (await import('node-fetch')).default;
      const res   = await fetch(
        `https://api.github.com/search/repositories?q=${query}&per_page=5`,
        { headers: { Accept: 'application/vnd.github+json' } }
      );
      const data  = await res.json();
      return data.total_count || 0;
    } catch (err) {
      console.error('❌ GitHub fetch failed:', err.message);
      return 1;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Collect all unique domains tracked by any user
  // ─────────────────────────────────────────────────────────────────────────
  const allDomains = new Set();

  // 1. PRIMARY — query user_domains table (service role bypasses RLS)
  try {
    const { data: rows, error: dbErr } = await supabase
      .from('user_domains')
      .select('domain');

    if (dbErr) {
      console.warn('⚠️  user_domains query failed:', dbErr.message, '— falling back to SOUL files.');
    } else if (rows && rows.length > 0) {
      rows.forEach((r) => {
        const d = r.domain?.trim().toLowerCase();
        if (d) allDomains.add(d);
      });
      console.log(`🗄️  Loaded ${allDomains.size} unique domain(s) from user_domains table.`);
    }
  } catch (err) {
    console.error('❌ user_domains fetch threw:', err.message);
  }

  // 2. SECONDARY — per-user SOUL files (populated by soul-sync endpoint)
  if (allDomains.size === 0) {
    const SOULS_DIR = path.resolve(__dirname, '../souls');
    if (fs.existsSync(SOULS_DIR)) {
      const userFiles = fs
        .readdirSync(SOULS_DIR)
        .filter((f) => f.startsWith('user-') && f.endsWith('.md'));

      for (const file of userFiles) {
        try {
          const { loadSoulMemory } = require('../../backend/src/lib/soul');
          const soul = loadSoulMemory(path.join(SOULS_DIR, file));
          const ds   = soul?.profile?.user_profile?.domains;
          if (Array.isArray(ds)) {
            ds.forEach((d) => { if (d) allDomains.add(String(d).trim().toLowerCase()); });
          }
        } catch (err) {
          console.error(`❌ Failed to read ${file}:`, err.message);
        }
      }

      if (allDomains.size > 0) {
        console.log(`📄 Loaded ${allDomains.size} domain(s) from per-user SOUL files.`);
      }
    }
  }

  // Merge in the explicit soul path if provided by context.js PATCH
  if (explicitSoulPath && fs.existsSync(explicitSoulPath)) {
    try {
      const { loadSoulMemory } = require('../../backend/src/lib/soul');
      const soul = loadSoulMemory(explicitSoulPath);
      const ds   = soul?.profile?.user_profile?.domains;
      if (Array.isArray(ds)) {
        ds.forEach((d) => { if (d) allDomains.add(String(d).trim().toLowerCase()); });
      }
    } catch (err) {
      console.error('❌ Failed to read explicit soul path:', err.message);
    }
  }

  // 3. FALLBACK — global SOUL.md
  if (allDomains.size === 0) {
    const globalPath = path.resolve(__dirname, '../../intelligence/SOUL.md');
    if (fs.existsSync(globalPath)) {
      try {
        const { loadSoulMemory } = require('../../backend/src/lib/soul');
        const soul = loadSoulMemory(globalPath);
        const ds   = soul?.profile?.user_profile?.domains;
        if (Array.isArray(ds)) {
          ds.forEach((d) => { if (d) allDomains.add(String(d).trim().toLowerCase()); });
        }
      } catch (err) {
        console.error('❌ Failed to read global SOUL.md:', err.message);
      }
    }
  }

  // 4. DEFAULT — never let the pipeline stall with zero domains
  if (allDomains.size === 0) {
    console.warn('⚠️  No domains found anywhere — using built-in defaults.');
    ['ai agents', 'robotics ai', 'synthetic data'].forEach((d) => allDomains.add(d));
  }

  const domains = [...allDomains];
  console.log(`🚀 Pipeline targeting ${domains.length} domain(s):`, domains);

  // ─────────────────────────────────────────────────────────────────────────
  // Score each domain concurrently
  // ─────────────────────────────────────────────────────────────────────────
  const opportunities = await Promise.all(
    domains.map(async (domain) => {
      const encoded = encodeURIComponent(domain);
      const [research, products] = await Promise.all([
        fetchArxivCount(encoded),
        fetchGithubCount(encoded),
      ]);
      const score = computeGapScore(research, products);
      console.log(`📊 [${domain}] research=${research} | products=${products} | score=${score}`);
      return {
        title:      domain,
        summary:    `Research signals: ${research} papers | Product signals: ${products} repos`,
        score,
        updated_at: new Date().toISOString(),
      };
    })
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Upsert results into opportunities table
  // ─────────────────────────────────────────────────────────────────────────
  const { data: upserted, error: upsertErr } = await supabase
    .from('opportunities')
    .upsert(opportunities, { onConflict: 'title' })
    .select();

  if (upsertErr) {
    console.error('❌ opportunities upsert error:', upsertErr);
  } else {
    console.log(`✅ Upserted ${upserted.length} opportunity/ies.`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Clean up stale domain rows (no longer tracked by any user)
  // ─────────────────────────────────────────────────────────────────────────
  const keep = domains.map((d) => d.toLowerCase());
  const { data: existing } = await supabase.from('opportunities').select('title');

  if (existing) {
    const stale = existing.map((r) => r.title).filter((t) => !keep.includes(t));
    if (stale.length > 0) {
      console.log('🧹 Removing stale opportunities:', stale);
      await supabase.from('opportunities').delete().in('title', stale);
    }
  }
};