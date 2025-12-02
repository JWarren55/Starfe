const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = 3027; // your working port


app.use(express.json()); // needed for POST JSON

// serve static files (images, css, etc.)
app.use("/static", express.static(path.join(__dirname, "public")));

// connect to your existing DB
const dbPath = path.join(__dirname, "cafeteria.db");
const db = new sqlite3.Database(dbPath);

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Very simple allergen detection from ingredients text
function getAllergyTags(ingredientsRaw) {
  if (!ingredientsRaw) return [];
  const text = ingredientsRaw.toLowerCase();
  const tags = [];

  if (text.includes("egg")) tags.push("Egg");
  if (
    text.includes("milk") ||
    text.includes("cheese") ||
    text.includes("butter") ||
    text.includes("cream")
  ) {
    tags.push("Milk/Dairy");
  }
  if (text.includes("wheat") || text.includes("gluten") || text.includes("flour")) {
    tags.push("Gluten/Wheat");
  }
  if (text.includes("soy")) tags.push("Soy");
  if (
    text.includes("almond") ||
    text.includes("walnut") ||
    text.includes("pecan") ||
    text.includes("cashew") ||
    text.includes("hazelnut") ||
    text.includes("pistachio")
  ) {
    tags.push("Tree Nuts");
  }
  if (text.includes("peanut")) tags.push("Peanuts");
  if (
    text.includes("fish") ||
    text.includes("salmon") ||
    text.includes("tuna") ||
    text.includes("cod")
  ) {
    tags.push("Fish");
  }
  if (
    text.includes("shrimp") ||
    text.includes("crab") ||
    text.includes("lobster") ||
    text.includes("shellfish")
  ) {
    tags.push("Shellfish");
  }
  if (text.includes("sesame")) tags.push("Sesame");

  // de-duplicate
  return [...new Set(tags)];
}

