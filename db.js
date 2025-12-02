
// db.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "cafeteria.db");
const db = new sqlite3.Database(dbPath);

// Create tables if they don't exist
db.serialize(() => {
  // Locations
  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id   TEXT UNIQUE NOT NULL,
      name          TEXT
    )
  `);

  // Periods: Breakfast, Lunch, Dinner
  db.run(`
    CREATE TABLE IF NOT EXISTS periods (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id   TEXT UNIQUE,
      name          TEXT NOT NULL
    )
  `);

  // Categories: Homestyle, Grill, etc.
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id   TEXT UNIQUE,
      name          TEXT NOT NULL,
      sort_order    INTEGER
    )
  `);

  // Foods: master food database
  db.run(`
    CREATE TABLE IF NOT EXISTS foods (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      mrn                 INTEGER,
      mrn_full            TEXT UNIQUE,
      name                TEXT NOT NULL,
      description         TEXT,
      portion             TEXT,
      qty                 TEXT,
      ingredients         TEXT,
      image_url           TEXT,
      nutrition_source_id TEXT
    )
  `);

  // Nutrient types (Calories, Protein, etc.)
  db.run(`
    CREATE TABLE IF NOT EXISTS nutrients (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      name    TEXT NOT NULL,
      unit    TEXT,
      UNIQUE (name, unit)
    )
  `);

  // Link each food to nutrient values
  db.run(`
    CREATE TABLE IF NOT EXISTS food_nutrients (
      food_id       INTEGER NOT NULL,
      nutrient_id   INTEGER NOT NULL,
      value_numeric REAL,
      value_raw     TEXT,
      PRIMARY KEY (food_id, nutrient_id),
      FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE,
      FOREIGN KEY (nutrient_id) REFERENCES nutrients(id) ON DELETE CASCADE
    )
  `);

  // Menu items: each time a food appears on the menu
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_date     TEXT NOT NULL,  -- store as ISO string "YYYY-MM-DD"
      location_id   INTEGER NOT NULL,
      period_id     INTEGER NOT NULL,
      category_id   INTEGER NOT NULL,
      food_id       INTEGER NOT NULL,
      sort_order    INTEGER,
      external_item_id TEXT,
      UNIQUE (menu_date, location_id, period_id, category_id, food_id),
      FOREIGN KEY (location_id) REFERENCES locations(id),
      FOREIGN KEY (period_id) REFERENCES periods(id),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (food_id) REFERENCES foods(id)
    )
  `);

  // Feedback: for later reviews/ratings
  db.run(`
    CREATE TABLE IF NOT EXISTS feedback (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id       INTEGER NOT NULL,
      user_id       INTEGER,
      rating        INTEGER,
      comment       TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (food_id) REFERENCES foods(id)
    )
  `);
});

module.exports = db;
