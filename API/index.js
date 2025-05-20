/**
 * API Anime Coda
 */

const mysql = require("mysql2/promise");
const express = require("express");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const cors = require("cors");
const NodeCache = require("node-cache"); 
const app = express();
const port = 3000;

// Initialisation du cache (TTL 60s)
const cache = new NodeCache({ stdTTL: 60 });

// Middlewares globaux
app.use(cors());
app.use(express.json());

// Utilitaire : Connexion et requête SQL
async function queryDatabase(query, params = []) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [rows] = await connection.execute(query, params);
    return rows;
  } catch (error) {
    console.error("Error executing query:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Middleware d'authentification JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token manquant" });

  jwt.verify(token, process.env.JWT_SECRET || "dev_secret", (err, user) => {
    if (err) return res.status(403).json({ error: "Token invalide" });
    req.user = user;
    next();
  });
}

// Utilitaire pour requête SQL anime (paginée ou par id)
function getAnimeQuery({ byId = false } = {}) {
  return `
    SELECT 
      la.id, 
      la.nom AS nom_anime, 
      la.nom_url AS nom_url_anime, 
      la.affiche_url AS affiche_anime, 
      la.description AS description_anime,
      GROUP_CONCAT(DISTINCT l.nom ORDER BY l.nom SEPARATOR ', ') AS langue_anime,
      GROUP_CONCAT(DISTINCT c.nom ORDER BY c.nom SEPARATOR ', ') AS categorie_anime,
      COUNT(DISTINCT ts.id) AS saisons_anime,
      MAX(episode_stats.episode_count) AS episodes_anime
    FROM tab_liste_anime la
    LEFT JOIN tab_parler p ON p.anime = la.id
    LEFT JOIN tab_langues l ON l.id = p.langue
    LEFT JOIN tab_categoriser ca ON ca.anime = la.id
    LEFT JOIN tab_categories c ON c.id = ca.categorie
    LEFT JOIN tab_saisons ts ON ts.anime = la.id
    LEFT JOIN (
      SELECT s.anime, COUNT(e.id) AS episode_count, e.langue
      FROM tab_saisons s
      JOIN tab_episodes e ON e.saison = s.id
      GROUP BY s.anime, e.langue
    ) AS episode_stats ON episode_stats.anime = la.id
    ${byId ? "WHERE la.id = ?" : ""}
    GROUP BY la.id
    ORDER BY la.nom ASC
    ${byId ? "" : "LIMIT ? OFFSET ?;"}
  `;
}


// ROUTES

// Récupérer la liste paginée des animés (avec recherche)
app.get("/animes", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 10, 100));
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : null;

  const cacheKey = `animes_${page}_${limit}_${req.query.search || ""}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Total pour la pagination
    const totalQuery = search
      ? "SELECT COUNT(*) AS total FROM tab_liste_anime WHERE nom LIKE ?"
      : "SELECT COUNT(*) AS total FROM tab_liste_anime";
    const totalParams = search ? [search] : [];
    const totalRows = await queryDatabase(totalQuery, totalParams);
    const total = totalRows[0].total;

    // Sélection paginée
    let sql = getAnimeQuery();
    let params = [];
    if (search) {
      sql = sql.replace("GROUP BY la.id", "WHERE la.nom LIKE ? GROUP BY la.id");
      params.push(search);
    }
    params.push(limit, offset);

    const animes = await queryDatabase(sql, params);

    const response = { data: animes, total, page, limit };
    cache.set(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des animés." });
  }
});

// Récupérer un animé par ID
app.get("/animes/:id", async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "ID invalide" });

  const cacheKey = `anime_${id}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const anime = await queryDatabase(getAnimeQuery({ byId: true }), [id]);
    if (anime.length === 0) {
      return res.status(404).json({ error: "Animé non trouvé." });
    }
    cache.set(cacheKey, anime[0]);
    res.json(anime[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur lors de la récupération de l'animé." });
  }
});

// Récupérer toutes les catégories
app.get("/categories", async (req, res) => {
  const cacheKey = "categories";
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const categories = await queryDatabase("SELECT * FROM tab_categories");
    cache.set(cacheKey, categories);
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des catégories." });
  }
});

