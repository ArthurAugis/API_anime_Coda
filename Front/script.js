// Sélecteurs principaux
const animelist = document.getElementById("anime-list");
const pageinfo = document.getElementById("page-info");
const nextButton = document.getElementById("next");
const prevButton = document.getElementById("prev");
const searchButton = document.getElementById("search-button");
const searchInput = document.getElementById("search-input");

let nbpage = 0;
let elementbypage = 10;
let page = 1;
let jwtToken = null;
let deleteId = null;

// --------- Système d'alertes stylisées ---------
function showAlert(message, type = "info") {
  let alertBox = document.getElementById("custom-alert");
  if (!alertBox) {
    alertBox = document.createElement("div");
    alertBox.id = "custom-alert";
    document.body.appendChild(alertBox);
  }
  alertBox.className = `custom-alert ${type}`;
  alertBox.innerText = message;
  alertBox.style.display = "block";
  setTimeout(() => {
    alertBox.style.opacity = "1";
  }, 10);
  setTimeout(() => {
    alertBox.style.opacity = "0";
    setTimeout(() => {
      alertBox.style.display = "none";
    }, 400);
  }, 2500);
}

function showError(message) {
  showAlert(message, "error");
}
function showSuccess(message) {
  showAlert(message, "success");
}

// --------- Authentification ---------
function isAuthenticated() {
  return !!jwtToken;
}

// --------- Pagination ---------
function updateButtons() {
  prevButton.disabled = page <= 1;
  nextButton.disabled = page >= nbpage;
}

// --------- Affichage des animés ---------
function showAnimes(data) {
  animelist.innerHTML = "";

  data.data.forEach((anime) => {
    const animeItem = document.createElement("tr");
    animeItem.classList.add("anime-item");

    Object.entries(anime).forEach(([key, value]) => {
      const cell = document.createElement("td");

      if (key === "affiche_anime") {
        const img = document.createElement("img");
        img.src = value;
        img.alt = anime.nom_anime;
        img.loading = "lazy";
        cell.appendChild(img);
      } else {
        cell.textContent = value;
      }

      animeItem.appendChild(cell);
    });

    // Actions (édition/suppression)
    const actionCell = document.createElement("td");
    actionCell.classList.add("actions-cell");

    const wrapper = document.createElement("div");
    wrapper.classList.add("actions-wrapper");

    const editBtn = document.createElement("button");
    editBtn.classList.add("icon-btn", "edit-btn");
    editBtn.innerHTML = `<i class="fas fa-pen" title="Modifier"></i>`;
    editBtn.type = "button";
    editBtn.setAttribute("data-edit-id", anime.id);

    const deleteBtn = document.createElement("button");
    deleteBtn.classList.add("icon-btn", "delete-btn");
    deleteBtn.innerHTML = `<i class="fas fa-trash" title="Supprimer"></i>`;
    deleteBtn.type = "button";
    deleteBtn.setAttribute("data-delete-id", anime.id);

    wrapper.appendChild(editBtn);
    wrapper.appendChild(deleteBtn);
    actionCell.appendChild(wrapper);
    animeItem.appendChild(actionCell);

    animelist.appendChild(animeItem);
  });

  elementbypage = data.limit;
  nbpage = data.total / elementbypage;
  pageinfo.textContent = `Page ${page} of ${Math.ceil(nbpage)}`;
  updateButtons();
}

// --------- Navigation (pagination) ---------
function changePage(pageNum) {
  const searchValue = searchInput.value.trim();
  let url = `http://localhost:3000/animes?page=${pageNum}&limit=${elementbypage}`;
  if (searchValue) {
    url += `&search=${encodeURIComponent(searchValue)}`;
  }
  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      page = pageNum;
      window.scrollTo(0, 0);
      showAnimes(data);
    })
    .catch((error) => showError("Erreur lors du chargement des animés."));
}


function fetchAnime() {
  fetch("http://localhost:3000/animes")
    .then((response) => response.json())
    .then((data) => {
      showAnimes(data);
    })
    .catch((error) => showError("Erreur lors du chargement des animés."));
}

// --------- Pagination boutons ---------
nextButton.addEventListener("click", () => {
  if (page < nbpage) changePage(page + 1);
});
prevButton.addEventListener("click", () => {
  if (page > 1) changePage(page - 1);
});

