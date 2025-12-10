const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const multer = require("multer");

// Import utilities
const { getAllergyTags } = require("./utils/allergens");
const { getTodayDateString } = require("./utils/dateHelper");

const app = express();
const PORT = 3027;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use("/static", express.static(path.join(__dirname, "public")));

// Connect to database
const dbPath = path.join(__dirname, "cafeteria.db");
const db = new sqlite3.Database(dbPath);

// ========== HOME PAGE ==========
app.get("/", (req, res) => {
  const today = getTodayDateString();
  const requestedDate = req.query.date;
  const requestedPeriod = req.query.period;

  const dateSql = `
    SELECT DISTINCT menu_date
    FROM menu_items
    ORDER BY menu_date DESC
  `;

  db.all(dateSql, [], (err, dateRows) => {
    if (err) {
      console.error("DB error (dates):", err);
      return res.status(500).send("Database error");
    }

    const dates = dateRows.map(r => r.menu_date);
    let selectedDate =
      requestedDate && dates.includes(requestedDate)
        ? requestedDate
        : dates.includes(today)
        ? today
        : dates[0] || today;

    const sql = `
      SELECT
        mi.menu_date,
        p.name AS period_name,
        c.name AS category_name,
        c.sort_order AS category_sort,
        f.id   AS food_id,
        f.name AS food_name,
        f.mrn_full AS nutrition_id,
        f.ingredients AS ingredients,
        f.image_url AS image_url,
        fb.up_count,
        fb.down_count,
        fb.notry_count,
        fb.total_count
      FROM menu_items mi
      JOIN periods p    ON mi.period_id = p.id
      JOIN categories c ON mi.category_id = c.id
      JOIN foods f      ON mi.food_id = f.id
      LEFT JOIN (
        SELECT
          food_id,
          SUM(CASE WHEN rating = 1  THEN 1 ELSE 0 END) AS up_count,
          SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) AS down_count,
          SUM(CASE WHEN rating = 0  THEN 1 ELSE 0 END) AS notry_count,
          COUNT(*) AS total_count
        FROM feedback
        GROUP BY food_id
      ) fb ON fb.food_id = f.id
      WHERE mi.menu_date = ?
      ORDER BY p.name, c.sort_order, c.name, mi.sort_order, f.name
    `;

    db.all(sql, [selectedDate], (err2, rows) => {
      if (err2) {
        console.error("DB error:", err2);
        return res.status(500).send("Database error");
      }

      const grouped = {};
      for (const row of rows) {
        if (!grouped[row.period_name]) grouped[row.period_name] = {};
        if (!grouped[row.period_name][row.category_name]) {
          grouped[row.period_name][row.category_name] = [];
        }
        row.allergyTags = getAllergyTags(row.ingredients);
        grouped[row.period_name][row.category_name].push(row);
      }

      // Collect unique allergy tags
      const tagSet = new Set();
      rows.forEach(r => {
        (r.allergyTags || []).forEach(t => tagSet.add(t));
      });
      const allTags = Array.from(tagSet).sort();

      const periodNames = Object.keys(grouped);
      const defaultPeriod = periodNames[0] || "Breakfast";
      const initialMeal =
        requestedPeriod && periodNames.includes(requestedPeriod)
          ? requestedPeriod
          : defaultPeriod;

      res.render("home", {
        dates,
        selectedDate,
        periodNames,
        initialMeal,
        grouped,
        allTags
      });
    });
  });
});

// ========== NUTRITION API ==========
app.get("/nutrition/:foodId", (req, res) => {
  const foodId = req.params.foodId;

  const sql = `
    SELECT
      f.name AS food_name,
      n.name AS nutrient_name,
      n.unit AS unit,
      fn.value_numeric AS value_numeric,
      fn.value_raw AS value_raw
    FROM food_nutrients fn
    JOIN nutrients n ON n.id = fn.nutrient_id
    JOIN foods f     ON f.id = fn.food_id
    WHERE fn.food_id = ?
    ORDER BY n.name
  `;

  db.all(sql, [foodId], (err, rows) => {
    if (err) {
      console.error("Nutrition DB error:", err);
      return res.status(500).json({ error: "db error" });
    }

    if (rows.length === 0) {
      return res.json({ foodName: null, nutrients: [] });
    }

    const foodName = rows[0].food_name;
    const nutrients = rows.map(r => ({
      name: r.nutrient_name,
      unit: r.unit,
      value_numeric: r.value_numeric,
      value_raw: r.value_raw
    }));

    res.json({ foodName, nutrients });
  });
});

// ========== REVIEW PAGE ==========
app.get("/reviews", (req, res) => {
  const date = req.query.date || getTodayDateString();
  const periodName = req.query.period || "Lunch";

  const sql = `
    SELECT DISTINCT
      f.id AS food_id,
      f.name AS food_name,
      f.ingredients AS ingredients,
      f.image_url AS image_url
    FROM menu_items mi
    JOIN periods p ON mi.period_id = p.id
    JOIN foods f   ON mi.food_id = f.id
    WHERE mi.menu_date = ?
      AND p.name = ?
    ORDER BY f.name
  `;

  db.all(sql, [date, periodName], (err, rows) => {
    if (err) {
      console.error("Review DB error:", err);
      return res.status(500).send("Database error");
    }

    const items = (rows || []).map(r => ({
      ...r,
      allergyTags: getAllergyTags(r.ingredients),
    }));

    res.render("reviews", {
      date,
      periodName,
      items
    });
  });
});

// ========== REVIEW API ==========
app.post("/api/reviews", (req, res) => {
  const { foodId, rating } = req.body || {};
  if (!foodId || typeof rating !== "number") {
    return res.status(400).json({ error: "foodId and numeric rating required" });
  }
  const sql = `
    INSERT INTO feedback (food_id, rating, created_at)
    VALUES (?, ?, datetime('now'))
  `;
  db.run(sql, [foodId, rating], (err) => {
    if (err) {
      console.error("Insert feedback error:", err);
      return res.status(500).json({ error: "db error" });
    }
    res.json({ ok: true });
  });
});

// ========== IMAGE UPLOAD SETUP ==========
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const foodId = req.params.foodId;
    cb(null, `food-${foodId}${ext}`);
  }
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ========== UPLOAD AND OVERWRITE FOOD IMAGE ==========
app.post("/api/foods/:foodId/image", imageUpload.single("photo"), (req, res) => {
  const foodId = req.params.foodId;

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const newUrl = `/static/uploads/food-${foodId}${path.extname(req.file.originalname)}`;

  const sql = `UPDATE foods SET image_url = ? WHERE id = ?`;
  db.run(sql, [newUrl, foodId], (err) => {
    if (err) {
      console.error("Failed to update food image:", err);
      return res.status(500).json({ error: "db error" });
    }
    res.json({ ok: true, imageUrl: newUrl });
  });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
