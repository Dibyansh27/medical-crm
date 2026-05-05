# Hanuman Medical Web

React + Node shop system for a medical store: username/password login, customers, follow-ups, WhatsApp follow-up links, inventory, POS billing, invoice printing, users, backups, and deployment-ready API structure.

## Run Locally

```bash
npm install
npm run dev
```

Frontend: `http://127.0.0.1:5173`  
API: `http://127.0.0.1:5174`

Fresh database default admin:

```text
Username: admin
Password: admin123
```

Change the admin password after first login.

## Real Shop Workflow

1. Login as admin.
2. Add staff users from Users.
3. Add medicines in Inventory with stock, MRP, batch, expiry, and minimum stock.
4. Add customers manually or import them from Excel/CSV with PID as the mobile/WhatsApp number.
5. Use POS to create bills. Stock is reduced automatically.
6. When a customer follow-up is due, open Reminders or Dashboard and click WhatsApp.
7. Download backup from Settings every day.

## Deployment

For one shop computer, run `npm run build` and `npm start`.

For real multi-device deployment, put this behind HTTPS and move `server/data/db.json` to a database such as PostgreSQL/Supabase. Set a strong `JWT_SECRET` in `.env`.
