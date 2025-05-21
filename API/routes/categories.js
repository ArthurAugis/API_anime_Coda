const express = require("express");
const router = express.Router();
const cache = require("node-cache");
const { queryDatabase } = require("../db");

const apiCache = new cache({ stdTTL: 60 });

router.get("/", async (req, res) => {
  const cached = apiCache.get("categories");
  if (cached) return res.json(cached);

  try {
    const data = await queryDatabase("SELECT * FROM tab_categories");
    apiCache.set("categories", data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