// --------- Recherche ---------
searchButton.addEventListener("click", () => {
  const searchValue = searchInput.value.trim();
  page = 1;
  let url = `http://localhost:3000/animes?page=${page}&limit=${elementbypage}`;
  if (searchValue) {
    url += `&search=${encodeURIComponent(searchValue)}`;
  }
  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      showAnimes(data);
    })
    .catch(() => showError("Erreur lors de la recherche."));
});

// --------- Gestion des modales ---------
function openModal(id) {
  // login-modal peut toujours s'ouvrir
  if (id === "login-modal") {
    document.getElementById(id).classList.remove("hidden");
    return;
  }
  // Pour les autres modales, il faut être connecté
  if (!isAuthenticated()) {
    showError("Vous devez être connecté pour effectuer cette action.");
    return;
  }
  document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

// Fermeture modale via bouton
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});

// Ouverture modale login/ajout
document.getElementById("login-button").addEventListener("click", () => {
  openModal("login-modal");
});
document.getElementById("add-button").addEventListener("click", () => {
  openModal("create-modal");
});

// --------- Authentification (login) ---------
document.getElementById("login-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const email = this.email.value.trim();
  const password = this.password.value;
  if (!email || !password) {
    showError("Veuillez remplir tous les champs.");
    return;
  }
  fetch("http://localhost:3000/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: email, password }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.token) {
        jwtToken = data.token;
        closeModal("login-modal");
        document.getElementById("login-button").style.display = "none";
        showSuccess("Connexion réussie !");
      } else {
        showError(data.error || "Erreur de connexion");
      }
    })
    .catch(() => showError("Erreur de connexion"));
});

// --------- Ajout d'un animé ---------
document.getElementById("create-form").addEventListener("submit", function (e) {
  e.preventDefault();

  if (!isAuthenticated()) {
    showError("Vous devez être connecté pour ajouter un animé.");
    return;
  }

  const form = this;
  // Validation basique côté client
  if (!form.nom.value.trim() || !form.nom_url.value.trim() || !form.affiche_anime.value.trim()) {
    showError("Tous les champs obligatoires doivent être remplis.");
    return;
  }

  const langues = Array.from(document.getElementById("create-langues-select").selectedOptions).map(opt => opt.value);
  const categories = Array.from(document.getElementById("create-categories-select").selectedOptions).map(opt => opt.value);

  const data = {
    nom: form.nom.value.trim(),
    nom_url: form.nom_url.value.trim(),
    affiche_url: form.affiche_anime.value.trim(),
    description: form.description.value.trim(),
    langues,
    categories
  };

  fetch("http://localhost:3000/animes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
    },
    body: JSON.stringify(data),
  })
    .then(res => res.json())
    .then(result => {
      if (result.error) {
        showError(result.error);
      } else {
        form.reset();
        Array.from(form.querySelectorAll("select")).forEach(select => select.selectedIndex = -1);
        closeModal("create-modal");
        showSuccess("Animé bien créé");
        refreshAnimeList();
      }
    })
    .catch(() => showError("Erreur lors de la création de l'animé."));
});

// --------- Edition d'un animé ---------
function handleEdit(animeId) {
  if (!isAuthenticated()) {
    showError("Vous devez être connecté pour modifier un animé.");
    return;
  }
  fetch(`http://localhost:3000/animes/${animeId}`)
    .then((res) => res.json())
    .then((anime) => {
      const form = document.getElementById("edit-form");
      form.id.value = anime.id;
      form.nom.value = anime.nom_anime;
      form.nom_url.value = anime.nom_url_anime;
      form.affiche_anime.value = anime.affiche_anime;
      form.description.value = anime.description_anime;

      // Sélectionner les langues et catégories dans les selects multiples
      const languesSelect = document.getElementById("edit-langues-select");
      const categoriesSelect = document.getElementById("edit-categories-select");

      // Reset sélection
      Array.from(languesSelect.options).forEach(opt => { opt.selected = false; });
      Array.from(categoriesSelect.options).forEach(opt => { opt.selected = false; });

      // Sélectionne les bonnes options (par nom, car API renvoie les noms)
      if (anime.langue_anime) {
        const langues = anime.langue_anime.split(",").map(l => l.trim());
        Array.from(languesSelect.options).forEach(opt => {
          if (langues.includes(opt.textContent.trim())) opt.selected = true;
        });
      }
      if (anime.categorie_anime) {
        const categories = anime.categorie_anime.split(",").map(c => c.trim());
        Array.from(categoriesSelect.options).forEach(opt => {
          if (categories.includes(opt.textContent.trim())) opt.selected = true;
        });
      }

      openModal("edit-modal");
    })
    .catch(() => showError("Erreur lors du chargement de l'animé."));
}

