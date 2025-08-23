// Import bcryptjs library
import bcrypt from 'bcryptjs';

// Get password from command-line arguments
const password = process.argv[2];

if (!password) {
  console.error('Usage: node generate-hash.js <password>');
  process.exit(1);
}

// Generate salt and hash the password
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log(`Generated hash for password: "${password}"`);
console.log(hash);
console.log('\nSQL command to update admin password:');
console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'admin';`);
