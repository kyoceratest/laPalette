const express = require('express');
const db = require('../config/db');

const router = express.Router();

// Helper: normalize simple string field
function norm(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s || null;
}

// POST /api/customers/register
// Simple demo endpoint to persist basic customer profile info in the `customers` table.
// Body: { email, name, phone?, companyName?, address?, customerCode?, vatNumber?, siret?, apeCode? }
router.post('/register', async (req, res) => {
  const {
    email,
    name,
    phone,
    companyName,
    address,
    customerCode,
    vatNumber,
    siret,
    apeCode
  } = req.body || {};

  if (!email || !name) {
    return res.status(400).json({ error: 'email and name are required' });
  }

  try {
    // If a customer with this email already exists, update basic fields; otherwise insert.
    const existing = await db.query('SELECT id FROM customers WHERE email = $1 LIMIT 1', [email]);

    if (existing.rows.length) {
      const id = existing.rows[0].id;
      await db.query(
        `UPDATE customers
         SET customer_code = COALESCE($2, customer_code),
             company_name  = COALESCE($3, company_name),
             contact_name  = COALESCE($4, contact_name),
             phone         = COALESCE($5, phone),
             address_line1 = COALESCE($6, address_line1),
             vat_number    = COALESCE($7, vat_number),
             siret         = COALESCE($8, siret),
             ape_code      = COALESCE($9, ape_code)
         WHERE id = $1`,
        [
          id,
          norm(customerCode),
          norm(companyName),
          norm(name),
          norm(phone),
          norm(address),
          norm(vatNumber),
          norm(siret),
          norm(apeCode)
        ]
      );
      return res.json({ success: true, id, updated: true });
    }

    const insert = await db.query(
      `INSERT INTO customers (
         email,
         customer_code,
         company_name,
         contact_name,
         phone,
         address_line1,
         vat_number,
         siret,
         ape_code
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        norm(email),
        norm(customerCode),
        norm(companyName),
        norm(name),
        norm(phone),
        norm(address),
        norm(vatNumber),
        norm(siret),
        norm(apeCode)
      ]
    );

    return res.status(201).json({ success: true, id: insert.rows[0].id, created: true });
  } catch (err) {
    console.error('Error in POST /api/customers/register', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/customers/me?email=...  (demo: identified by email)
router.get('/me', async (req, res) => {
  const email = norm(req.query.email || (req.body && req.body.email));
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  try {
    const result = await db.query(
      `SELECT
         id,
         email,
         customer_code   AS "customerCode",
         company_name    AS "companyName",
         contact_name    AS "contactName",
         phone,
         address_line1   AS "addressLine1",
         address_line2   AS "addressLine2",
         postal_code     AS "postalCode",
         city,
         country,
         vat_number      AS "vatNumber",
         siret,
         ape_code        AS "apeCode"
       FROM customers
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'not_found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in GET /api/customers/me', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// PUT /api/customers/me  (demo: identified by email in body)
router.put('/me', async (req, res) => {
  const {
    email,
    customerCode,
    companyName,
    contactName,
    phone,
    addressLine1,
    addressLine2,
    postalCode,
    city,
    country,
    vatNumber,
    siret,
    apeCode
  } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  try {
    // Try update first
    const result = await db.query(
      `UPDATE customers
       SET customer_code = COALESCE($2, customer_code),
           company_name  = COALESCE($3, company_name),
           contact_name  = COALESCE($4, contact_name),
           phone         = COALESCE($5, phone),
           address_line1 = COALESCE($6, address_line1),
           address_line2 = COALESCE($7, address_line2),
           postal_code   = COALESCE($8, postal_code),
           city          = COALESCE($9, city),
           country       = COALESCE($10, country),
           vat_number    = COALESCE($11, vat_number),
           siret         = COALESCE($12, siret),
           ape_code      = COALESCE($13, ape_code)
       WHERE LOWER(email) = LOWER($1)
       RETURNING id`,
      [
        norm(email),
        norm(customerCode),
        norm(companyName),
        norm(contactName),
        norm(phone),
        norm(addressLine1),
        norm(addressLine2),
        norm(postalCode),
        norm(city),
        norm(country),
        norm(vatNumber),
        norm(siret),
        norm(apeCode)
      ]
    );

    if (!result.rows.length) {
      // If no row existed yet for this email, insert a new one (upsert behaviour)
      const insert = await db.query(
        `INSERT INTO customers (
           email,
           customer_code,
           company_name,
           contact_name,
           phone,
           address_line1,
           address_line2,
           postal_code,
           city,
           country,
           vat_number,
           siret,
           ape_code
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          norm(email),
          norm(customerCode),
          norm(companyName),
          norm(contactName),
          norm(phone),
          norm(addressLine1),
          norm(addressLine2),
          norm(postalCode),
          norm(city),
          norm(country),
          norm(vatNumber),
          norm(siret),
          norm(apeCode)
        ]
      );

      return res.json({ success: true, id: insert.rows[0].id, created: true });
    }

    return res.json({ success: true, id: result.rows[0].id, updated: true });
  } catch (err) {
    console.error('Error in PUT /api/customers/me', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
