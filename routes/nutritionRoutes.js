const express = require("express");
const router = express.Router();

/**
 * GET /nutrition/:foodId - Fetch nutrition data for a food
 */
router.get("/:foodId", (req, res) => {
  const db = req.app.locals.db;
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

module.exports = router;
