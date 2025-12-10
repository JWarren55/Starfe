// Reviews page JavaScript
let items = [];
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

  const imageHtml = `
    <div class="card-image-wrapper">
      <img
        class="card-image"
        src="${item.image_url || "/static/images/placeholder-large.png"}"
        alt="${item.food_name}"
        onerror="this.src='/static/images/placeholder-large.png';"
      />
    </div>
  `;

  root.innerHTML = `
    <div class="card">
      <div class="card-title">${item.food_name}</div>
      <div class="card-subtitle">Use ← 👎, ↑ 🤷, → 👍 to vote</div>
      ${imageHtml}
      <div style="margin-top:0.75rem; font-size:0.8rem; color:#9ca3af;">
        <div style="margin-bottom:0.35rem;">Upload a better photo:</div>
        <input id="photoInput" type="file" accept="image/*" />
        <button id="uploadBtn"
          style="padding:0.3rem 0.8rem; border-radius:999px; background:#2563eb; color:white; border:none; cursor:pointer; margin-top:0.35rem;">
          Upload
        </button>
      </div>

      ${allergyChips}
      ${ingredientsLine}
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
      <div class="progress">Item ${index + 1} of ${items.length}</div>
      <div style="margin-top:1rem;font-size:0.8rem;color:#6b7280;">
        (Each keypress records a vote. Refresh to start over.)
      </div>
    </div>
  `;

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

document.addEventListener("DOMContentLoaded", () => {
  const itemsScript = document.getElementById("items-data");
  if (itemsScript) {
    try {
      items = JSON.parse(itemsScript.textContent);
    } catch (e) {
      console.error("Failed to parse items data:", e);
      items = [];
    }
  }
  render();
});
