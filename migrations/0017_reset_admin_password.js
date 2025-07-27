import bcrypt from 'bcryptjs';

export default {
  async fetch(request, env, ctx) {
    console.log('Running migration: 0017_reset_admin_password.js');

    try {
      const adminUsername = 'admin';
      const plainPassword = 'admin123';

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);
      console.log(`Hashed password for '${plainPassword}': ${hashedPassword}`);

      // Check if the admin user exists
      const existingUser = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
        .bind(adminUsername)
        .first();

      if (existingUser) {
        // If user exists, update their password
        console.log(`Admin user '${adminUsername}' found. Updating password.`);
        const result = await env.DB.prepare('UPDATE users SET password = ? WHERE username = ?')
          .bind(hashedPassword, adminUsername)
          .run();
        console.log('Update result:', result);
        return new Response('Admin password updated successfully.', { status: 200 });
      } else {
        // If user does not exist, create them
        console.log(`Admin user '${adminUsername}' not found. Creating new admin user.`);
        const newAdminId = 'admin-prod-01'; // A unique ID for the new admin
        const result = await env.DB.prepare('INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)')
          .bind(newAdminId, adminUsername, hashedPassword, 'Admin Production', 'admin')
          .run();
        console.log('Insert result:', result);
        return new Response('Admin user created successfully.', { status: 201 });
      }
    } catch (error) {
      console.error('Migration failed:', error);
      return new Response(`Migration failed: ${error.message}`, { status: 500 });
    }
  },
};
