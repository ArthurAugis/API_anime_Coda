const express = require("express");
const router = express.Router();
const cache = require("node-cache");
const { queryDatabase } = require("../db");

const apiCache = new cache({ stdTTL: 60 });

router.get("/", async (req, res) => {
  const cached = apiCache.get("langues");
  if (cached) return res.json(cached);

  try {
    const data = await queryDatabase("SELECT * FROM tab_langues");
    apiCache.set("langues", data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
