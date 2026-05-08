# Per-User SOUL Context Files

This directory contains one SOUL.md file per authenticated VentureScope user.

## Naming convention
  souls/user-{supabase-uid}.md

## Lifecycle
- **Created** automatically when a user first adds a domain or hits PATCH /context.
- **Updated** on every domain add / remove event via POST /soul-sync.
- **Read** by the OpenClaw HEARTBEAT pipeline every 60 s to union all users' domains.

## Security
Files in this directory are written server-side only.
The user's UID is derived from a verified Supabase JWT — never from client input.

## DO NOT commit individual soul files
The *.md entries in this directory are personal user data and must NOT be committed to source control.
Only this README is tracked.
