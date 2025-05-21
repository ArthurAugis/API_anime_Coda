const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

router.post("/", async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) return res.status(400).json({ error: "Login et mot de passe requis." });

  const token = jwt.sign({ userId: login }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "1h" });
  res.json({ token });
});

module.exports = router;
