const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// Import routes
const homeRoutes = require("./routes/homeRoutes");
const nutritionRoutes = require("./routes/nutritionRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const apiReviewRoutes = require("./routes/apiReviewRoutes");
const apiFoodRoutes = require("./routes/apiFoodRoutes");

const app = express();
const PORT = 3027; // your working port

app.use(express.json()); // needed for POST JSON

// serve static files (images, css, etc.)
app.use("/static", express.static(path.join(__dirname, "public")));

// connect to your existing DB
const dbPath = path.join(__dirname, "cafeteria.db");
const db = new sqlite3.Database(dbPath);

// Make db available to routes
app.locals.db = db;

// ---------- ROUTES ----------
app.use("/", homeRoutes);
app.use("/nutrition", nutritionRoutes);
app.use("/reviews", reviewRoutes);
app.use("/api/reviews", apiReviewRoutes);
app.use("/api/foods", apiFoodRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
