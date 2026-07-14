require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./config/db'); 

async function resetPasswords() {
  try {
    console.log('Generating new hash for "password123"...');
    
    // Generate a fresh hash using YOUR local environment
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash('password123', salt);

    // Update all existing users with this new hash
    const result = await db.query('UPDATE users SET password_hash = $1 RETURNING email', [newHash]);
    
    console.log(`✅ Successfully updated ${result.rowCount} users!`);
    console.log('You can now log in with the password: password123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting passwords:', error);
    process.exit(1);
  }
}

resetPasswords();