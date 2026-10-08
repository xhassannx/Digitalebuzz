-- Optional simple automation definition (trigger + ordered steps), separate from canvas nodes/edges.
ALTER TABLE automation_flows ADD COLUMN IF NOT EXISTS linear_flow JSONB DEFAULT NULL;
