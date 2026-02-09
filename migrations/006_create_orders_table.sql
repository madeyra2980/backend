-- Заявки (заказы): заказчик создаёт, специалист смотрит и принимает

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specialty_id VARCHAR(50) NOT NULL,
  description TEXT,
  proposed_price DECIMAL(12, 2),
  preferred_at TIMESTAMP,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address_text VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'completed', 'cancelled')),
  specialist_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_specialty ON orders(specialty_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_specialist ON orders(specialist_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

COMMENT ON TABLE orders IS 'Заявки заказчиков: услуга, цена, время, геолокация; специалист принимает';
