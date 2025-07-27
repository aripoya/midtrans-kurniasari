export default {
  async up(db) {
    // This migration is complex and must run in a single transaction.
    // We disable foreign keys, rebuild the table, and then re-enable them.
    await db.batch([
      db.prepare('PRAGMA foreign_keys=OFF;'),
      db.prepare('ALTER TABLE locations RENAME TO locations_old;'),
      db.prepare(`
        CREATE TABLE locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nama_lokasi TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `),
      db.prepare(`
        INSERT INTO locations (id, nama_lokasi, created_at, updated_at)
        SELECT id, nama_lokasi, created_at, updated_at FROM locations_old;
      `),
      db.prepare('DROP TABLE locations_old;'),
      db.prepare('PRAGMA foreign_keys=ON;'),
    ]);
  },
};
