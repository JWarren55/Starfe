const express = require("express");
const router = express.Router();
const { renderHomePage } = require("../views/homeView");

/**
 * GET / - Home page with menu
 */
router.get("/", (req, res) => {
  const db = req.app.locals.db;
  const requestedDate = req.query.date;
  const requestedPeriod = req.query.period;

  renderHomePage(db, null, requestedDate, requestedPeriod)
    .then(html => res.send(html))
    .catch(err => {
      console.error("Home page error:", err);
      res.status(500).send("Error rendering home page");
    });
});

module.exports = router;
