# Proposal: optional authenticated embeds

Status: discussion only. No new authentication endpoint, trusted host or session acceptance is enabled by this change.

Grimoire embeds the full Atlas and plans Discord sign-in through its account menu. The desired experience is one sign-in, while Atlas continues to own its accounts, private notes and permission checks. Camping spots are a separate marker addition; resource nodes already have Herbs, Wood and Ore.

## Questions for the maintainer

Would Atlas accept an optional trusted application integration, or prefer to keep its own Discord sign-in? Which identity mechanism is compatible with the existing Supabase project? Can external browser sign-in return to the embedded session reliably in both a browser and a Tauri webview?

## Proposed boundaries

- Keep the current Discord popup as the default and fallback. Integration is opt-in and disabled until explicitly configured by the Atlas operator.
- Both servers agree on the partner identity, exact HTTPS origins and verification mechanism. Do not trust a Discord user ID or display name posted by the embedding page.
- Bind a handoff to a fresh Atlas login attempt and its nonce. Exchange a short-lived, single-use opaque code through a server-verified channel, with issuer, intended recipient, expiry and replay checks. Never put Discord tokens, Atlas refresh tokens, service-role keys or client secrets in iframe URLs or cross-window messages.
- Resolve the verified Discord identity to the existing Atlas account. Preserve the Supabase user ID so existing notes, bans and admin permissions remain correct. A partner must never assert Atlas roles. Do not implement custom JWT minting or account linking until a supported Supabase flow and linking policy have been agreed.
- If cross-window messaging is used, validate both the exact origin and source window and correlate every reply with its initiating request. Never use a wildcard recipient for authentication messages.
- Obtain explicit consent before the first identity handoff; do not automatically link a different Discord identity or replace an existing signed-in Atlas account.
- Keep tokens in the Atlas origin. Test third-party storage restrictions, popup blocking and system-browser versus webview session separation; use a top-level Atlas sign-in fallback when embedded storage cannot work.
- Define independent logout versus linked logout, unlinking and revocation before release. Offline or failed partner verification must not remove local notes.

## Acceptance checks before implementation can ship

Successful sign-in and existing-account note continuity; expired, reused, wrong-audience and forged codes; mismatched nonce; unapproved origin/source; cancelled consent; account mismatch; existing Atlas ban; no elevated roles; third-party storage blocked; popup blocked; Tauri browser return; logout/revocation; local note preservation on failure. Tests require a disposable Supabase project and synthetic accounts, never production secrets or user notes.

This proposal deliberately does not promise that an arbitrary partner assertion can create a Supabase session. Agree that mechanism and operational ownership first.
