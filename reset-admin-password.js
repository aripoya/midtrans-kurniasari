import bcrypt from 'bcryptjs';

// This script resets the admin password directly in the database.
// It's intended for development and emergency use only.

export async function resetAdminPassword(env, newPassword) {
    if (!newPassword) {
        return {
            success: false,
            message: 'New password is required.'
        };
    }

    try {
        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Find the admin user
        const adminUser = await env.DB.prepare('SELECT id FROM users WHERE username = ? AND role = ?')
            .bind('admin', 'admin')
            .first();

        if (!adminUser) {
            return {
                success: false,
                message: 'Admin user not found in the database.'
            };
        }

        // Update the admin user's password hash
        const result = await env.DB.prepare('UPDATE users SET password = ? WHERE id = ?')
            .bind(hashedPassword, adminUser.id)
            .run();

        if (result.success) {
            console.log(`Successfully updated password for user 'admin'.`);
            return {
                success: true,
                message: 'Admin password has been reset successfully.'
            };
        } else {
            throw new Error('Database update failed.');
        }

    } catch (error) {
        console.error('Error resetting admin password:', error);
        return {
            success: false,
            message: 'Failed to reset admin password.',
            error: error.message
        };
    }
}
