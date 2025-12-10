const express = require("express");
const router = express.Router();

/**
 * POST /api/reviews - Record a food review vote
 */
router.post("/", (req, res) => {
  const db = req.app.locals.db;
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

module.exports = router;
