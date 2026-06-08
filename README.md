# OpenCRM 🚀

A full-featured open-source CRM built with React. Includes 15 modules:
**CRM · Sales · Invoicing · Inventory · Email Marketing · Documents · Database · Accounting · Project · Sign · Knowledge Base · eLearning · Social Marketing · WhatsApp Messaging · Dashboard**

---

## ⚡ Deploy everything on Railway (one platform)

A single Railway project hosts all four pieces — the **API container**, the **static SPA**, managed
**Postgres**, and managed **Redis**. Full walkthrough: **[`docs/DEPLOY-RAILWAY.md`](docs/DEPLOY-RAILWAY.md)**.

```bash
npm i -g @railway/cli
railway login
railway init
railway add --database postgres
railway add --database redis
# then create two services from this repo:
#   api → Root Directory "server"  (uses server/railway.json + server/Dockerfile)
#   web → Dockerfile path "Dockerfile.web", build var VITE_API_URL = api's public URL
```

The API runs as a **persistent container** (not serverless) — required for pooled DB connections,
RLS transactions, and the parsing/statement/portal background workers. The same images run
unchanged on Render / Fly.io / AWS.

> **Frontend-only alternative:** the SPA can also deploy to **Netlify** (or Vercel) on its own via
> the included `netlify.toml` (SPA fallback + asset caching); point it at the API with `VITE_API_URL`.
> See [`docs/inspire-crm-architecture.md`](docs/inspire-crm-architecture.md) for the deployment
> topology and rationale.

---

## 🐙 Push to GitHub

```bash
# Inside the opencrm folder:
git init
git add .
git commit -m "Initial commit: OpenCRM"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/opencrm.git
git branch -M main
git push -u origin main
```

---

## 💻 Run Locally

```bash
npm install
npm run dev
# Open http://localhost:5173
```

## 🏗️ Build for Production

```bash
npm run build
# Output in /dist — ready to upload anywhere
```

---

## 🗂️ Project Structure

```
opencrm/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx       # React entry point
│   └── App.jsx        # All 15 CRM modules
├── index.html
├── vite.config.js
├── vercel.json        # Vercel SPA routing config
└── package.json
```

---

## 🏛️ Architecture

See **[`docs/inspire-crm-architecture.md`](docs/inspire-crm-architecture.md)** for the Inspire CRM
technical blueprint — database schema, five-phase roadmap with base/premium tiers, data-flow
diagrams, and the scalability plan (custom Node + Postgres, shared DB with row-level security).

---

## 🔮 Next Steps (Adding a Real Backend)

To persist data across sessions, add:
- **[Supabase](https://supabase.com)** — Free PostgreSQL + Auth (recommended)
- **[PlanetScale](https://planetscale.com)** — MySQL-compatible serverless DB
- **[Railway](https://railway.app)** — Full Node.js + PostgreSQL backend (~$5/mo)

---

## 📄 License
MIT — Free to use, modify, and deploy commercially.
