const express = require('express');
const db = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, description, price, image_url AS "imageUrl" FROM products WHERE active = TRUE ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid product id' });
  }

  try {
    const result = await db.query(
      'SELECT id, name, description, price, image_url AS "imageUrl" FROM products WHERE id = $1 AND active = TRUE',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching product by id', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

module.exports = router;
