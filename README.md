# OpenCRM 🚀

A full-featured open-source CRM built with React. Includes 15 modules:
**CRM · Sales · Invoicing · Inventory · Email Marketing · Documents · Database · Accounting · Project · Sign · Knowledge Base · eLearning · Social Marketing · WhatsApp Messaging · Dashboard**

---

## ⚡ Deploy to Vercel in 3 Steps

### Option A — One-Click (Easiest)
1. Push this folder to a GitHub repo (see below)
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repo → click **Deploy**

Vercel auto-detects Vite/React. No config needed. Done! 🎉

---

### Option B — Vercel CLI
```bash
npm install -g vercel
cd opencrm
npm install
vercel
```
Follow the prompts — it deploys in ~60 seconds.

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

## 🔮 Next Steps (Adding a Real Backend)

To persist data across sessions, add:
- **[Supabase](https://supabase.com)** — Free PostgreSQL + Auth (recommended)
- **[PlanetScale](https://planetscale.com)** — MySQL-compatible serverless DB
- **[Railway](https://railway.app)** — Full Node.js + PostgreSQL backend (~$5/mo)

---

## 📄 License
MIT — Free to use, modify, and deploy commercially.
