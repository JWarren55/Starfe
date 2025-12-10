// Home page JavaScript
document.addEventListener("DOMContentLoaded", () => {
  const mealSelect = document.getElementById("mealSelect");
  const dateInput = document.getElementById("dateInput");
  const blocks = document.querySelectorAll(".period-block");
  const reviewLink = document.getElementById("reviewLink");

  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");

  const SELECTED_DATE = document.body.dataset.selectedDate || new Date().toISOString().split('T')[0];

  function updateSections() {
    if (!mealSelect) return;
    const meal = mealSelect.value;
    blocks.forEach(block => {
      block.style.display = (block.dataset.period === meal) ? "block" : "none";
    });
  }

  function updateReviewLink() {
    if (!reviewLink) return;
    const meal = mealSelect ? mealSelect.value : "Breakfast";
    const date = dateInput ? dateInput.value : SELECTED_DATE;
    reviewLink.href = "/reviews?date=" + encodeURIComponent(date)
                      + "&period=" + encodeURIComponent(meal);
  }

  function applySortAndFilter() {
    const searchTerm = searchInput
      ? searchInput.value.trim().toLowerCase()
      : "";
    
    // Get all active tag chips and normalize their tag values
    const excludedTags = Array.from(
      document.querySelectorAll(".tag-chip.active")
    ).map(chip => (chip.dataset.tag || "").trim());

    const sortBy = sortSelect ? sortSelect.value : "name";

    document.querySelectorAll(".card-grid").forEach(grid => {
      const cards = Array.from(grid.querySelectorAll(".food-card"));

      cards.forEach(card => {
        let visible = true;
        const name = (card.dataset.name || "").toLowerCase();
        const tagsStr = (card.dataset.tags || "");
        const tags = tagsStr ? tagsStr.split("|").map(t => t.trim()) : [];

        // Search filter
        if (searchTerm && !name.includes(searchTerm)) {
          visible = false;
        }

        // Tag exclusion filter - hide if card has any of the excluded tags
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
      const meal = mealSelect ? mealSelect.value : "Breakfast";
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
