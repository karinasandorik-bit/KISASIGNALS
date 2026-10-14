# OWL Free Agent v0.1 — zero paid model APIs

Scope: daily, read-only GitHub workflow failure clustering + public bounty/paid-issue candidate discovery. It writes a GitHub Actions **job summary only**. No email access, no external actions, no payment claims, no Gemini/Claude access.

## Execution
- GitHub Actions manual workflow dispatch or scheduled 06:17 UTC (schedule must be on default branch; GitHub may delay/skip schedule).
- Python standard library; short-lived standard runner; job timeout 4 minutes.
- The workflow's GITHUB_TOKEN has read-only scopes (contents, actions, issues).
- Public GitHub Actions standard runners are free. Private repository use counts against plan minutes; other billing may apply.
- The GitHub search API can throttle; this is handled by an empty candidate list for failed queries.

## Next integration gates
1. Gmail requires a distinct OAuth grant/token with only appropriate scopes: never copy ChatGPT connector tokens or app passwords.
2. Gemini and Claude require their respective authenticated APIs with costs/quotas explicitly configured; no fake model council.
3. Independent evaluation: track verified leads, acceptance, paid invoices and cost; compare against a simple baseline.
4. For security and privacy, never publish private emails or credentials in public Actions logs/issues.

The action is safe to run but cannot transact or register accounts.
