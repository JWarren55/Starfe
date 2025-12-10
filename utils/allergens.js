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

module.exports = { getAllergyTags };