// ---------- HOME PAGE ----------
app.get("/", (req, res) => {
  const today = getTodayDateString();
  const requestedDate = req.query.date;
  const requestedPeriod = req.query.period;

  // get all dates with menu data
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
        // add allergy tags on the server side
        row.allergyTags = getAllergyTags(row.ingredients);
        grouped[row.period_name][row.category_name].push(row);
      }

      // collect all unique allergy tags for the filter bar
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

      let content = "";
      let mealSelectHtml = "";
      let dateSelectHtml = "";
      let tagFilterHtml = "";

      // tag filter chips
      if (allTags.length > 0) {
        tagFilterHtml = `
          <div class="tag-filter-bar">
            <span class="tag-filter-label">Exclude tags:</span>
            ${allTags
              .map(
                t => `
                  <button class="tag-chip" data-tag="${t}">
                    <span class="tag-chip-text">${t}</span>
                    <span class="tag-chip-x">×</span>
                  </button>
                `
              )
              .join("")}
          </div>
        `;
      }

      // date as calendar input
      if (dates.length > 0) {
        const earliest = dates[dates.length - 1];
        const latest = dates[0];

        dateSelectHtml = `
          <label for="dateInput" class="meal-label">Date:</label>
          <input
            type="date"
            id="dateInput"
            class="date-input"
            value="${selectedDate}"
            min="${earliest}"
            max="${latest}"
          />
        `;
      }

      if (rows.length === 0) {
        content += `<p>No menu data found for ${selectedDate}.</p>`;
      } else {
        // meal dropdown
        mealSelectHtml = `
          <label for="mealSelect" class="meal-label">Meal:</label>
          <select id="mealSelect" class="meal-select">
            ${periodNames
              .map(
                p =>
                  `<option value="${p}" ${
                    p === initialMeal ? "selected" : ""
                  }>${p}</option>`
              )
              .join("")}
          </select>
        `;

        // build content by period -> category -> cards
        for (const periodName of periodNames) {
          content += `
            <section class="period-block" data-period="${periodName}">
              <h2>${periodName}</h2>
          `;

          const cats = grouped[periodName];
          for (const categoryName of Object.keys(cats)) {
            content += `
              <div class="category-block">
                <h3>${categoryName}</h3>
                <div class="card-grid">
            `;

            for (const item of cats[categoryName]) {
              const total = item.total_count || 0;
              const upCount = item.up_count || 0;
              const downCount = item.down_count || 0;
              const noCount = item.notry_count || 0;

              const upPct = total ? Math.round((upCount * 100) / total) + "%" : "0%";
              const downPct = total ? Math.round((downCount * 100) / total) + "%" : "0%";
              const noPct = total ? Math.round((noCount * 100) / total) + "%" : "0%";

              const upRatio = total ? upCount / total : 0;
              const downRatio = total ? downCount / total : 0;

              const allergyChips =
                item.allergyTags && item.allergyTags.length
                  ? item.allergyTags
                      .map(t => `<span class="allergy-tag">${t}</span>`)
                      .join("")
                  : "";

              const ingredientsLine = item.ingredients
                ? `<div class="ingredients-line">
                     <span class="ingredients-label">Ingredients:</span>
                     <span>${item.ingredients}</span>
                   </div>`
                : "";

              const tagsData = (item.allergyTags || [])
                .map(t => t.toLowerCase())
                .join("|");

              content += `
  <div class="food-card"
       data-name="${item.food_name.toLowerCase()}"
       data-tags="${tagsData}"
       data-up="${upRatio}"
       data-down="${downRatio}">
    
    <div class="food-img-wrapper">
      <img
        class="food-img"
        src="${item.image_url || "/static/images/placeholder.png"}"
        alt="${item.food_name}"
        onerror="this.src='/static/images/placeholder.png';"
      />
    </div>

    <div class="food-header">
      <div class="food-name">${item.food_name}</div>
    </div>

    <div class="allergy-row">
      ${allergyChips}
    </div>

    ${ingredientsLine}

    <div class="rating-bar">
      <div class="rating-pill rating-up">${upPct} Up</div>
      <div class="rating-pill rating-down">${downPct} Down</div>
      <div class="rating-pill rating-no">${noPct} Not Tried</div>
    </div>

    <button
      class="btn nutrition-btn btn-nutrition"
      data-food-id="${item.food_id}"
      data-food-name="${item.food_name}">
      Nutrition
    </button>

  </div>
`;

            }

            content += `
                </div> <!-- /.card-grid -->
              </div> <!-- /.category-block -->
            `;
          }

          content += `</section>`;
        }
      }

      const filterControlsHtml = `
        <section class="filter-bar">
          <div class="filter-row">
            <div class="filter-left">
              <label for="searchInput" class="meal-label">Search:</label>
              <input
                id="searchInput"
                class="search-input"
                type="text"
                placeholder="Search food..."
              />
            </div>
            <div class="filter-right">
              <label for="sortSelect" class="meal-label">Sort:</label>
              <select id="sortSelect" class="meal-select">
                <option value="name">Name (A–Z)</option>
                <option value="up">Most liked</option>
                <option value="down">Most disliked</option>
              </select>
            </div>
          </div>
          ${tagFilterHtml}
        </section>
      `;

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Campus Cafeteria Menu</title>
          <style>
            :root {
              --blue-header: #0b3c79;
              --page-bg: #f3f4f6;
              --card-border: #e5e7eb;
              --card-bg: #ffffff;
            }

            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              margin: 0;
              padding: 0;
              background: var(--page-bg);
              color: #111827;
            }

            header {
              background: var(--blue-header);
              padding: 1rem 2rem;
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: #ffffff;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
              gap: 1.5rem;
            }
            header h1 {
              margin: 0;
              font-size: 1.5rem;
            }
            .subtitle {
              margin-top: 0.2rem;
              font-size: 0.95rem;
              color: #d1d5db;
            }
            .header-right {
              display: flex;
              align-items: center;
              gap: 1rem;
              flex-wrap: wrap;
            }

            main {
              max-width: 1120px;
              margin: 1.5rem auto 3rem;
              padding: 0 1.5rem;
            }

            .filter-bar {
              background: #ffffff;
              border-radius: 0.75rem;
              border: 1px solid #e5e7eb;
              padding: 0.9rem 1rem;
              margin-bottom: 1.25rem;
              box-shadow: 0 1px 3px rgba(0,0,0,0.06);
            }

            .filter-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 1rem;
              flex-wrap: wrap;
              margin-bottom: 0.5rem;
            }

            .filter-left,
            .filter-right {
              display: flex;
              align-items: center;
              gap: 0.4rem;
              flex-wrap: wrap;
            }

            .search-input {
              padding: 0.3rem 0.6rem;
              border-radius: 999px;
              border: 1px solid #d1d5db;
              background: #ffffff;
              color: #111827;
              font-size: 0.9rem;
              min-width: 180px;
            }

            .tag-filter-bar {
              margin-top: 0.5rem;
              display: flex;
              flex-wrap: wrap;
              gap: 0.4rem;
              align-items: center;
            }

            .tag-filter-label {
              font-size: 0.85rem;
              color: #4b5563;
              margin-right: 0.25rem;
            }

            .tag-chip {
              display: inline-flex;
              align-items: center;
              gap: 0.25rem;
              font-size: 0.75rem;
              padding: 0.2rem 0.55rem;
              border-radius: 999px;
              border: 1px solid #d1d5db;
              background: #f9fafb;
              color: #374151;
              cursor: pointer;
              transition: background 0.1s ease, color 0.1s ease, border-color 0.1s ease,
                transform 0.05s ease;
            }

            .tag-chip:hover {
              transform: translateY(-1px);
            }

            .tag-chip.active {
              background: #fee2e2;
              border-color: #ef4444;
              color: #b91c1c;
            }

            .tag-chip-x {
              font-size: 0.75rem;
            }

            .period-block {
              margin-bottom: 2rem;
              background: var(--card-bg);
              border-radius: 0.75rem;
              border: 1px solid #e5e7eb;
              box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
              padding: 1.5rem 1.75rem 1.75rem;
            }
            .period-block h2 {
              margin-top: 0;
              margin-bottom: 1rem;
              font-size: 1.4rem;
            }

            .category-block {
              margin-bottom: 1.5rem;
            }
            .category-block h3 {
              margin: 1rem 0 0.75rem;
              font-size: 1.1rem;
              font-weight: 600;
              border-left: 4px solid #fbbf24;
              padding-left: 0.5rem;
            }

            .card-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
              gap: 1.25rem;
            }

            .food-card {
              background: #ffffff;
              border-radius: 0.75rem;
              border: 1px solid var(--card-border);
              padding: 0.9rem 1rem 1.1rem;
              box-shadow: 0 1px 3px rgba(0,0,0,0.04);
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
            }

            .food-header {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
            }
            .food-name {
              font-weight: 600;
              font-size: 1rem;
              color: #111827;
            }

            .allergy-row {
              display: flex;
              flex-wrap: wrap;
              gap: 0.25rem;
              margin-top: 0.1rem;
            }
            .allergy-tag {
              font-size: 0.7rem;
              padding: 0.15rem 0.55rem;
              border-radius: 999px;
              border: 1px solid #fcd34d;
              background: #fef3c7;
              color: #92400e;
            }

            .ingredients-line {
              font-size: 0.8rem;
              color: #4b5563;
              margin-top: 0.25rem;
            }
            .ingredients-label {
              font-weight: 600;
              color: #111827;
              margin-right: 0.25rem;
            }

            .rating-bar {
              display: flex;
              gap: 0.4rem;
              margin-top: 0.5rem;
              font-size: 0.75rem;
            }
            .rating-pill {
              flex: 1;
              text-align: center;
              padding: 0.25rem 0.4rem;
              border-radius: 0.35rem;
              font-weight: 600;
              color: #ffffff;
              white-space: nowrap;
            }
            .rating-up {
              background: #22c55e;
            }
            .rating-down {
              background: #ef4444;
            }
            .rating-no {
              background: #6b7280;
            }

            .button-row {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 1rem;
            }
            .btn {
              display: inline-block;
              padding: 0.4rem 0.9rem;
              border-radius: 999px;
              border: none;
              background: #2563eb;
              color: white;
              text-decoration: none;
              font-size: 0.9rem;
              cursor: pointer;
              transition: transform 0.1s ease, box-shadow 0.1s ease, background 0.1s ease;
              box-shadow: 0 6px 15px rgba(37, 99, 235, 0.4);
            }
            .btn:hover {
              background: #1d4ed8;
              transform: translateY(-1px);
              box-shadow: 0 8px 20px rgba(37, 99, 235, 0.5);
            }

            .nutrition-btn {
              margin-top: 0.7rem;
              width: 100%;
              border-radius: 0.5rem;
              text-align: center;
            }

            .meal-label {
              font-size: 0.9rem;
              margin-right: 0.3rem;
            }
            .meal-select, .date-input {
              padding: 0.3rem 0.6rem;
              border-radius: 999px;
              border: 1px solid #d1d5db;
              background: #ffffff;
              color: #111827;
              font-size: 0.9rem;
            }

            /* Nutrition Modal */
            .modal-overlay {
              position: fixed;
              inset: 0;
              background: rgba(0,0,0,0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 50;
            }
            .modal-hidden {
              display: none;
            }
            .modal {
              background: #ffffff;
              border-radius: 1rem;
              padding: 1.5rem;
              max-width: 500px;
              width: 90%;
              box-shadow: 0 20px 40px rgba(0,0,0,0.4);
              border: 1px solid #e5e7eb;
              color: #111827;
            }
            .modal-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1rem;
            }
            .modal-title {
              font-size: 1.2rem;
              margin: 0;
            }
            .modal-close {
              background: transparent;
              border: none;
              color: #6b7280;
              font-size: 1.2rem;
              cursor: pointer;
            }
            .modal-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 0.5rem;
            }
            .modal-table th, .modal-table td {
              padding: 0.4rem 0.6rem;
              border-bottom: 1px solid #e5e7eb;
              text-align: left;
              font-size: 0.9rem;
            }
            .modal-table th {
              background: #f3f4f6;
            }
            .food-img-wrapper {
              width: 100%;
              height: 140px;
              border-radius: 0.75rem;
              overflow: hidden;
              background: #f3f4f6;
              border: 1px solid #e5e7eb;
              margin-bottom: 0.75rem;
            }

            .food-img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }

          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>Campus Cafeteria Menu</h1>
              <div class="subtitle">What’s being served</div>
            </div>
            <div class="header-right">
              ${dateSelectHtml}
              ${mealSelectHtml || ""}
            </div>
          </header>
          <main>
            <div class="button-row">
              <a id="reviewLink"
                 href="/reviews?date=${selectedDate}&period=${encodeURIComponent(initialMeal)}"
                 class="btn">
                Review This Meal
              </a>
            </div>
            ${filterControlsHtml}
            ${content}
          </main>

          <!-- Nutrition modal -->
          <div id="nutritionOverlay" class="modal-overlay modal-hidden">
            <div class="modal">
              <div class="modal-header">
                <h2 class="modal-title" id="nutritionTitle">Nutrition</h2>
                <button class="modal-close" id="nutritionClose">&times;</button>
              </div>
              <div id="nutritionBody"></div>
            </div>
          </div>

          <script>
            const SELECTED_DATE = "${selectedDate}";

            document.addEventListener("DOMContentLoaded", () => {
              const mealSelect = document.getElementById("mealSelect");
              const dateInput  = document.getElementById("dateInput");
              const blocks = document.querySelectorAll(".period-block");
              const reviewLink = document.getElementById("reviewLink");

              const searchInput = document.getElementById("searchInput");
              const sortSelect = document.getElementById("sortSelect");

              function updateSections() {
                if (!mealSelect) return;
                const meal = mealSelect.value;
                blocks.forEach(block => {
                  block.style.display = (block.dataset.period === meal) ? "block" : "none";
                });
              }

              function updateReviewLink() {
                if (!reviewLink) return;
                const meal = mealSelect ? mealSelect.value : "${initialMeal}";
                const date = dateInput ? dateInput.value : SELECTED_DATE;
                reviewLink.href = "/reviews?date=" + encodeURIComponent(date)
                                  + "&period=" + encodeURIComponent(meal);
              }

              function applySortAndFilter() {
                const searchTerm = searchInput
                  ? searchInput.value.trim().toLowerCase()
                  : "";
                const excludedTags = Array.from(
                  document.querySelectorAll(".tag-chip.active")
                ).map(chip => (chip.dataset.tag || "").toLowerCase());

                const sortBy = sortSelect ? sortSelect.value : "name";

                document.querySelectorAll(".card-grid").forEach(grid => {
                  const cards = Array.from(grid.querySelectorAll(".food-card"));

                  cards.forEach(card => {
                    let visible = true;
                    const name = (card.dataset.name || "").toLowerCase();
                    const tagsStr = (card.dataset.tags || "").toLowerCase();
                    const tags = tagsStr ? tagsStr.split("|") : [];

                    if (searchTerm && !name.includes(searchTerm)) {
                      visible = false;
                    }

                    if (visible && excludedTags.length > 0) {
                      if (tags.some(t => excludedTags.includes(t))) {
                        visible = false;
                      }
                    }

                    card.style.display = visible ? "flex" : "none";
                  });

                  // sort cards in the DOM (even if hidden)
                  cards.sort((a, b) => {
                    if (sortBy === "up") {
                      const au = parseFloat(a.dataset.up || "0");
                      const bu = parseFloat(b.dataset.up || "0");
                      return bu - au;
                    } else if (sortBy === "down") {
                      const ad = parseFloat(a.dataset.down || "0");
                      const bd = parseFloat(b.dataset.down || "0");
                      return bd - ad;
                    } else {
                      const an = (a.dataset.name || "").toLowerCase();
                      const bn = (b.dataset.name || "").toLowerCase();
                      return an.localeCompare(bn);
                    }
                  });

                  cards.forEach(card => grid.appendChild(card));
                });
              }

              if (mealSelect) {
                updateSections();
                updateReviewLink();
                mealSelect.addEventListener("change", () => {
                  updateSections();
                  updateReviewLink();
                  applySortAndFilter();
                });
              }

              if (dateInput) {
                dateInput.addEventListener("change", () => {
                  const meal = mealSelect ? mealSelect.value : "${initialMeal}";
                  const date = dateInput.value;
                  if (!date) return;
                  window.location = "/?date=" + encodeURIComponent(date)
                                   + "&period=" + encodeURIComponent(meal);
                });
              }

              if (searchInput) {
                searchInput.addEventListener("input", applySortAndFilter);
              }

              if (sortSelect) {
                sortSelect.addEventListener("change", applySortAndFilter);
              }

              document.querySelectorAll(".tag-chip").forEach(chip => {
                chip.addEventListener("click", () => {
                  chip.classList.toggle("active");
                  applySortAndFilter();
                });
              });

              // run once to apply default sort/filter
              applySortAndFilter();

              // nutrition modal
              const overlay = document.getElementById("nutritionOverlay");
              const closeBtn = document.getElementById("nutritionClose");
              const bodyDiv = document.getElementById("nutritionBody");
              const titleEl = document.getElementById("nutritionTitle");

              function openModal() { overlay.classList.remove("modal-hidden"); }
              function closeModal() { overlay.classList.add("modal-hidden"); }

              overlay.addEventListener("click", (e) => {
                if (e.target === overlay) closeModal();
              });
              if (closeBtn) closeBtn.addEventListener("click", closeModal);

              document.querySelectorAll(".btn-nutrition").forEach(btn => {
                btn.addEventListener("click", async () => {
                  const foodId = btn.dataset.foodId;
                  const foodName = btn.dataset.foodName || "Nutrition Facts";
                  titleEl.textContent = foodName + " - Nutrition";

                  bodyDiv.innerHTML = "<p>Loading...</p>";
                  openModal();

                  try {
                    const resp = await fetch("/nutrition/" + foodId);
                    if (!resp.ok) {
                      bodyDiv.innerHTML = "<p>Could not load nutrition data.</p>";
                      return;
                    }
                    const data = await resp.json();
                    if (!data.nutrients || data.nutrients.length === 0) {
                      bodyDiv.innerHTML = "<p>No nutrition data available.</p>";
                      return;
                    }

                    let tableHtml = '<table class="modal-table"><thead><tr><th>Nutrient</th><th>Amount</th></tr></thead><tbody>';
                    for (const n of data.nutrients) {
                      const amount = n.value_numeric !== null && n.value_numeric !== undefined
                        ? n.value_numeric + (n.unit ? " " + n.unit : "")
                        : (n.value_raw || "-");
                      tableHtml += "<tr><td>" + n.name + "</td><td>" + amount + "</td></tr>";
                    }
                    tableHtml += "</tbody></table>";
                    bodyDiv.innerHTML = tableHtml;
                  } catch (err) {
                    console.error(err);
                    bodyDiv.innerHTML = "<p>Error loading nutrition data.</p>";
                  }
                });
              });
            });
          </script>
        </body>
        </html>
      `;

      res.send(html);
    });
  });
});


// ---------- NUTRITION API ----------
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

// ---------- REVIEW PAGE (with swipe animation) ----------
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

    // attach allergen info for review cards
    const itemsWithAllergy = (rows || []).map(r => ({
      ...r,
      allergyTags: getAllergyTags(r.ingredients),
    }));

    const itemsJson = JSON.stringify(itemsWithAllergy || []);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Review ${periodName} - ${date}</title>
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            margin: 0;
            padding: 0;
            background: #020617;
            color: #e5e7eb;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }
          header {
            background: #111827;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #374151;
          }
          header h1 {
            margin: 0;
            font-size: 1.4rem;
          }
          .subtitle {
            font-size: 0.95rem;
            color: #9ca3af;
          }
          .date-pill {
            padding: 0.25rem 0.75rem;
            border-radius: 999px;
            border: 1px solid #4b5563;
            font-size: 0.85rem;
          }
          main {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 2rem 1rem;
          }
          .card {
            background: #0b1120;
            border-radius: 1.5rem;
            padding: 2rem;
            box-shadow: 0 20px 40px rgba(0,0,0,0.8);
            border: 1px solid #374151;
            width: 100%;
            max-width: 500px;
            text-align: center;
            /* animation base */
            transform: translateX(0) translateY(0) rotate(0deg);
            opacity: 1;
            transition: transform 0.4s ease, opacity 0.4s ease;
          }
          .card.swipe-right {
            transform: translateX(120%) rotate(10deg);
            opacity: 0;
          }
          .card.swipe-left {
            transform: translateX(-120%) rotate(-10deg);
            opacity: 0;
          }
          .card.swipe-up {
            transform: translateY(-120%) rotate(0deg);
            opacity: 0;
          }
          .card-title {
            font-size: 1.6rem;
            margin-bottom: 0.5rem;
          }
          .card-subtitle {
            font-size: 0.9rem;
            color: #9ca3af;
            margin-bottom: 1rem;
          }
          .legend {
            display: flex;
            justify-content: space-around;
            margin-top: 1.5rem;
            font-size: 0.9rem;
          }
          .legend span {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.25rem;
          }
          .legend-key {
            padding: 0.2rem 0.6rem;
            border-radius: 999px;
            border: 1px solid #4b5563;
            font-size: 0.8rem;
          }
          .legend-upvote { border-color: #22c55e; }
          .legend-downvote { border-color: #ef4444; }
          .legend-no { border-color: #f97316; }
          .progress {
            margin-top: 1rem;
            font-size: 0.9rem;
            color: #9ca3af;
          }
          .empty-message {
            text-align: center;
            color: #9ca3af;
          }
          .btn-back {
            color: #93c5fd;
            text-decoration: none;
            font-size: 0.9rem;
          }
          .btn-back:hover {
            text-decoration: underline;
          }
          .allergy-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
            margin: 0.5rem 0;
            justify-content: center;
          }
          .allergy-chip {
            padding: 0.1rem 0.45rem;
            border-radius: 999px;
            font-size: 0.7rem;
            border: 1px solid #f97316;
            color: #fed7aa;
            background: rgba(248, 115, 22, 0.15);
          }
          .ingredients-review {
            margin-top: 0.5rem;
            font-size: 0.8rem;
            color: #9ca3af;
          }
          .ingredients-review strong {
            color: #e5e7eb;
          }
          .card-image-wrapper {
            margin: 1rem auto 0.75rem;
            max-width: 260px;
          }

          .card-image {
            width: 100%;
            height: 180px;
            object-fit: cover;
            border-radius: 1rem;
            border: 1px solid #374151;
            background: #020617;
          }

        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Review ${periodName}</h1>
            <div class="subtitle">Use arrow keys: ← dislike, ↑ didn't try, → like</div>
          </div>
          <div class="date-pill">${date}</div>
        </header>
        <main>
          <div id="reviewRoot"></div>
        </main>
        <script>
  const items = ${itemsJson};
  let index = 0;
  let isAnimating = false;

  function render() {
    const root = document.getElementById("reviewRoot");
    if (!items || items.length === 0) {
      root.innerHTML = '<div class="empty-message"><p>No items found for this date/meal.</p><p><a class="btn-back" href="/">Back to home</a></p></div>';
      return;
    }
    if (index >= items.length) {
      root.innerHTML = '<div class="empty-message"><p>All items reviewed. Thank you!</p><p><a class="btn-back" href="/">Back to home</a></p></div>';
      return;
    }

    const item = items[index];
    const allergyChips = (item.allergyTags && item.allergyTags.length)
      ? '<div class="allergy-chips">' +
          item.allergyTags.map(t => '<span class="allergy-chip">' + t + '</span>').join('') +
        '</div>'
      : '';

    const ingredientsLine = item.ingredients
      ? '<div class="ingredients-review"><strong>Ingredients:</strong> ' + item.ingredients + '</div>'
      : '';

    const imageHtml = \`
      <div class="card-image-wrapper">
        <img
          class="card-image"
          src="\${item.image_url || "/static/images/placeholder-large.png"}"
          alt="\${item.food_name}"
          onerror="this.src='/static/images/placeholder-large.png';"
        />
      </div>
    \`;

    root.innerHTML = \`
      <div class="card">
        <div class="card-title">\${item.food_name}</div>
        <div class="card-subtitle">Use ← 👎, ↑ 🤷, → 👍 to vote</div>
        \${imageHtml}
        <div style="margin-top:0.75rem; font-size:0.8rem; color:#9ca3af;">
          <div style="margin-bottom:0.35rem;">Upload a better photo:</div>
          <input id="photoInput" type="file" accept="image/*" />
          <button id="uploadBtn"
            style="padding:0.3rem 0.8rem; border-radius:999px; background:#2563eb; color:white; border:none; cursor:pointer; margin-top:0.35rem;">
            Upload
          </button>
        </div>

        \${allergyChips}
        \${ingredientsLine}
        <div class="legend">
          <span>
            <div class="legend-key legend-downvote">←</div>
            <div>Downvote</div>
          </span>
          <span>
            <div class="legend-key legend-no">↑</div>
            <div>Did Not Try</div>
          </span>
          <span>
            <div class="legend-key legend-upvote">→</div>
            <div>Upvote</div>
          </span>
        </div>
        <div class="progress">Item \${index + 1} of \${items.length}</div>
        <div style="margin-top:1rem;font-size:0.8rem;color:#6b7280;">
          (Each keypress records a vote. Refresh to start over.)
        </div>
      </div>
    \`;

    // hook up upload button for this freshly-rendered card
    attachUploadHandlers();

    isAnimating = false; // reset for new card
  }

  function attachUploadHandlers() {
    const input = document.getElementById("photoInput");
    const btn = document.getElementById("uploadBtn");
    const img = document.querySelector(".card-image");

    if (!input || !btn || !img) return;

    btn.addEventListener("click", async () => {
      if (!input.files || !input.files[0]) {
        alert("Pick a photo first");
        return;
      }

      const item = items[index];
      const form = new FormData();
      form.append("photo", input.files[0]);

      try {
        const resp = await fetch("/api/foods/" + item.food_id + "/image", {
          method: "POST",
          body: form,
        });

        if (!resp.ok) {
          alert("Upload failed");
          return;
        }

        const data = await resp.json();
        if (!data.imageUrl) {
          alert("Upload failed");
          return;
        }

        // Force browser to reload updated file
        img.src = data.imageUrl + "?t=" + Date.now();

        // Update in-memory list so next card uses new photo
        item.image_url = data.imageUrl;
      } catch (err) {
        alert("Upload failed");
        console.error(err);
      } finally {
        // clear the input so they can pick another file if they want
        input.value = "";
      }
    });
  }

  async function sendVote(foodId, rating) {
    try {
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foodId, rating })
      });
    } catch (e) {
      console.error("Failed to send vote", e);
    }
  }

  function animateSwipe(direction) {
    const card = document.querySelector(".card");
    if (!card) {
      index++;
      render();
      return;
    }
    card.classList.add("swipe-" + direction);
    setTimeout(() => {
      index++;
      render();
    }, 400); // match CSS transition time
  }

  document.addEventListener("keydown", (e) => {
    if (!items || items.length === 0) return;
    if (index >= items.length) return;
    if (isAnimating) return;

    let rating = null;
    let dir = null;

    if (e.key === "ArrowLeft") {
      rating = -1; // downvote
      dir = "left";
    } else if (e.key === "ArrowRight") {
      rating = 1; // upvote
      dir = "right";
    } else if (e.key === "ArrowUp") {
      rating = 0; // did not try
      dir = "up";
    } else {
      return; // ignore other keys
    }

    const item = items[index];
    isAnimating = true;
    sendVote(item.food_id, rating); // fire-and-forget
    animateSwipe(dir);
  });

  render();
</script>

      </body>
      </html>
    `;

    res.send(html);
  });
});

// ---------- REVIEW API (record votes) ----------
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

// ---------- Image Upload Setup ----------
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
    // Always overwrite the same filename
    cb(null, `food-${foodId}${ext}`);
  }
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ---------- Upload and Overwrite Food Image ----------
app.post("/api/foods/:foodId/image", imageUpload.single("photo"), (req, res) => {
  const foodId = req.params.foodId;

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // This URL will always stay the same
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


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
