// fetchImages.js
//
// Uses the free Foodish API (https://foodish-api.com/) to assign
// a food-ish image to each row in the `foods` table.
//
// For each food with no image_url:
//   1. Look at the food name
//   2. Guess a Foodish category (pizza, burger, pasta, dessert, rice, etc.)
//   3. Call Foodish to get a random image in that category
//   4. Download that image to public/images/<foodId>.jpg
//   5. Set foods.image_url = /static/images/<foodId>.jpg
//
// No API key, no credit card, no .env needed.
//
// Run with:
//   npm install node-fetch@2
//   node fetchImages.js

const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fetch = require("node-fetch"); // npm install node-fetch@2

// ----- DB + paths ---------------------------------------------------------

const dbPath = path.join(__dirname, "cafeteria.db");
const db = new sqlite3.Database(dbPath);

const IMAGES_DIR = path.join(__dirname, "public", "images");
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      return err ? reject(err) : resolve(this);
    });
  });
}

// ----- Category guessing based on food name -------------------------------

function pickFoodishCategory(foodName) {
  const name = (foodName || "").toLowerCase();
  const has = (...words) => words.some((w) => name.includes(w));

  // Pizza / flatbreads
  if (has("pizza", "flatbread", "pepperoni", "margherita", "pizzetta")) {
    return "pizza";
  }

  // Burgers / sandwiches / wraps / hot dogs
  if (
    has(
      "burger",
      "cheeseburger",
      "slider",
      "sandwich",
      "panini",
      "sub",
      "hoagie",
      "wrap",
      "gyro",
      "hot dog",
      "corn dog",
      "po'boy"
    )
  ) {
    return "burger";
  }

  // Pasta / noodles / mac & cheese
  if (
    has(
      "pasta",
      "spaghetti",
      "lasagna",
      "lasagne",
      "macaroni",
      "mac and cheese",
      "mac & cheese",
      "alfredo",
      "noodle",
      "noodles",
      "penne",
      "fettuccine",
      "fettucine",
      "ravioli"
    )
  ) {
    return "pasta";
  }

  // Desserts / sweets
  if (
    has(
      "cookie",
      "brownie",
      "cake",
      "cupcake",
      "muffin",
      "pie",
      "cobbler",
      "crisp",
      "pudding",
      "ice cream",
      "sundae",
      "dessert",
      "cheesecake",
      "donut",
      "doughnut",
      "tart",
      "brownies",
      "cookies",
      "pastry"
    )
  ) {
    return "dessert";
  }

  // Explicit Indian dishes that have direct categories
  if (has("biryani")) return "biryani";
  if (has("dosa")) return "dosa";
  if (has("idli", "idly")) return "idly";
  if (has("samosa")) return "samosa";

  // Rice / bowls / stir-fry / curry
  if (
    has(
      "rice",
      "fried rice",
      "stir fry",
      "stir-fry",
      "stirfry",
      "curry",
      "bowl",
      "poke",
      "poké",
      "lo mein",
      "chow mein",
      "teriyaki"
    )
  ) {
    return "rice";
  }

  // Soups / stews / chili – bowl-ish → use rice category
  if (has("soup", "stew", "chili", "broth", "bisque")) {
    return "rice";
  }

  // Salads / greens – no salad category → rice (light/healthy-ish)
  if (
    has(
      "salad",
      "greens",
      "lettuce",
      "spinach",
      "kale",
      "caesar",
      "cobb salad",
      "garden salad",
      "spring mix"
    )
  ) {
    return "rice";
  }

  // Sides: potatoes / fries – usually next to burgers
  if (
    has(
      "fries",
      "fry",
      "tots",
      "tater tot",
      "tater tots",
      "wedge",
      "hash brown",
      "hashbrowns",
      "potato",
      "mashed potato",
      "baked potato",
      "home fries"
    )
  ) {
    return "burger";
  }

  // Breakfast items – map to burger (plate-like)
  if (
    has(
      "breakfast",
      "omelet",
      "omelette",
      "pancake",
      "waffle",
      "french toast",
      "bacon",
      "sausage",
      "scramble",
      "scrambled eggs",
      "egg",
      "eggs",
      "hash",
      "toast",
      "bagel"
    )
  ) {
    return "burger";
  }

  // Mexican-ish stuff – bowls/tacos → rice
  if (has("burrito", "taco", "quesadilla", "enchilada", "nachos", "fajita", "chimichanga")) {
    return "rice";
  }

  // If nothing matches, generic "meal in a bowl/plate"
  return "rice";
}

// ----- Foodish API helpers -----------------------------------------------

async function getFoodishImage(category) {
  const url = `https://foodish-api.com/api/images/${category}`;
  console.log("  Foodish URL:", url);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Foodish API failed: " + res.status + " " + res.statusText);
  }

  const data = await res.json();
  if (!data.image) {
    throw new Error("Foodish response missing .image");
  }

  return data.image; // direct image URL
}

async function searchImageForFood(foodName) {
  const category = pickFoodishCategory(foodName);
  console.log(`  Using category "${category}" for "${foodName}"`);
  return await getFoodishImage(category);
}

// ----- Download helper ---------------------------------------------------

async function downloadImage(imageUrl, destPath) {
  console.log("  Downloading:", imageUrl);
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error("Image download failed: " + res.status + " " + res.statusText);
  }
  const buffer = await res.buffer();
  fs.writeFileSync(destPath, buffer);
}

// ----- Main --------------------------------------------------------------

async function main() {
  console.log("DB:", dbPath);

  // Ensure image_url column exists
  const cols = await all("PRAGMA table_info(foods)");
  const colNames = cols.map((c) => c.name);
  if (!colNames.includes("image_url")) {
    console.log("Adding image_url column to foods...");
    await run("ALTER TABLE foods ADD COLUMN image_url TEXT");
  }

  // Get foods that don't have images yet
  const foods = await all(
    "SELECT id, name FROM foods WHERE image_url IS NULL OR image_url = '' ORDER BY id LIMIT 200"
  );

  console.log("Foods needing images:", foods.length);
  if (foods.length === 0) {
    console.log("Nothing to do.");
    db.close();
    return;
  }

  for (const food of foods) {
    console.log(`\nProcessing food ${food.id} - ${food.name}`);
    try {
      const imageUrl = await searchImageForFood(food.name);

      const filename = `${food.id}.jpg`;
      const localPath = path.join(IMAGES_DIR, filename);
      await downloadImage(imageUrl, localPath);

      const dbUrl = `/static/images/${filename}`;
      await run("UPDATE foods SET image_url = ? WHERE id = ?", [dbUrl, food.id]);

      console.log("  Saved image for", food.name, "->", dbUrl);

      // tiny delay to be nice to the API
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      console.error("  Failed for", food.name, "-", err.message);
    }
  }

  console.log("\nDone. Closing DB.");
  db.close();
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  db.close();
});
