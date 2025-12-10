const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const fs = require("fs");

// Image upload setup
const uploadDir = path.join(__dirname, "..", "public", "uploads");
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/**
 * POST /api/foods/:foodId/image - Upload and overwrite food image
 */
router.post("/:foodId/image", imageUpload.single("photo"), (req, res) => {
  const db = req.app.locals.db;
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

module.exports = router;
