# Anime Coda

Anime Coda is a full-featured web application for managing an anime database, with a secure REST API, a modern user interface, and fine-grained access control.

---

## 🚀 Main Features

- **Full CRUD** for anime (add, edit, delete, view)
- **Dynamic search** and **pagination** on the client side
- **Language** and **category** management for each anime
- **JWT authentication** (login required for edit/delete)
- **Stylish alerts** and user feedback
- **Responsive** and accessible interface
- **Optimized & secure REST API** (Node.js, Express, MySQL)

---

## 🗂️ Project Structure

```
API_anime_Coda/
│
├── API/                # Backend Node.js/Express (REST API)
│   ├── index.js        # API entry point
│   ├── package.json    # Backend dependencies
│   ├── api_anime.sql   # Database structure & sample data
│   └── .env            # Environment variables (create this file)
│
├── Front/              # Frontend (HTML/CSS/JS)
│   ├── index.html      # User interface
│   ├── style.css       # Main styles
│   └── script.js       # JS logic (API requests, UI)
│
└── README.md           # This file
```

---

## ⚙️ Installation & Usage

### 1. Prerequisites

- Node.js 18+
- MySQL

### 2. Database Setup

1. **Import the database structure and sample data**

   In your MySQL client (phpMyAdmin, DBeaver, CLI, etc.), run:

   ```sql
   -- In your MySQL client:
   SOURCE /API/api_anime.sql;
   ```

   Or, from the command line:

   ```bash
   mysql -u your_mysql_user -p < API/api_anime.sql
   ```

   This will create the `api_anime` database and all required tables.

### 3. API Setup

1. **Clone the project**  
   ```bash
   git clone <repo-url>
   cd API_anime_Coda/API
   ```

2. **Install dependencies**  
   ```bash
   npm install
   ```

3. **Create a `.env` file** in the `API/` folder:
   ```
   DB_HOST=localhost
   DB_USER=your_mysql_user
   DB_PASSWORD=your_mysql_password
   DB_NAME=api_anime
   JWT_SECRET=your_secret_key
   ```

4. **Start the API**  
   ```bash
   node index.js
   ```
   The API runs at [http://localhost:3000](http://localhost:3000)

### 4. Start the Frontend

Simply open `Front/index.html` in your browser (no web server required).

---

## 🔒 Security & Best Practices

- **All sensitive operations** (add, edit, delete) require a JWT token.
- **Validation** on both server and client sides.
- **XSS protection**: all displayed values are safely inserted.
- **Prepared SQL statements** to prevent injection.

---

## 📚 Main API Endpoints

- `GET /animes` : Paginated anime list (search supported)
- `GET /animes/:id` : Anime details
- `POST /animes` : Create (authenticated)
- `PUT /animes/:id` : Edit (authenticated)
- `DELETE /animes/:id` : Delete (authenticated)
- `POST /login` : Authentication (returns JWT)
- `GET /categories` : List categories
- `GET /langues` : List languages

---

## ✨ Customization

- **Add your own categories/languages** directly in the database.
- **Change the style** in `Front/style.css` to match your branding.

---

## 🛠️ Main Dependencies

- **Backend**: express, mysql2, jsonwebtoken, dotenv, cors
- **Frontend**: Vanilla JS, Font Awesome (CDN)

---

## 🗄️ Database

The SQL file to create and populate the database is provided at:

```
API/api_anime.sql
```

**How to use:**

1. Open your MySQL client and run the contents of `api_anime.sql`.
2. This will create all necessary tables and insert sample data for categories and anime/category links.

If you want to reset or update the database, simply re-import this file.