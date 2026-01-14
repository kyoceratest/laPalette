const express = require('express');
const db = require('../config/db');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// GET /api/orders
// Returns a simple list of recent orders for back-office / client views
// Includes messageCount and "new for" flags derived from order_messages
router.get('/', async (req, res) => {
  try {
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
    });

    const result = await pool.query(
      `SELECT
         o.id AS "orderId",
         o.public_order_code AS "publicOrderCode",
         o.created_at AS "createdAt",
         o.customer_name AS "customerName",
         o.email,
         o.total_amount AS "totalAmount",
         o.status,
         o.payment_mode AS "paymentMode",
         o.shop_id AS "shopId",
         s.code AS "shopCode",
         s.name AS "shopName",
         -- enriched customer data for invoices / profile
         c.customer_code   AS "customerCode",
         c.company_name    AS "customerCompanyName",
         c.contact_name    AS "customerContactName",
         c.address_line1   AS "customerAddressLine1",
         c.address_line2   AS "customerAddressLine2",
         c.postal_code     AS "customerPostalCode",
         c.city            AS "customerCity",
         c.country         AS "customerCountry",
         c.vat_number      AS "customerVatNumber",
         c.siret           AS "customerSiret",
         c.ape_code        AS "customerApeCode",
         COALESCE(m.msg_count, 0) AS "messageCount",
         COALESCE(m.has_new_for_staff, false) AS "hasNewForStaff",
         COALESCE(m.has_new_for_client, false) AS "hasNewForClient"
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       LEFT JOIN customers c ON LOWER(c.email) = LOWER(o.email)
       LEFT JOIN (
         SELECT
           order_id,
           COUNT(*) AS msg_count,
           BOOL_OR(sender_type = 'CLIENT' AND is_read_by_staff = FALSE)  AS has_new_for_staff,
           BOOL_OR(sender_type = 'STAFF'  AND is_read_by_client = FALSE) AS has_new_for_client
         FROM order_messages
         GROUP BY order_id
       ) m ON m.order_id = o.id
       ORDER BY o.created_at DESC
       LIMIT 50`
    );

    await pool.end();

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching orders list', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id/messages
// Returns messaging history for a given order
router.get('/:id/messages', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  try {
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
      const messagesResult = await client.query(
        `SELECT
           id,
           order_id AS "orderId",
           sender_type AS "senderType",
           sender_name AS "senderName",
           message,
           created_at AS "createdAt",
           is_read_by_client AS "isReadByClient",
           is_read_by_staff AS "isReadByStaff"
         FROM order_messages
         WHERE order_id = $1
         ORDER BY created_at ASC`,
        [orderId]
      );

      res.json(messagesResult.rows);
    } finally {
      client.release();
      await pool.end();
    }
  } catch (err) {
    console.error('Error fetching order messages', err);
    res.status(500).json({ error: 'Failed to fetch order messages' });
  }
});

// POST /api/orders/:id/messages
// Body: { senderType: 'CLIENT' | 'STAFF', senderName?: string, message: string }
// Stores a message and sends an email alert (demo)
router.post('/:id/messages', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const { senderType, senderName, message } = req.body || {};
  const normalizedType = senderType && String(senderType).toUpperCase();

  if (!normalizedType || (normalizedType !== 'CLIENT' && normalizedType !== 'STAFF')) {
    return res.status(400).json({ error: 'Invalid senderType' });
  }
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Ensure order exists and get basic info
      const orderResult = await client.query(
        `SELECT id, public_order_code AS "publicOrderCode", email
         FROM orders
         WHERE id = $1`,
        [orderId]
      );
      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found' });
      }

      const order = orderResult.rows[0];

      const isReadByClient = normalizedType === 'CLIENT';
      const isReadByStaff = normalizedType === 'STAFF';

      const insertResult = await client.query(
        `INSERT INTO order_messages
           (order_id, sender_type, sender_name, message, is_read_by_client, is_read_by_staff)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, order_id AS "orderId", sender_type AS "senderType", sender_name AS "senderName", message, created_at AS "createdAt", is_read_by_client AS "isReadByClient", is_read_by_staff AS "isReadByStaff"`,
        [orderId, normalizedType, senderName || null, message, isReadByClient, isReadByStaff]
      );

      await client.query('COMMIT');

      const saved = insertResult.rows[0];

      // Fire-and-forget email alert (demo)
      try {
        const orderCode = order.publicOrderCode || order.id;
        if (normalizedType === 'CLIENT') {
          const to = process.env.ALERT_SALES_EMAIL;
          if (to) {
            await sendEmail(
              to,
              `Nouveau message client pour la commande ${orderCode}`,
              `Commande: ${orderCode}\nDe: ${senderName || 'Client'}\n\n${message}`
            );
          }
        } else if (normalizedType === 'STAFF') {
          const to = order.email;
          if (to) {
            await sendEmail(
              to,
              `Nouveau message pour votre commande ${orderCode}`,
              `Commande: ${orderCode}\nDe: ${senderName || 'Votre conseiller La Palette'}\n\n${message}`
            );
          }
        }
      } catch (emailErr) {
        console.error('Error sending order message email alert', emailErr);
      }

      res.status(201).json(saved);
    } finally {
      client.release();
      await pool.end();
    }
  } catch (err) {
    console.error('Error creating order message', err);
    res.status(500).json({ error: 'Failed to create order message' });
  }
});

