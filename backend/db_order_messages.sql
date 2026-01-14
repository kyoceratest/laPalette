-- Create table to store messaging history per order
-- Run this once on your Neon/Postgres database

CREATE TABLE IF NOT EXISTS order_messages (
  id                SERIAL PRIMARY KEY,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_type       VARCHAR(16) NOT NULL,        -- 'CLIENT' or 'STAFF'
  sender_name       VARCHAR(255),
  message           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read_by_client BOOLEAN NOT NULL DEFAULT FALSE,
  is_read_by_staff  BOOLEAN NOT NULL DEFAULT FALSE
);

-- Optional helper index to fetch messages per order quickly
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id_created_at
  ON order_messages(order_id, created_at);
