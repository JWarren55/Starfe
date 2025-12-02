// importMenus.js
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const db = require("./db");

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

// Promisified DB helpers
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this); // this.lastID, this.changes
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

// --- helper upsert functions ---

async function getOrCreateLocation(externalId, name = null) {
  let row = await get(
    "SELECT id FROM locations WHERE external_id = ?",
    [externalId]
  );
  if (row) return row.id;

  const result = await run(
    "INSERT INTO locations (external_id, name) VALUES (?, ?)",
    [externalId, name]
  );
  return result.lastID;
}

async function getOrCreatePeriod(externalId, name) {
  let row = await get(
    "SELECT id FROM periods WHERE external_id = ?",
    [externalId]
  );
  if (row) return row.id;

  const result = await run(
    "INSERT INTO periods (external_id, name) VALUES (?, ?)",
    [externalId, name]
  );
  return result.lastID;
}

async function getOrCreateCategory(externalId, name, sortOrder) {
  let row = await get(
    "SELECT id FROM categories WHERE external_id = ?",
    [externalId]
  );
  if (row) {
    // optional: update name/sort_order
    await run(
      "UPDATE categories SET name = ?, sort_order = ? WHERE id = ?",
      [name, sortOrder, row.id]
    );
    return row.id;
  }

  const result = await run(
    "INSERT INTO categories (external_id, name, sort_order) VALUES (?, ?, ?)",
    [externalId, name, sortOrder]
  );
  return result.lastID;
}

async function getOrCreateFood(item) {
  // Prefer mrn_full as unique key if present
  if (item.mrnFull) {
    let row = await get(
      "SELECT id FROM foods WHERE mrn_full = ?",
      [item.mrnFull]
    );
    if (row) {
      // Optional: update basic fields
      await run(
        `UPDATE foods
         SET name = ?, description = ?, portion = ?, qty = ?, ingredients = ?
         WHERE id = ?`,
        [
          item.name,
          item.desc || "",
          item.portion || "",
          item.qty || null,
          item.ingredients || "",
          row.id,
        ]
      );
      return row.id;
    }

    const result = await run(
      `INSERT INTO foods
        (mrn, mrn_full, name, description, portion, qty, ingredients, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.mrn || null,
        item.mrnFull,
        item.name,
        item.desc || "",
        item.portion || "",
        item.qty || null,
        item.ingredients || "",
        null, // image_url starts as null
      ]
    );
    return result.lastID;
  } else {
    // Fallback: by name + portion
    let row = await get(
      "SELECT id FROM foods WHERE name = ? AND portion = ?",
      [item.name, item.portion || ""]
    );
    if (row) return row.id;

    const result = await run(
      `INSERT INTO foods
        (mrn, mrn_full, name, description, portion, qty, ingredients, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.mrn || null,
        null,
        item.name,
        item.desc || "",
        item.portion || "",
        item.qty || null,
        item.ingredients || "",
        null,
      ]
    );
    return result.lastID;
  }
}

async function getOrCreateNutrient(name, unit) {
  let row = await get(
    "SELECT id FROM nutrients WHERE name = ? AND unit = ?",
    [name, unit]
  );
  if (row) return row.id;

  const result = await run(
    "INSERT INTO nutrients (name, unit) VALUES (?, ?)",
    [name, unit]
  );
  return result.lastID;
}

async function upsertFoodNutrient(foodId, nutrientId, valueNumeric, valueRaw) {
  await run(
    `INSERT INTO food_nutrients (food_id, nutrient_id, value_numeric, value_raw)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(food_id, nutrient_id)
     DO UPDATE SET value_numeric = excluded.value_numeric,
                   value_raw     = excluded.value_raw`,
    [foodId, nutrientId, valueNumeric, valueRaw]
  );
}

async function upsertMenuItem({
  menuDate,
  locationId,
  periodId,
  categoryId,
  foodId,
  sortOrder,
}) {
  await run(
    `INSERT INTO menu_items
      (menu_date, location_id, period_id, category_id, food_id, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(menu_date, location_id, period_id, category_id, food_id)
     DO NOTHING`,
    [menuDate, locationId, periodId, categoryId, foodId, sortOrder]
  );
}

// --- main import logic for a single menu file ---

async function importMenuFile(filePath) {
  console.log(`Importing ${filePath}...`);
  const raw = await readFile(filePath, "utf8");
  const data = JSON.parse(raw);

  // Top-level fields from your sample:
  const locationExternalId = data.locationId;   // "5b7eb8..."
  const menuDate = data.date;                   // "2025-11-21"
  const periodObj = data.period;                // { id, name, categories: [...] }

  // In case you later get multiple periods per file, you could loop here.
  const locationId = await getOrCreateLocation(locationExternalId, null);
  const periodId = await getOrCreatePeriod(periodObj.id, periodObj.name);

  for (const category of periodObj.categories || []) {
    const categoryId = await getOrCreateCategory(
      category.id,
      category.name,
      category.sortOrder ?? null
    );

    for (const item of category.items || []) {
      const foodId = await getOrCreateFood(item);

      // Nutrients
      if (Array.isArray(item.nutrients)) {
        for (const n of item.nutrients) {
          const nutrientName = n.name;
          const unit = n.uom || null;
          const nutrientId = await getOrCreateNutrient(nutrientName, unit);

          let numeric = null;
          if (n.valueNumeric && n.valueNumeric !== "-") {
            const parsed = parseFloat(n.valueNumeric);
            numeric = Number.isNaN(parsed) ? null : parsed;
          }

          await upsertFoodNutrient(foodId, nutrientId, numeric, n.value);
        }
      }

      // Menu occurrence
      await upsertMenuItem({
        menuDate,
        locationId,
        periodId,
        categoryId,
        foodId,
        sortOrder: item.sortOrder ?? null,
      });
    }
  }

  console.log(`Done: ${filePath}`);
}

// --- iterate over all JSON files in /data ---

async function main() {
  const dataDir = path.join(__dirname, "data");
  const files = (await readdir(dataDir)).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.log("No .json files found in /data. Add your menu JSON files there.");
    return;
  }

  for (const file of files) {
    const fullPath = path.join(dataDir, file);
    try {
      await importMenuFile(fullPath);
    } catch (err) {
      console.error(`Error importing ${file}:`, err);
    }
  }

  console.log("All imports complete.");
  db.close();
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  db.close();
});
