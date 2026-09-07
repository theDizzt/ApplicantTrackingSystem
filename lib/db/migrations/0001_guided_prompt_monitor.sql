CREATE TABLE IF NOT EXISTS guided_prompt_generation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL,
  outcome text NOT NULL,
  failure_type text
);

CREATE INDEX IF NOT EXISTS guided_prompt_generation_events_occurred_at_idx
  ON guided_prompt_generation_events (occurred_at);

CREATE TABLE IF NOT EXISTS guided_prompt_alert_states (
  reason_key text PRIMARY KEY,
  last_alerted_at timestamptz NOT NULL
);