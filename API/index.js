require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const routes = require("./routes");

app.use(cors());
app.use(express.json());

// API routes
app.use("/", routes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API Anime Coda en écoute sur le port ${port}`));
