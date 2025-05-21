const express = require("express");
const router = express.Router();

router.use("/login", require("./login"));
router.use("/animes", require("./animes"));
router.use("/categories", require("./categories"));
router.use("/langues", require("./langues"));

module.exports = router;
