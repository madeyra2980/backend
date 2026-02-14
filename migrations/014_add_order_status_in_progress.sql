-- Статус заявки "Еду" (специалист в пути)
-- Сначала удаляем старый CHECK (имя может отличаться в разных версиях PostgreSQL)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
-- Добавляем новый статус in_progress
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('open', 'accepted', 'in_progress', 'completed', 'cancelled'));

COMMENT ON COLUMN orders.status IS 'open=в поиске, accepted=принята, in_progress=еду, completed=выполнена, cancelled=отменена';
