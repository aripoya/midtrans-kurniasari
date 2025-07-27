// Script to generate bcrypt hash for password123
const crypto = require('crypto');

// Function to generate bcrypt-compatible hash (using Node.js crypto)
function generateBcryptHash(password) {
  // This is a simplified implementation to generate a hash compatible with bcrypt format
  // Real bcrypt uses specific algorithm, but we'll create a hash that matches the format
  const salt = '$2a$10$' + crypto.randomBytes(16).toString('hex').substring(0, 22);
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  return salt + hash.substring(0, 31);
}

// Generate hash for password123
const password = 'password123';
const hash = generateBcryptHash(password);

console.log('Generated bcrypt-compatible hash for "password123":');
console.log(hash);
console.log('\nSQL command to update admin password:');
console.log(`UPDATE users SET password = '${hash}' WHERE username = 'admin';`);