// Récupérer toutes les langues 
app.get("/langues", async (req, res) => {
  const cacheKey = "langues";
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const langues = await queryDatabase("SELECT * FROM tab_langues");
    cache.set(cacheKey, langues);
    res.json(langues);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des langues." });
  }
});

// Authentification fictive
app.post("/login", async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: "Login et mot de passe requis." });
  }

  // Génère un JWT avec le login comme userId
  const token = jwt.sign(
    { userId: login },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "1h" }
  );

  res.json({ token });
});

// Création d'un animé (authentifié)
app.post("/animes", authenticateToken, async (req, res) => {
  const { nom, nom_url, affiche_url, description, categories = [], langues = [] } = req.body;

  // Validation basique
  if (!nom || !nom_url) {
    return res.status(400).json({ error: "Champs requis manquants." });
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await conn.beginTransaction();

    // Insertion de l'anime
    const [animeResult] = await conn.execute(
      `INSERT INTO tab_liste_anime (nom, nom_url, affiche_url, description) VALUES (?, ?, ?, ?)`,
      [nom, nom_url, affiche_url || null, description || null]
    );
    const animeId = animeResult.insertId;

    // Insertion des catégories
    for (const catId of categories) {
      if (!/^\d+$/.test(catId)) continue;
      await conn.execute(`INSERT INTO tab_categoriser (anime, categorie) VALUES (?, ?)`, [animeId, catId]);
    }

    // Insertion des langues
    for (const langId of langues) {
      if (!/^\d+$/.test(langId)) continue;
      await conn.execute(`INSERT INTO tab_parler (anime, langue) VALUES (?, ?)`, [animeId, langId]);
    }

    await conn.commit();
    cache.flushAll(); // Invalide le cache après modification
    res.status(201).json({ message: "Animé créé avec succès", id: animeId });
  } catch (err) {
    await conn.rollback();
    console.error("Erreur création animé :", err);
    res.status(500).json({ error: "Erreur serveur lors de la création de l'animé." });
  } finally {
    await conn.end();
  }
});

// Modification d'un animé (authentifié)
app.put("/animes/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { nom, nom_url, affiche_url, description, categories = [], langues = [] } = req.body;

  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "ID invalide" });

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await conn.beginTransaction();

    // Mise à jour de l'anime
    const [updateResult] = await conn.execute(
      `UPDATE tab_liste_anime SET nom = ?, nom_url = ?, affiche_url = ?, description = ? WHERE id = ?`,
      [nom, nom_url, affiche_url || null, description || null, id]
    );

    if (updateResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Animé non trouvé." });
    }

    // Suppression des anciennes associations
    await conn.execute(`DELETE FROM tab_categoriser WHERE anime = ?`, [id]);
    await conn.execute(`DELETE FROM tab_parler WHERE anime = ?`, [id]);

    // Ajout des nouvelles associations
    for (const catId of categories) {
      if (!/^\d+$/.test(catId)) continue;
      await conn.execute(`INSERT INTO tab_categoriser (anime, categorie) VALUES (?, ?)`, [id, catId]);
    }
    for (const langId of langues) {
      if (!/^\d+$/.test(langId)) continue;
      await conn.execute(`INSERT INTO tab_parler (anime, langue) VALUES (?, ?)`, [id, langId]);
    }

    await conn.commit();
    cache.flushAll(); // Invalide le cache après modification
    res.json({ message: "Animé modifié avec succès." });
  } catch (err) {
    await conn.rollback();
    console.error("Erreur modification animé :", err);
    res.status(500).json({ error: "Erreur serveur lors de la modification de l'animé." });
  } finally {
    await conn.end();
  }
});

// Suppression d'un animé (authentifié)
app.delete("/animes/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: "ID invalide" });

  try {
    const result = await queryDatabase(`DELETE FROM tab_liste_anime WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Animé non trouvé." });
    }
    cache.flushAll(); // Invalide le cache après modification
    res.json({ message: "Animé supprimé avec succès." });
  } catch (err) {
    console.error("Erreur suppression animé :", err);
    res.status(500).json({ error: "Erreur serveur lors de la suppression de l'animé." });
  }
});

// 404 pour les routes inconnues
app.use((req, res) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// Lancement du serveur
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});