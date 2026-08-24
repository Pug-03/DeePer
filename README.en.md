# DeePer 💬

[ภาษาไทย](./README.md) · **English**

> Deep-conversation question cards for two people sharing **one device** — couples / friends / family.
> Black-and-red glassmorphism design, built mobile-first for iPad / iPhone with swipe gestures.

---

## ✨ Highlights

- 🃏 **Swipeable question cards** — swipe left to skip, right to answer, plus skip / save / answer buttons
- 🗂️ **3 categories × 36 curated questions** (couple / friends / family) + optional AI top-up (Anthropic)
- ✍️ **Turn-based answering** ("your partner's turn") — set a partner name and color
- 🔖 **Saved / History** listed newest-first with dates
- 🔐 **Sign up / log in** with email + 4-digit OTP, or Google OAuth
- 🌐 **Bilingual** Thai / English, switchable in-app
- 📱 **PWA** — add to home screen and run full-screen

---

## 🧱 Tech stack

| Layer | Uses |
|---|---|
| Frontend | React 18 + Vite 5 + Framer Motion 11 + React Router 6 |
| Backend | Node.js + Express 4 |
| Database | SQLite via `node:sqlite` (built into Node — nothing to compile) |
| Auth | JWT + bcryptjs, 4-digit OTP, Google OAuth (`google-auth-library`) |
| Email | Nodemailer (falls back to printing the OTP to the console) |
| Uploads | Multer |
| AI | `@anthropic-ai/sdk` (model `claude-opus-4-8`) |

> The app runs out of the box with zero configuration — Google, real OTP email, and AI are all **optional**.
> (Without them: the OTP is printed to the server console, the Google button is disabled, and only the
> curated question bank is used.)

---

## ✅ Requirements

- **Node.js 22+** (24 recommended) — required for `node:sqlite`
- npm

---

## 🚀 Getting started (Development)

```bash
# 1) Install all dependencies (server + client)
npm run install:all

# 2) Run the server (terminal 1)
npm run dev:server      # http://localhost:4000

# 3) Run the client (terminal 2)
npm run dev:client      # http://localhost:5173  ← open this in the browser
```

The Vite dev server proxies `/api` and `/uploads` to the backend on port 4000 automatically.

### 🍎 Running on macOS (Terminal)

Check you have Node 22+ (install with `brew install node` if not):

```bash
node -v
```

Then open two Terminal windows (or tabs) in the project folder:

```bash
# one-time setup
cd ~/Desktop/Code/Dee_Per
npm run install:all
```

**Window 1 — server**
```bash
cd ~/Desktop/Code/Dee_Per
npm run dev:server
```

**Window 2 — client**
```bash
cd ~/Desktop/Code/Dee_Per
npm run dev:client
```

Open **http://localhost:5173** in your browser.

### 🔑 Testing OTP without SMTP

When you sign up by email, the OTP code is printed to the server console and (in dev mode) also shown
as an on-screen toast.

---

## 📦 Build & Deploy (Production)

```bash
npm run build           # builds client/dist
npm start               # server serves both the API and the web app on one port (4000)
```

When a `client/dist` folder exists, the Express server serves the static files and falls back to
`index.html`. Deploy to any Node host (Render / Railway / Fly.io / VPS, etc.) — set the `PORT` env var
as required by your provider.

---

## ⚙️ Configuration (all optional)

Copy `server/.env.example` to `server/.env` and fill in:

| Variable | Effect |
|---|---|
| `JWT_SECRET` | Secret for signing tokens (set a real value in production) |
| `GOOGLE_CLIENT_ID` | Enables Google sign-in/sign-up (create a **Web** OAuth client in Google Cloud Console) |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / … | Send real OTP emails |
| `ANTHROPIC_API_KEY` | Enables the "generate questions with AI" button (model `claude-opus-4-8`) |
| `PORT` | Server port (defaults to 4000) |

> **Google OAuth:** add your web origins (e.g. `http://localhost:5173` and your production domain) to the
> OAuth client's "Authorized JavaScript origins", then put the Client ID in `GOOGLE_CLIENT_ID`.

---

## 📁 Project structure

```
Dee_Per/
├── server/                    # Express + SQLite
│   ├── src/
│   │   ├── index.js           # entry — serves API + static
│   │   ├── db.js              # schema + question-bank seed (node:sqlite)
│   │   ├── auth.js            # JWT, bcrypt, password rules
│   │   ├── mailer.js          # sends OTP (fallback = console)
│   │   ├── ai.js              # AI question generation (Anthropic)
│   │   ├── questions-bank.js  # question bank, 3 categories × 36
│   │   └── routes/            # auth · questions · data (saved/history)
│   └── .env.example
└── client/                    # React + Vite
    └── src/
        ├── pages/             # Welcome, Signup, Login, ForgotPassword, Home,
        │                      # Answer, Saved, History, Profile, AccountSettings, Support…
        ├── components/        # BottomNav, OtpInput, PasswordStrength, GoogleButton, icons, ui…
        ├── store/             # auth + i18n context
        ├── utils/             # password, avatar helpers
        ├── api.js             # API client
        └── styles.css         # design system (black-red glassmorphism)
```

---

## 🧩 Features by spec

- Landing screen → choose sign up / log in
- Sign up with **Google** (no password) or **email + 4-digit OTP**, then set a password
  - Password must contain: uppercase + lowercase + digit + special character (with a live color-ramping strength meter)
- **Bottom nav, 4 tabs:** Home / Saved / History / Profile
- **Question cards** (glassmorphism) — swipe left to skip, right to answer, plus skip / save / answer buttons
- **Answer screen** with two fields, taken in turns ("your partner's turn"); set a partner name and color
- **Saved / History** listed newest-first with dates
- Users can add their own questions; maintainers edit the bank in `server/src/questions-bank.js`

---

## 📜 npm scripts

| Command | What it does |
|---|---|
| `npm run install:all` | Install server and client dependencies |
| `npm run dev:server` | Run the server in dev mode (auto-reload) on port 4000 |
| `npm run dev:client` | Run the Vite dev server on port 5173 |
| `npm run build` | Build the client into `client/dist` |
| `npm start` | Run production (serves API + static on a single port) |

---

## 📝 License

Private, personal project — no open-source license assigned yet.
