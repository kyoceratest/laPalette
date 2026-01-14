const express = require('express');

// Simple in-memory demo users for La Palette auth.
// In a real app this would come from a database with hashed passwords.
//
// For the demo we expose:
// - 1 admin account
// - 1 client account
// - 1 shop account per real La Palette shop (shop1@... → shop18@...)
//   each bound to its own shopId so they only see their shop's orders.
const DEMO_USERS = [
  // Admin
  {
    id: 1,
    email: 'admin@lapalette.demo',
    password: 'admin123',
    role: 'ADMIN',
    displayName: 'Admin La Palette'
  },
  // Client démo
  {
    id: 2,
    email: 'client@lapalette.demo',
    password: 'client123',
    role: 'CLIENT',
    displayName: 'Client démo'
  },
  // Shops (mapping index → real shopId, same order as in web/index.html "shops" array)
  { id: 10, email: 'shop1@lapalette.demo',  password: 'shop123', role: 'SHOP', shopId: 9,  displayName: 'Magasin 1 – Antony' },
  { id: 11, email: 'shop2@lapalette.demo',  password: 'shop123', role: 'SHOP', shopId: 8,  displayName: 'Magasin 2 – Arcueil' },
  { id: 12, email: 'shop3@lapalette.demo',  password: 'shop123', role: 'SHOP', shopId: 10, displayName: 'Magasin 3 – Bougival' },
  { id: 13, email: 'shop4@lapalette.demo',  password: 'shop123', role: 'SHOP', shopId: 11, displayName: 'Magasin 4 – Boulogne' },
  { id: 14, email: 'shop5@lapalette.demo',  password: 'shop123', role: 'SHOP', shopId: 12, displayName: 'Magasin 5 – Bourg la Reine' },
  { id: 15, email: 'shop6@lapalette.demo',  password: 'shop123', role: 'SHOP', shopId: 13, displayName: 'Magasin 6 – Clichy' },
  { id: 16, email: 'shop7@lapalette.demo',  password: 'shop123', role: 'SHOP', shopId: 14, displayName: 'Magasin 7 – Clichy sous bois' },
  { id: 17, email: 'shop8@lapalette.demo',  password: 'shop123', role: 'SHOP', shopId: 3,  displayName: 'Magasin 8 – Convention (Paris15e)' },
  { id: 18, email: 'shop9@lapalette.demo',  password: 'shop123', role: 'SHOP', shopId: 15, displayName: 'Magasin 9 – Courbevoie' },
  { id: 19, email: 'shop10@lapalette.demo', password: 'shop123', role: 'SHOP', shopId: 4,  displayName: 'Magasin 10 – Daumesnil (Paris12e)' },
  { id: 20, email: 'shop11@lapalette.demo', password: 'shop123', role: 'SHOP', shopId: 16, displayName: 'Magasin 11 – Joinville' },
  { id: 21, email: 'shop12@lapalette.demo', password: 'shop123', role: 'SHOP', shopId: 17, displayName: 'Magasin 12 – Le Perreux-sur-Marne' },
  { id: 22, email: 'shop13@lapalette.demo', password: 'shop123', role: 'SHOP', shopId: 18, displayName: 'Magasin 13 – Levallois' },
  { id: 23, email: 'shop14@lapalette.demo', password: 'shop123', role: 'SHOP', shopId: 19, displayName: 'Magasin 14 – Ormesson' },
  { id: 24, email: 'shop15@lapalette.demo', password: 'shop123', role: 'SHOP', shopId: 6,  displayName: 'Magasin 15 – Pyrénées (Paris20e)' },
  { id: 25, email: 'shop16@lapalette.demo', password: 'shop123', role: 'SHOP', shopId: 20, displayName: 'Magasin 16 – Saint Ouen' },
  { id: 26, email: 'shop17@lapalette.demo', password: 'shop123', role: 'SHOP', shopId: 21, displayName: 'Magasin 17 – Saint-Maur' },
  { id: 27, email: 'shop18@lapalette.demo', password: 'shop123', role: 'SHOP', shopId: 7,  displayName: 'Magasin 18 – St Antoine (Paris11e)' },
  // Livreur / Livraison demo user
  {
    id: 50,
    email: 'delivery@lapalette.demo',
    password: 'delivery123',
    role: 'DELIVERY',
    displayName: 'Livreur démo',
    // Attach to a sample shop so filtering in delivery-list.html can work if needed
    shopId: 9
  }
];

const router = express.Router();

function findUserByEmail(rawEmail) {
  if (!rawEmail) return null;
  const normalizedEmail = String(rawEmail).trim().toLowerCase();
  return DEMO_USERS.find(u => u.email.toLowerCase() === normalizedEmail) || null;
}

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Adresse e-mail et mot de passe requis (démo).'
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Merci de saisir une adresse e-mail valide (démo).'
    });
  }

  const user = findUserByEmail(normalizedEmail);
  if (!user || password !== user.password) {
    return res.status(401).json({
      success: false,
      message: 'Identifiants invalides (démo).'
    });
  }

  // Very simple unsigned token: "<userId>:<role>" (demo only).
  const token = `${user.id}:${user.role}`;

  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      // Demo: optional shopId for SHOP users so front-end can filter orders.
      shopId: user.shopId || null
    }
  });
});

// DEMO-ONLY: reset password in memory until the server restarts.
// POST /auth/reset-demo
// Body: { email, oldPassword, newPassword }
router.post('/reset-demo', (req, res) => {
  const { email, oldPassword, newPassword } = req.body || {};

  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Email, ancien mot de passe et nouveau mot de passe requis (démo).'
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = findUserByEmail(normalizedEmail);
  if (!user) {
    // In a real app we would not reveal whether the email exists.
    return res.status(404).json({
      success: false,
      message: "Aucun compte trouvé pour cet e-mail (démo)."
    });
  }

  const trimmed = String(newPassword).trim();
  if (!trimmed || trimmed.length < 4) {
    return res.status(400).json({
      success: false,
      message: 'Le nouveau mot de passe doit contenir au moins 4 caractères (démo).'
    });
  }

  // Update in-memory password (lost on server restart).
  user.password = trimmed;

  return res.json({
    success: true,
    message: 'Mot de passe mis à jour (démo, jusqu\'au prochain redémarrage du serveur).'
  });
});

module.exports = router;
