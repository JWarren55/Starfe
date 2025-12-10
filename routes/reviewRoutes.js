const express = require("express");
const router = express.Router();
const { getAllergyTags } = require("../utils/allergyDetection");
const { getTodayDateString } = require("../utils/dateUtils");

/**
 * GET /reviews - Review page with swipe animation
 */
router.get("/", (req, res) => {
  const db = req.app.locals.db;
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

            attachUploadHandlers();
            isAnimating = false;
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

                img.src = data.imageUrl + "?t=" + Date.now();
                item.image_url = data.imageUrl;
              } catch (err) {
                alert("Upload failed");
                console.error(err);
              } finally {
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
            }, 400);
          }

          document.addEventListener("keydown", (e) => {
            if (!items || items.length === 0) return;
            if (index >= items.length) return;
            if (isAnimating) return;

            let rating = null;
            let dir = null;

            if (e.key === "ArrowLeft") {
              rating = -1;
              dir = "left";
            } else if (e.key === "ArrowRight") {
              rating = 1;
              dir = "right";
            } else if (e.key === "ArrowUp") {
              rating = 0;
              dir = "up";
            } else {
              return;
            }

            const item = items[index];
            isAnimating = true;
            sendVote(item.food_id, rating);
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

module.exports = router;
