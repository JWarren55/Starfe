/**
 * HTML and CSS for the home page styles
 */
const styles = `
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
`;

module.exports = { styles };
