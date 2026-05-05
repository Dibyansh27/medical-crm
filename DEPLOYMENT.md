# Deployment Guide

## Local Shop Computer

Use this when the shop has one main billing computer.

1. Open this folder:
   `C:\Users\dibya\Downloads\HM SOFTWARE\hanuman-medical-web`
2. Run:
   `npm install`
3. Build:
   `npm run build`
4. Start:
   `npm start`
5. Open:
   `http://127.0.0.1:5174`

Shortcut option: double-click `START_HANUMAN_MEDICAL.bat`.

Default login:

```text
Username: admin
Password: admin123
```

Change this after first login by adding a new admin user and using a strong password.

## Shop Workflow

1. Admin creates staff users from `Users`.
2. Admin adds medicines in `Inventory`.
3. Staff opens `Sales / POS`, selects customer, adds medicines, completes invoice.
4. Stock reduces automatically.
5. If a customer is selected, the next follow-up is created automatically.
6. When medicine term ends, open `Follow-ups` and click `Send WhatsApp`.
7. At closing, admin downloads backup from `Settings`.

## WhatsApp Follow-Up

The website opens WhatsApp with a pre-filled message to the customer number:

```text
Namaste [Customer], Hanuman Medical se. Aapki medicine ka term khatam ho gaya hai. Kya aapko aur medicine chahiye? Hum ready kar denge.
```

Browsers cannot silently send WhatsApp messages without WhatsApp Business API approval. This app uses the reliable real-world flow: one click opens the exact customer chat with the message ready to send.

## Production Hosting

For a real multi-device shop:

1. Buy a domain or use a hosting URL.
2. Host the Node app on a VPS, Render, Railway, Fly.io, or similar.
3. Set environment variables:

```text
PORT=5174
JWT_SECRET=use-a-long-random-secret
```

4. Run:

```bash
npm install
npm run build
npm start
```

5. Put the server behind HTTPS.
6. Replace `server/data/db.json` with PostgreSQL/Supabase before using multiple counters heavily.

## Vercel Deployment

This project can be imported into Vercel from GitHub.

1. Push this folder to a GitHub repository.
2. In Vercel, click `Add New... -> Project`.
3. Import the GitHub repository.
4. Use these settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

5. Add an environment variable:

```text
JWT_SECRET=use-a-long-random-secret
```

Vercel Functions have a read-only project filesystem and only writable temporary storage. This deployment is good for a demo, but shop data can reset between function instances or deployments. For real billing/inventory use, connect PostgreSQL, Supabase, or another hosted database before depending on Vercel as production hosting.

## Backup

Data is stored at:

```text
server/data/db.json
```

Use `Settings -> Download Backup` daily.