// --------- Soumission du formulaire d'édition ---------
document.getElementById("edit-form").addEventListener("submit", function (e) {
  e.preventDefault();

  if (!isAuthenticated()) {
    showError("Vous devez être connecté pour modifier un animé.");
    return;
  }

  const form = this;
  if (!form.nom.value.trim() || !form.nom_url.value.trim() || !form.affiche_anime.value.trim()) {
    showError("Tous les champs obligatoires doivent être remplis.");
    return;
  }

  const langues = Array.from(document.getElementById("edit-langues-select").selectedOptions).map(opt => opt.value);
  const categories = Array.from(document.getElementById("edit-categories-select").selectedOptions).map(opt => opt.value);

  const data = {
    nom: form.nom.value.trim(),
    nom_url: form.nom_url.value.trim(),
    affiche_url: form.affiche_anime.value.trim(),
    description: form.description.value.trim(),
    langues,
    categories
  };

  fetch(`http://localhost:3000/animes/${form.id.value}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
    },
    body: JSON.stringify(data),
  })
    .then(res => res.json())
    .then(result => {
      if (result.error) {
        showError(result.error);
      } else {
        form.reset();
        Array.from(form.querySelectorAll("select")).forEach(select => select.selectedIndex = -1);
        closeModal("edit-modal");
        showSuccess("Animé bien modifié");
        refreshAnimeList();
      }
    })
    .catch(() => showError("Erreur lors de la modification de l'animé."));
});

// --------- Rafraîchissement de la liste (garde la recherche) ---------
function refreshAnimeList() {
  const searchValue = searchInput.value.trim();
  if (searchValue) {
    fetch(`http://localhost:3000/animes?search=${encodeURIComponent(searchValue)}`)
      .then((response) => response.json())
      .then((data) => {
        showAnimes(data);
      })
      .catch(() => showError("Erreur lors du rafraîchissement de la liste."));
  } else {
    fetchAnime();
  }
}

// --------- Suppression d'un animé ---------
function handleDelete(animeId) {
  if (!isAuthenticated()) {
    showError("Vous devez être connecté pour supprimer un animé.");
    return;
  }
  deleteId = animeId;
  openModal("delete-modal");
}

document.getElementById("confirm-delete").addEventListener("click", () => {
  if (!isAuthenticated()) {
    showError("Vous devez être connecté pour supprimer un animé.");
    return;
  }
  fetch(`http://localhost:3000/animes/${deleteId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
  })
    .then(res => res.json())
    .then(result => {
      if (result.error) {
        showError(result.error);
      } else {
        closeModal("delete-modal");
        showSuccess("Animé bien supprimé");
        refreshAnimeList();
      }
    })
    .catch(() => showError("Erreur lors de la suppression de l'animé."));
});

// --------- Chargement dynamique des langues et catégories ---------
function populateSelect(url, selectId) {
  fetch(`http://localhost:3000/${url}`)
    .then((res) => res.json())
    .then((items) => {
      const createSelect = document.getElementById(`create-${selectId}-select`);
      const editSelect = document.getElementById(`edit-${selectId}-select`);
      if (!createSelect || !editSelect) return;

      createSelect.innerHTML = "";
      editSelect.innerHTML = "";

      items.forEach((item) => {
        // Sécurité XSS : textContent
        const option1 = document.createElement("option");
        option1.value = item.id;
        option1.textContent = item.nom;
        createSelect.appendChild(option1);

        const option2 = document.createElement("option");
        option2.value = item.id;
        option2.textContent = item.nom;
        editSelect.appendChild(option2);
      });
    })
    .catch(() => showError(`Erreur lors du chargement des ${selectId}`));
}

// --------- Delegation des events pour edit/delete ---------
animelist.addEventListener("click", (e) => {
  const editBtn = e.target.closest("[data-edit-id]");
  const deleteBtn = e.target.closest("[data-delete-id]");
  if (editBtn) {
    handleEdit(editBtn.getAttribute("data-edit-id"));
  } else if (deleteBtn) {
    handleDelete(deleteBtn.getAttribute("data-delete-id"));
  }
});

// Initialisation des selects
populateSelect("langues", "langues");
populateSelect("categories", "categories");

// Lancer le premier chargement
fetchAnime();