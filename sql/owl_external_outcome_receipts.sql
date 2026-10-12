-- Research-only: apply after independent security and deployment review.
-- The service key must only have SELECT on required decisions and INSERT on this table.
create table if not exists public.owl_external_outcome_receipts (
 decision_id text primary key references public.owl_signal_market_decisions(decision_id),
 capture_hash text not null check(capture_hash ~ '^[0-9a-f]{64}$'),
 capture jsonb not null,
 collector_signature text not null,
 classification text not null check(classification='INDEPENDENT_SHADOW_PRICE_ONLY'),
 inserted_at timestamptz not null default now()
);
alter table public.owl_external_outcome_receipts enable row level security;
revoke all on public.owl_external_outcome_receipts from anon,authenticated;
-- Worker role grants must be provisioned and tested separately; never place privileged DB credentials in frontend.
