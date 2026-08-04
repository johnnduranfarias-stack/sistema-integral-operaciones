const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db.json');

function ensureSingleAdminAccount() {
  const adminUsername = process.env.ADMIN_USERNAME || 'jduran_admin';
  const adminAlias = process.env.ADMIN_USERNAME_ALIAS || 'jduran';
  const adminFullName = process.env.ADMIN_FULL_NAME || 'Johnny Durán';
  const adminRole = process.env.ADMIN_ROLE || 'Administrador General';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Johnny2026!';

  try {
    let db = {};
    if (fs.existsSync(DB_PATH)) {
      db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
    
    if (!db.users) {
      db.users = {};
    }

    const hashedPassword = bcrypt.hashSync(adminPassword, 10);

    // Enforce SINGLE ADMIN USER POLICY
    // 1. Reclassify/Demote any other user with admin role to 'logistic' or 'viewer' without deleting history
    Object.keys(db.users).forEach(u => {
      if (u !== adminUsername && u !== adminAlias) {
        if (db.users[u].role === 'admin' || db.users[u].role === 'Administrador General') {
          db.users[u].role = 'viewer'; // demote to viewer/operator, preserving history
        }
      }
    });

    // 2. Set primary admin account
    db.users[adminUsername] = {
      id: 'USR-ADMIN-01',
      username: adminUsername,
      alias: adminAlias,
      name: adminFullName,
      passwordHash: hashedPassword,
      role: 'admin',
      displayRole: adminRole,
      activo: true,
      updatedAt: new Date().toISOString()
    };

    // 3. Set alias pointing to same configuration
    db.users[adminAlias] = {
      id: 'USR-ADMIN-01', // SAME ID!
      username: adminUsername, // resolves to primary
      alias: adminAlias,
      name: adminFullName,
      passwordHash: hashedPassword,
      role: 'admin',
      displayRole: adminRole,
      activo: true,
      isAlias: true,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    console.log('[INIT] Single Admin Account initialized/verified successfully.');
    return true;
  } catch (err) {
    console.error('[INIT ERROR] Failed to initialize admin account:', err);
    return false;
  }
}

module.exports = { ensureSingleAdminAccount };

if (require.main === module) {
  ensureSingleAdminAccount();
}