// POST /api/orders/:id/read/client
// Marks all messages on an order as read by the client
router.post('/:id/read/client', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  try {
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
    });

    const result = await pool.query(
      `UPDATE order_messages
       SET is_read_by_client = TRUE
       WHERE order_id = $1`,
      [orderId]
    );

    await pool.end();

    res.json({ updated: result.rowCount || 0 });
  } catch (err) {
    console.error('Error marking messages read by client', err);
    res.status(500).json({ error: 'Failed to mark messages read (client)' });
  }
});

// POST /api/orders/:id/read/staff
// Marks all messages on an order as read by the staff side
router.post('/:id/read/staff', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  try {
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
    });

    const result = await pool.query(
      `UPDATE order_messages
       SET is_read_by_staff = TRUE
       WHERE order_id = $1`,
      [orderId]
    );

    await pool.end();

    res.json({ updated: result.rowCount || 0 });
  } catch (err) {
    console.error('Error marking messages read by staff', err);
    res.status(500).json({ error: 'Failed to mark messages read (staff)' });
  }
});

// POST /api/orders/:id/stock-confirm
// Simple demo endpoint: shop confirms stock, order moves to AWAITING_PAYMENT
router.post('/:id/stock-confirm', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  try {
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
    });

    const result = await pool.query(
      `UPDATE orders
       SET status = 'AWAITING_PAYMENT'
       WHERE id = $1
       RETURNING id AS "orderId", public_order_code AS "publicOrderCode", status`,
      [orderId]
    );

    await pool.end();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error confirming stock for order', err);
    res.status(500).json({ error: 'Failed to confirm stock' });
  }
});

// POST /api/orders/:id/pay
// Simple demo endpoint: client payment confirmed, order moves to PAID_PREPARE_ORDER
router.post('/:id/pay', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  try {
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
    });

    const result = await pool.query(
      `UPDATE orders
       SET status = 'PAID_PREPARE_ORDER'
       WHERE id = $1
       RETURNING id AS "orderId", public_order_code AS "publicOrderCode", status`,
      [orderId]
    );

    await pool.end();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error marking order as paid', err);
    res.status(500).json({ error: 'Failed to mark order as paid' });
  }
});

// POST /api/orders/:id/prepare
// Shop starts preparing the order after payment
router.post('/:id/prepare', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  try {
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
    });

    const result = await pool.query(
      `UPDATE orders
       SET status = 'PREPARING_ORDER'
       WHERE id = $1
       RETURNING id AS "orderId", public_order_code AS "publicOrderCode", status`,
      [orderId]
    );

    await pool.end();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error marking order as preparing', err);
    res.status(500).json({ error: 'Failed to mark order as preparing' });
  }
});

// POST /api/orders/:id/ready-for-delivery
// Shop marks order as ready for delivery / pickup
router.post('/:id/ready-for-delivery', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  try {
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
    });

    const result = await pool.query(
      `UPDATE orders
       SET status = 'READY_FOR_DELIVERY'
       WHERE id = $1
       RETURNING id AS "orderId", public_order_code AS "publicOrderCode", status`,
      [orderId]
    );

    await pool.end();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error marking order as ready for delivery', err);
    res.status(500).json({ error: 'Failed to mark order as ready for delivery' });
  }
});

// POST /api/orders/deliver/:publicCode
// Final step: delivery confirmation via public order code (e.g. scanned from QR)
router.post('/deliver/:publicCode', async (req, res) => {
  const publicCode = (req.params.publicCode || '').trim();
  if (!publicCode) {
    return res.status(400).json({ error: 'Invalid order code' });
  }

  try {
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
    });

    const result = await pool.query(
      `UPDATE orders
       SET status = 'COMPLETED'
       WHERE public_order_code = $1
       RETURNING id AS "orderId", public_order_code AS "publicOrderCode", status`,
      [publicCode]
    );

    await pool.end();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error confirming delivery for order', err);
    res.status(500).json({ error: 'Failed to confirm delivery' });
  }
});

