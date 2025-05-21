const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

// Middleware de vérification JWT
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
}

// Utilitaire pour générer une requête SQL pour récupérer les animés
function getAnimeQuery({ search = '', id = null, limit = null, offset = null } = {}) {
  let sql = `
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
  `;
  const params = [];
  if (id !== null) {
    sql += " WHERE la.id = ?";
    params.push(id);
  } else if (search) {
    sql += " WHERE la.nom LIKE ?";
    params.push(`%${search}%`);
  }
  sql += " GROUP BY la.id ORDER BY la.nom ASC";
  if (limit !== null && offset !== null && id === null) {
    sql += " LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));
  }
  return { query: sql, params };
}



// Liste paginée + recherche
router.get('/', async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;
  const cacheKey = `animes:${page}:${limit}:${search}`;

  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }

  try {
    let countQuery = "SELECT COUNT(*) as total FROM tab_liste_anime";
    let countParams = [];
    if (search) {
      countQuery += " WHERE nom LIKE ?";
      countParams.push(`%${search}%`);
    }
    const totalRows = await db.queryDatabase(countQuery, countParams);
    const total = totalRows[0].total;

    const { query, params } = getAnimeQuery({ search, limit, offset });
    const rows = await db.queryDatabase(query, params);

    const response = { data: rows, total, page: Number(page), limit: Number(limit) };
    cache.set(cacheKey, response);
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Détails par ID
router.get('/:id', async (req, res) => {
  const animeId = req.params.id;

  try {
    const { query, params } = getAnimeQuery({ id: animeId });
    const rows = await db.queryDatabase(query, params);

    if (rows.length === 0) return res.status(404).json({ error: 'Anime introuvable' });

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter un anime
router.post("/", verifyToken, async (req, res) => {
  const { nom, nom_url, affiche_url, description, categories = [], langues = [] } = req.body;

  // Validation basique
  if (!nom || !nom_url) {
    return res.status(400).json({ error: "Champs requis manquants." });
  }

  const conn = await db.pool.getConnection();
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
    conn.release();
  }
});

// Modifier un anime
router.put('/:id', verifyToken, async (req, res) => {
  const animeId = req.params.id;
  const { nom, nom_url, affiche_url, description, categories = [], langues = [] } = req.body;

  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();

    // Mise à jour de l'anime
    await conn.execute(
      `UPDATE tab_liste_anime SET nom = ?, nom_url = ?, affiche_url = ?, description = ? WHERE id = ?`,
      [nom, nom_url, affiche_url || null, description || null, animeId]
    );

    // Suppression des anciennes associations
    await conn.execute(`DELETE FROM tab_categoriser WHERE anime = ?`, [animeId]);
    await conn.execute(`DELETE FROM tab_parler WHERE anime = ?`, [animeId]);

    // Ajout des nouvelles associations catégories
    for (const catId of categories) {
      if (!/^\d+$/.test(catId)) continue;
      await conn.execute(
        `INSERT INTO tab_categoriser (anime, categorie) VALUES (?, ?)`,
        [animeId, catId]
      );
    }

    // Ajout des nouvelles associations langues
    for (const langId of langues) {
      if (!/^\d+$/.test(langId)) continue;
      await conn.execute(
        `INSERT INTO tab_parler (anime, langue) VALUES (?, ?)`,
        [animeId, langId]
      );
    }

    await conn.commit();
    cache.flushAll(); // Invalide le cache
    res.json({ message: 'Animé modifié' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    conn.release();
  }
});

// Supprimer un anime
router.delete('/:id', verifyToken, async (req, res) => {
  const animeId = req.params.id;
  if (!/^\d+$/.test(animeId)) return res.status(400).json({ error: "ID invalide" });

  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();

    // Supprimer les associations (langues, catégories)
    await conn.execute(`DELETE FROM tab_categoriser WHERE anime = ?`, [animeId]);
    await conn.execute(`DELETE FROM tab_parler WHERE anime = ?`, [animeId]);
    // Supprimer l'anime
    const [result] = await conn.execute(`DELETE FROM tab_liste_anime WHERE id = ?`, [animeId]);

    await conn.commit();
    cache.flushAll(); // Invalide le cache après modification

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Animé non trouvé." });
    }
    res.json({ message: "Animé supprimé avec succès." });
  } catch (err) {
    await conn.rollback();
    console.error("Erreur suppression animé :", err);
    res.status(500).json({ error: "Erreur serveur lors de la suppression de l'animé." });
  } finally {
    conn.release();
  }
});

module.exports = router;