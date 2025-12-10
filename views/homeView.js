/**
 * Home page view renderer
 */
const { getAllergyTags } = require("../utils/allergyDetection");
const { getTodayDateString } = require("../utils/dateUtils");
const { styles } = require("./homeStyles");

function renderHomePage(db, selectedDate, requestedDate, requestedPeriod) {
  return new Promise((resolve, reject) => {
    const today = getTodayDateString();
    const dateSql = `
      SELECT DISTINCT menu_date
      FROM menu_items
      ORDER BY menu_date DESC
    `;

    db.all(dateSql, [], (err, dateRows) => {
      if (err) {
        console.error("DB error (dates):", err);
        return reject(new Error("Database error"));
      }

      const dates = dateRows.map(r => r.menu_date);
      selectedDate =
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
          return reject(new Error("Database error"));
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
              ${styles}
            </style>
          </head>
          <body>
            <header>
              <div>
                <h1>Campus Cafeteria Menu</h1>
                <div class="subtitle">What's being served</div>
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

        resolve(html);
      });
    });
  });
}

module.exports = { renderHomePage };