// GET /api/orders/:id
// Returns a single order with its line items
router.get('/:id', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId || Number.isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  try {
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
      const orderResult = await client.query(
        `SELECT
           o.id AS "orderId",
           o.public_order_code AS "publicOrderCode",
           o.created_at AS "createdAt",
           o.customer_name AS "customerName",
           o.email,
           o.phone,
           o.address,
           o.total_amount AS "totalAmount",
           o.status,
           o.payment_mode AS "paymentMode",
           o.shop_id AS "shopId",
           s.code AS "shopCode",
           s.name AS "shopName",
           -- enriched customer data for invoices / profile
           c.customer_code   AS "customerCode",
           c.company_name    AS "customerCompanyName",
           c.contact_name    AS "customerContactName",
           c.address_line1   AS "customerAddressLine1",
           c.address_line2   AS "customerAddressLine2",
           c.postal_code     AS "customerPostalCode",
           c.city            AS "customerCity",
           c.country         AS "customerCountry",
           c.vat_number      AS "customerVatNumber",
           c.siret           AS "customerSiret",
           c.ape_code        AS "customerApeCode"
         FROM orders o
         LEFT JOIN shops s ON s.id = o.shop_id
         LEFT JOIN customers c ON LOWER(c.email) = LOWER(o.email)
         WHERE o.id = $1`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const itemsResult = await client.query(
        `SELECT
           oi.product_id AS "productId",
           oi.quantity,
           oi.unit_price AS "unitPrice",
           p.name AS "productName"
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1
         ORDER BY oi.id`,
        [orderId]
      );

      res.json({ order: orderResult.rows[0], items: itemsResult.rows });
    } finally {
      client.release();
      await pool.end();
    }
  } catch (err) {
    console.error('Error fetching order detail', err);
    res.status(500).json({ error: 'Failed to fetch order detail' });
  }
});

// POST /api/orders
// Expects: { customer: { name, email, phone, address }, items: [{ productId, name, qty, price }], paymentMode?: 'ONLINE' | 'CREDIT' | 'PAY_IN_SHOP', shopId: number }
router.post('/', async (req, res) => {
  const { customer, items, paymentMode, shopId } = req.body || {};

  if (!customer || !customer.name || !customer.email || !customer.address) {
    return res.status(400).json({ error: 'Missing required customer fields' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item' });
  }

  const numericShopId = Number(shopId);
  if (!numericShopId || Number.isNaN(numericShopId)) {
    return res.status(400).json({ error: 'shopId is required and must be a valid number' });
  }

  const totalAmount = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);

  const client = await db.query('SELECT 1'); // simple connectivity check

  const finalPaymentMode = paymentMode || 'ONLINE';

  const clientPool = require('../config/db');

  const poolClient = await clientPool._getClient ? clientPool._getClient() : null;

  // Fallback if db wrapper has no _getClient helper
  const pg = require('pg');

  try {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false } });
    const clientConn = await pool.connect();

    try {
      await clientConn.query('BEGIN');

      // Ensure shop exists
      const shopResult = await clientConn.query(
        'SELECT id FROM shops WHERE id = $1',
        [numericShopId]
      );
      if (shopResult.rows.length === 0) {
        await clientConn.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid shopId' });
      }

      const insertOrderText = `
        INSERT INTO orders (customer_name, email, phone, address, total_amount, status, payment_mode, shop_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      const orderResult = await clientConn.query(insertOrderText, [
        customer.name,
        customer.email,
        customer.phone || null,
        customer.address,
        totalAmount,
        'PENDING_STOCK_CONFIRMATION',
        finalPaymentMode,
        numericShopId
      ]);

      const orderId = orderResult.rows[0].id;

      const year = new Date().getFullYear();
      const sequence = String(orderId).padStart(4, '0');
      const publicOrderCode = `LP-${year}-${sequence}`;

      await clientConn.query(
        'UPDATE orders SET public_order_code = $1 WHERE id = $2',
        [publicOrderCode, orderId]
      );

      const insertItemText = `
        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
        VALUES ($1, $2, $3, $4)
      `;

      for (const item of items) {
        await clientConn.query(insertItemText, [
          orderId,
          item.productId,
          item.qty,
          item.price
        ]);
      }

      await clientConn.query('COMMIT');

      res.status(201).json({ orderId, publicOrderCode, status: 'PENDING_STOCK_CONFIRMATION', paymentMode: finalPaymentMode, shopId: numericShopId });
    } catch (err) {
      await clientConn.query('ROLLBACK');
      console.error('Error creating order', err);
      res.status(500).json({ error: 'Failed to create order' });
    } finally {
      clientConn.release();
      await pool.end();
    }
  } catch (err) {
    console.error('Database transaction error', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
