import bcrypt from 'bcryptjs';

// This script is intended to be run in an environment with access to the database (env.DB)
// For example, through a special admin endpoint or a custom Wrangler command.

export async function hashExistingPasswords(env) {
    try {
        console.log('Starting password migration...');

        // Get all users with plaintext passwords
        const usersToMigrate = await env.DB.prepare(
            'SELECT id, password FROM users WHERE password IS NOT NULL'
        ).all();

        if (!usersToMigrate.results || usersToMigrate.results.length === 0) {
            console.log('No users with plaintext passwords to migrate.');
            return { success: true, message: 'No passwords to migrate.' };
        }

        console.log(`Found ${usersToMigrate.results.length} users to migrate.`);

        let migratedCount = 0;
        for (const user of usersToMigrate.results) {
            if (user.password) {
                // Hash the plaintext password
                const hashedPassword = await bcrypt.hash(user.password, 10);

                // Update the user's password_hash
                await env.DB.prepare(
                    'UPDATE users SET password = ? WHERE id = ?'
                ).bind(hashedPassword, user.id).run();

                migratedCount++;
            }
        }

        console.log(`Successfully migrated ${migratedCount} passwords.`);
        return { success: true, message: `Migrated ${migratedCount} passwords.` };

    } catch (error) {
        console.error('Error during password migration:', error);
        return { success: false, message: 'Password migration failed.', error: error.message };
    }
}

// To run this, you would typically expose it via a temporary admin route:
/*
router.post('/api/admin/migrate-passwords', async (request, env) => {
    if (request.user && request.user.role === 'admin') {
        const result = await hashExistingPasswords(env);
        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    } else {
        return new Response('Unauthorized', { status: 403 });
    }
});
*/
