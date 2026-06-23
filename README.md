# 🚀 Node-Express-Starter

A robust, production-ready boilerplate for building scalable RESTful APIs with Node.js, Express, and MongoDB.

---

## 🌟 Features

- **Framework**: [Express.js 5.x](https://expressjs.com/) for building efficient APIs.
  - `morgan` for request logging.
  - `cors` for Cross-Origin Resource Sharing.
  - `compression` for Gzip response compression.
  - Custom Error & Response handlers for consistent API formatting.
- **File Handling**: `multer` integrated for handling `multipart/form-data`.
- **Environment Management**: Scoped configuration for `development`, `staging`, and `production`.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- [MongoDB](https://www.mongodb.com/try/download/community) (Running instance)

### Installation

1. **Clone the repository:**

   ```bash
   git clone <your-repo-url>
   cd node-express-starter
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env` and fill in your details:

   ```bash
   cp .env.example .env
   ```

4. **Run the server:**
   - **Development**: `npm run start-dev`
   - **Staging**: `npm run start-staging`
   - **Production**: `npm run start-prod`

---

## 📁 Project Structure

```text
├── config/             # Configuration files (DB, Env)
├── controllers/        # Request handlers
├── middlewares/        # Express middlewares (Auth, Errors, Logger)
├── models/             # Mongoose schemas
├── routes/             # API route definitions
├── services/           # Business logic
├── utils/              # Helper functions & constants
├── index.js            # Entry point
└── package.json        # Dependencies & scripts
```

---

## 🛣️ API Endpoints (v1)

| Method | Endpoint              | Description                   |
| :----- | :-------------------- | :---------------------------- |
| `POST` | `/api/v1/auth/signup` | Register a new user           |
| `POST` | `/api/v1/auth/login`  | Authenticate user & get token |
| `GET`  | `/`                   | Health Check                  |

---

## 📜 Scripts

| Script                  | Description                                           |
| :---------------------- | :---------------------------------------------------- |
| `npm run start-dev`     | Starts the server in development mode with `nodemon`. |
| `npm run start-prod`    | Starts the server in production mode.                 |
| `npm run start-staging` | Starts the server in staging mode.                    |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the [ISC License](LICENSE).
