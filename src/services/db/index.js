const sqlite3 = require("sqlite3").verbose();

module.exports = function createDb(path) {
    const db = new sqlite3.Database(path);

    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS civs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )`);
        db.run(`CREATE TABLE IF NOT EXISTS players (
      user_id TEXT PRIMARY KEY,
      civ_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'player'
    )`);
        db.run(`CREATE TABLE IF NOT EXISTS pair_rules (
      civ_small INTEGER NOT NULL,
      civ_large INTEGER NOT NULL,
      interval_seconds INTEGER NOT NULL,
      max_messages INTEGER NOT NULL,
      window_type TEXT NOT NULL DEFAULT 'cooldown',
      PRIMARY KEY(civ_small, civ_large)
    )`);
        db.run(`CREATE TABLE IF NOT EXISTS pair_usage (
      from_civ INTEGER NOT NULL,
      to_civ INTEGER NOT NULL,
      last_sent_at INTEGER,
      PRIMARY KEY(from_civ, to_civ)
    )`);
        db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_civ INTEGER NOT NULL,
      to_civ INTEGER NOT NULL,
      sent_at INTEGER NOT NULL,
      body TEXT NOT NULL
    )`);
    });

    return {
        raw: db,
        players: {
            getByUserId(userId) {
                return new Promise((resolve, reject) => {
                    db.get(
                        `SELECT p.user_id, p.role, p.civ_id, c.name AS civ_name
             FROM players p
             LEFT JOIN civs c ON c.id = p.civ_id
             WHERE p.user_id = ?`,
                        [userId],
                        (err, row) => err ? reject(err) : resolve(row)
                    );
                });
            }
        },
        civs: {
            getByName(name) {
                return new Promise((resolve, reject) => {
                    db.get(
                        `SELECT * FROM civs WHERE LOWER(name) = LOWER(?)`,
                        [name],
                        (err, row) => (err ? reject(err) : resolve(row))
                    );
                });
            },
            createCiv(name) {
                return new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO civs(name) VALUES(?)`,
                        [name],
                        (err, row) => (err ? reject(err) : resolve(row)))
                }
                );

            }
        },

        rules: {
            getBetween(civA, civB) {
                const small = Math.min(civA, civB);
                const large = Math.max(civA, civB);

                return new Promise((resolve, reject) => {
                    db.get(
                        `SELECT * FROM pair_rules WHERE civ_small = ? AND civ_large = ?`,
                        [small, large],
                        (err, row) => (err ? reject(err) : resolve(row))
                    );
                });
            }
        },

        usage: {
            getLastSent(fromCiv, toCiv) {
                return new Promise((resolve, reject) => {
                    db.get(
                        `SELECT last_sent_at FROM pair_usage WHERE from_civ = ? AND to_civ = ?`,
                        [fromCiv, toCiv],
                        (err, row) => (err ? reject(err) : resolve(row))
                    );
                });
            },

            upsertLastSent(fromCiv, toCiv, unixSeconds) {
                return new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO pair_usage(from_civ, to_civ, last_sent_at)
         VALUES(?, ?, ?)
         ON CONFLICT(from_civ, to_civ) DO UPDATE SET last_sent_at = excluded.last_sent_at`,
                        [fromCiv, toCiv, unixSeconds],
                        (err) => (err ? reject(err) : resolve())
                    );
                });
            }
        },

        messages: {
            insert(fromCiv, toCiv, unixSeconds, body) {
                return new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO messages(from_civ, to_civ, sent_at, body) VALUES(?, ?, ?, ?)`,
                        [fromCiv, toCiv, unixSeconds, body],
                        (err) => (err ? reject(err) : resolve())
                    );
                });
            }
        }
    };
};