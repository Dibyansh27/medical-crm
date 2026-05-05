import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Bell,
  Boxes,
  Check,
  Download,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PackagePlus,
  PhoneCall,
  Plus,
  Printer,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Upload,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { api, downloadJson, fmtDate, money, setToken, telUrl, today, whatsappUrl } from './api.js';
import './styles.css';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'pos', label: 'Sales / POS', icon: ShoppingCart },
  { key: 'inventory', label: 'Inventory', icon: Boxes },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'reminders', label: 'Follow-ups', icon: Bell },
  { key: 'calls', label: 'Call Log', icon: PhoneCall },
  { key: 'users', label: 'Users', icon: UserRound, adminOnly: true },
  { key: 'settings', label: 'Settings', icon: Settings }
];

function useLoad(user) {
  const [state, setState] = useState({
    loading: true,
    summary: null,
    customers: [],
    products: [],
    sales: [],
    reminders: [],
    calls: [],
    users: [],
    settings: null
  });
  const [error, setError] = useState('');

  const load = async () => {
    if (!user) return;
    setError('');
    const [summary, customers, products, sales, reminderPayload, calls, settings, users] = await Promise.all([
      api('/summary'),
      api('/customers'),
      api('/products'),
      api('/sales'),
      api('/reminders'),
      api('/calls'),
      api('/settings'),
      user.role === 'admin' ? api('/users') : Promise.resolve([])
    ]);
    setState({
      loading: false,
      summary,
      customers,
      products,
      sales,
      reminders: reminderPayload.reminders || [],
      followupsDue: reminderPayload.followupsDue || [],
      calls,
      users,
      settings
    });
  };

  useEffect(() => {
    load().catch((err) => {
      setError(err.message);
      setState((prev) => ({ ...prev, loading: false }));
    });
  }, [user?.id]);

  return { ...state, error, reload: load };
}

function Toast({ toast, clear }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(clear, 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  return toast ? <div className={`toast ${toast.type || 'ok'}`}>{toast.message}</div> : null;
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ role: 'admin', username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdmin = form.role === 'admin';

  const chooseRole = (role) => {
    setForm((current) => ({ ...current, role }));
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/auth/login', { method: 'POST', body: form });
      setToken(data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-mark">HM</div>
        <h1>Hanuman Medical</h1>
        <p>Select access type, then enter the user ID and password for that account.</p>
        <form onSubmit={submit} className="login-form">
          <div className="login-choice" role="tablist" aria-label="Login type">
            <button
              type="button"
              className={isAdmin ? 'active' : ''}
              onClick={() => chooseRole('admin')}
              aria-pressed={isAdmin}
            >
              <ShieldCheck size={16} /> Admin Login
            </button>
            <button
              type="button"
              className={!isAdmin ? 'active' : ''}
              onClick={() => chooseRole('staff')}
              aria-pressed={!isAdmin}
            >
              <UserRound size={16} /> Staff Login
            </button>
          </div>
          <label>
            {isAdmin ? 'Admin User ID' : 'Staff User ID'}
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder={isAdmin ? 'Admin user ID' : 'Staff user ID'}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Password"
              autoComplete="current-password"
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-btn" disabled={busy}>
            {busy ? 'Signing in...' : `Login as ${isAdmin ? 'Admin' : 'Staff'}`}
          </button>
        </form>
        <span className="login-hint">Fresh database default: admin / admin123. Existing admin user IDs may be different. Staff users are created from the Users page.</span>
      </section>
    </main>
  );
}

function Shell({ user, data, page, setPage, onLogout, children }) {
  const visibleNav = navItems.filter((item) => !item.adminOnly || user.role === 'admin');
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo-line">
          <div className="logo">HM</div>
          <div>
            <strong>Hanuman Medical</strong>
            <span>Shop Operating System</span>
          </div>
        </div>
        <nav>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} className={page === item.key ? 'active' : ''} onClick={() => setPage(item.key)}>
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="mini-stat">
            <span>Today Sales</span>
            <strong>{money(data.summary?.salesToday)}</strong>
          </div>
          <div className="mini-grid">
            <span>{data.customers.length} customers</span>
            <span>{data.products.length} medicines</span>
          </div>
          <button className="ghost-btn logout" onClick={onLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{user.role === 'admin' ? 'Admin Access' : 'Staff Access'}</span>
            <h2>{data.settings?.shopName || 'Hanuman Medical'}</h2>
          </div>
          <div className="user-pill">
            <UserRound size={16} />
            {user.name}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function Dashboard({ data, setPage, user }) {
  const due = data.followupsDue || [];
  const canManage = user?.role === 'admin';
  return (
    <section className="page-flow">
      <div className="metric-grid">
        <Metric title="Sales Today" value={money(data.summary?.salesToday)} tone="green" />
        <Metric title="Customers" value={data.customers.length} tone="blue" />
        <Metric title="Low Stock" value={data.summary?.lowStock?.length || 0} tone="red" />
        <Metric title="Due Follow-ups" value={due.length} tone="amber" />
      </div>
      <div className="split-grid">
        <Card title="Medicine Term Ended" action={<button onClick={() => setPage('reminders')}>Open all</button>}>
          {due.length ? (
            due.slice(0, 5).map(({ customer, message, dueDate }) => (
              <div className="action-row" key={customer.id}>
                <div>
                  <strong>{customer.name}</strong>
                  <span>{customer.mobile} · due {fmtDate(dueDate)}</span>
                </div>
                <div className="row-actions">
                  <a className="whatsapp-btn" target="_blank" href={whatsappUrl(customer.mobile, message)} rel="noreferrer">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                  <a className="call-btn" href={telUrl(customer.mobile)}><PhoneCall size={16} /> Call</a>
                </div>
              </div>
            ))
          ) : (
            <Empty text="No expired medicine terms today." />
          )}
        </Card>
        <Card title="Stock Alerts" action={<button onClick={() => setPage('inventory')}>Inventory</button>}>
          {[...(data.summary?.lowStock || []), ...(data.summary?.expiring || [])].slice(0, 6).map((product) => (
            <div className="action-row" key={`${product.id}-${product.expiry}`}>
              <div>
                <strong>{product.name}</strong>
                <span>Stock {product.stock} · batch {product.batch || '-'} · exp {fmtDate(product.expiry)}</span>
              </div>
              <span className="badge danger">Check</span>
            </div>
          ))}
          {!((data.summary?.lowStock || []).length || (data.summary?.expiring || []).length) && <Empty text="No stock alerts." />}
        </Card>
      </div>
      <Card title="Recent Sales" action={canManage ? <button onClick={() => setPage('pos')}>New bill</button> : <button onClick={() => setPage('pos')}>Open</button>}>
        <Table
          columns={['Invoice', 'Customer', 'Date', 'Items', 'Total']}
          rows={(data.sales || []).slice(0, 8).map((sale) => [
            sale.invoiceNo,
            sale.customerName,
            `${fmtDate(sale.date)} ${sale.voided ? '(void)' : ''}`,
            sale.items.length,
            money(sale.total)
          ])}
          empty="No sales yet."
        />
      </Card>
    </section>
  );
}

function Metric({ title, value, tone }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Card({ title, action, children }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

function Table({ columns, rows, empty }) {
  if (!rows.length) return <Empty text={empty || 'No records.'} />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function POS({ data, reload, toast, user }) {
  const [cart, setCart] = useState([]);
  const [draft, setDraft] = useState({ customerId: '', productId: '', qty: 1, discount: 0, paymentMode: 'cash', followDays: 28 });
  const canManage = user.role === 'admin';
  const products = data.products.filter((product) => Number(product.stock) > 0);
  const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discount = Math.min(Number(draft.discount || 0), subtotal);
  const total = subtotal - discount;

  const add = () => {
    const product = products.find((item) => item.id === draft.productId);
    if (!product) return toast('Select medicine first', 'warn');
    const qty = Math.max(1, Number(draft.qty || 1));
    const exists = cart.find((item) => item.productId === product.id);
    const nextQty = qty + (exists?.qty || 0);
    if (nextQty > product.stock) return toast(`Only ${product.stock} available`, 'warn');
    if (exists) {
      setCart(cart.map((item) => (item.productId === product.id ? { ...item, qty: nextQty } : item)));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, batch: product.batch, expiry: product.expiry, qty, price: product.mrp }]);
    }
    setDraft({ ...draft, productId: '', qty: 1 });
  };

  const complete = async () => {
    if (!cart.length) return toast('Cart is empty', 'warn');
    const sale = await api('/sales', {
      method: 'POST',
      body: {
        customerId: draft.customerId,
        items: cart,
        discount,
        paymentMode: draft.paymentMode,
        followDays: draft.followDays
      }
    });
    setCart([]);
    setDraft({ ...draft, discount: 0 });
    toast(`Invoice ${sale.invoiceNo} created`);
    printInvoice(sale, data.settings);
    await reload();
  };

  const voidSale = async (sale) => {
    if (!confirm(`Void ${sale.invoiceNo} and restore stock?`)) return;
    await api(`/sales/${sale.id}/void`, { method: 'POST' });
    toast('Invoice voided and stock restored', 'warn');
    await reload();
  };

  const invoiceHistory = (
    <Card title="Invoice History">
      <div className="sale-list">
        {data.sales.slice(0, 20).map((sale) => (
          <div className={`sale-card ${sale.voided ? 'muted-sale' : ''}`} key={sale.id}>
            <div>
              <strong>{sale.invoiceNo}</strong>
              <span>{sale.customerName} · {fmtDate(sale.date)} · {sale.items.length} items</span>
            </div>
            <div className="row-actions">
              <b>{money(sale.total)}</b>
              <button onClick={() => printInvoice(sale, data.settings)}><Printer size={15} /></button>
              {canManage && !sale.voided && <button className="danger-btn" onClick={() => voidSale(sale)}><Trash2 size={15} /></button>}
            </div>
          </div>
        ))}
        {!data.sales.length && <Empty text="No invoices yet." />}
      </div>
    </Card>
  );

  if (!canManage) {
    return <section className="page-flow">{invoiceHistory}</section>;
  }

  return (
    <section className="pos-layout">
      <div className="page-flow">
        <Card title="New Invoice">
          <div className="form-grid">
            <label>
              Customer
              <select value={draft.customerId} onChange={(e) => setDraft({ ...draft, customerId: e.target.value })}>
                <option value="">Walk-in Sale</option>
                {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.mobile}</option>)}
              </select>
            </label>
            <label>
              Follow-up Days
              <input type="number" min="0" value={draft.followDays} onChange={(e) => setDraft({ ...draft, followDays: e.target.value })} />
            </label>
            <label className="wide">
              Medicine
              <select value={draft.productId} onChange={(e) => setDraft({ ...draft, productId: e.target.value })}>
                <option value="">Select medicine</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.mrp)} · stock {product.stock}</option>)}
              </select>
            </label>
            <label>
              Qty
              <input type="number" min="1" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} />
            </label>
            <button className="primary-btn form-end" onClick={add}><Plus size={16} /> Add</button>
          </div>
        </Card>
        {invoiceHistory}
      </div>
      <aside className="cart-panel">
        <div className="card-head">
          <h3>Cart</h3>
          <button onClick={() => setCart([])}><X size={16} /> Clear</button>
        </div>
        <div className="cart-lines">
          {cart.map((item) => (
            <div className="cart-line" key={item.productId}>
              <div>
                <strong>{item.name}</strong>
                <span>Batch {item.batch || '-'}</span>
              </div>
              <input
                type="number"
                min="1"
                value={item.qty}
                onChange={(e) => setCart(cart.map((row) => (row.productId === item.productId ? { ...row, qty: Number(e.target.value || 1) } : row)))}
              />
              <input
                type="number"
                min="0"
                value={item.price}
                onChange={(e) => setCart(cart.map((row) => (row.productId === item.productId ? { ...row, price: Number(e.target.value || 0) } : row)))}
              />
              <button className="danger-btn" onClick={() => setCart(cart.filter((row) => row.productId !== item.productId))}><X size={14} /></button>
            </div>
          ))}
          {!cart.length && <Empty text="Add medicines to start billing." />}
        </div>
        <label>
          Payment
          <select value={draft.paymentMode} onChange={(e) => setDraft({ ...draft, paymentMode: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="credit">Credit</option>
          </select>
        </label>
        <label>
          Discount
          <input type="number" min="0" value={draft.discount} onChange={(e) => setDraft({ ...draft, discount: e.target.value })} />
        </label>
        <div className="totals">
          <span>Subtotal <b>{money(subtotal)}</b></span>
          <span>Discount <b>{money(discount)}</b></span>
          <strong>Total <b>{money(total)}</b></strong>
        </div>
        <button className="primary-btn full-btn" onClick={complete}><Check size={17} /> Complete & Print</button>
      </aside>
    </section>
  );
}

function printInvoice(sale, settings) {
  const rows = sale.items
    .map((item, index) => `<tr><td>${index + 1}</td><td>${item.name}<br><small>Batch: ${item.batch || '-'} ${item.expiry ? ` · Exp: ${fmtDate(item.expiry)}` : ''}</small></td><td>${item.qty}</td><td>${money(item.price)}</td><td>${money(item.lineTotal)}</td></tr>`)
    .join('');
  const html = `<!doctype html><html><head><title>${sale.invoiceNo}</title><style>
    body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{margin:0;font-size:22px}.muted{color:#555;font-size:12px}.top{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#f3f4f6}.total{width:280px;margin-left:auto;margin-top:14px}.total div{display:flex;justify-content:space-between;padding:5px 0}.grand{font-size:18px;font-weight:700;border-top:2px solid #111;padding-top:8px}@media print{button{display:none}}
  </style></head><body><button onclick="window.print()">Print</button><div class="top"><div><h1>${settings?.shopName || 'Hanuman Medical'}</h1><p class="muted">${settings?.shopAddress || ''}</p><p class="muted">Phone: ${settings?.shopPhone || ''}</p></div><div><p><b>Invoice:</b> ${sale.invoiceNo}</p><p><b>Date:</b> ${fmtDate(sale.date)} ${sale.time || ''}</p><p><b>Payment:</b> ${sale.paymentMode}</p></div></div><p><b>Customer:</b> ${sale.customerName}</p><p class="muted">Sold by: ${sale.soldBy}</p><table><thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total"><div><span>Subtotal</span><b>${money(sale.subtotal)}</b></div><div><span>Discount</span><b>${money(sale.discount)}</b></div><div class="grand"><span>Total</span><b>${money(sale.total)}</b></div></div><p class="muted" style="margin-top:32px">Please verify medicine, batch, expiry, and dosage before use.</p></body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}

function Inventory({ data, reload, toast, user }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const products = data.products.filter((product) => [product.name, product.batch, product.supplier, product.category].join(' ').toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="page-flow">
      <div className="toolbar">
        <div className="searchbox"><Search size={17} /><input placeholder="Search medicine, batch, supplier..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        {user.role === 'admin' && <button className="primary-btn" onClick={() => setEditing({})}><PackagePlus size={16} /> Add Medicine</button>}
      </div>
      <div className="product-grid">
        {products.map((product) => (
          <div className="product-card" key={product.id}>
            <div className="product-top">
              <strong>{product.name}</strong>
              <span className={Number(product.stock) <= Number(product.minStock) ? 'badge danger' : 'badge ok'}>Stock {product.stock}</span>
            </div>
            <span className="muted-text">Batch {product.batch || '-'} · Exp {fmtDate(product.expiry)} · {product.supplier || 'No supplier'}</span>
            <div className="pill-row">
              <span>{money(product.mrp)} MRP</span>
              <span>{money(product.cost)} cost</span>
              <span>Min {product.minStock}</span>
            </div>
            {user.role === 'admin' && <button onClick={() => setEditing(product)}>Edit stock</button>}
          </div>
        ))}
      </div>
      {!products.length && <Card title="Inventory"><Empty text="No medicines found." /></Card>}
      {editing && <ProductModal product={editing} close={() => setEditing(null)} reload={reload} toast={toast} />}
    </section>
  );
}

function ProductModal({ product, close, reload, toast }) {
  const [form, setForm] = useState({
    name: product.name || '',
    batch: product.batch || '',
    category: product.category || '',
    supplier: product.supplier || '',
    stock: product.stock || 0,
    minStock: product.minStock || 10,
    mrp: product.mrp || 0,
    cost: product.cost || 0,
    expiry: product.expiry || '',
    location: product.location || '',
    notes: product.notes || ''
  });
  const save = async () => {
    await api(product.id ? `/products/${product.id}` : '/products', { method: product.id ? 'PATCH' : 'POST', body: form });
    toast(product.id ? 'Medicine updated' : 'Medicine added');
    await reload();
    close();
  };
  return (
    <Modal title={product.id ? 'Edit Medicine' : 'Add Medicine'} close={close}>
      <div className="form-grid">
        {[
          ['name', 'Medicine Name'],
          ['batch', 'Batch'],
          ['category', 'Category'],
          ['supplier', 'Supplier'],
          ['stock', 'Stock Qty', 'number'],
          ['minStock', 'Minimum Stock', 'number'],
          ['mrp', 'MRP / Sale Price', 'number'],
          ['cost', 'Purchase Price', 'number'],
          ['expiry', 'Expiry Date', 'date'],
          ['location', 'Rack / Shelf']
        ].map(([key, label, type]) => (
          <label key={key}>
            {label}
            <input type={type || 'text'} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </label>
        ))}
        <label className="wide">
          Notes
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
      </div>
      <div className="modal-actions">
        <button onClick={close}>Cancel</button>
        <button className="primary-btn" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

async function readCustomerRowsFromExcel(file) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('No sheet found in this file');
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, blankrows: false });
  return rows.filter((row) => Object.values(row).some((value) => String(value || '').trim()));
}

function datePart(value) {
  return value ? String(value).slice(0, 10) : '';
}

function addDaysString(dateString, days) {
  if (!dateString || !Number(days)) return '';
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + Number(days));
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function daysBetween(fromDate, toDate) {
  if (!fromDate || !toDate) return null;
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to - from) / 86400000);
}

function customerFollowupStatus(customer) {
  const billDate = customer.lastSaleDate || customer.date || '';
  const followDays = Number(customer.followDays || 0);
  const calculatedFollowUp = billDate && followDays ? addDaysString(billDate, followDays) : '';
  const dueDate = customer.nextFollowUp || calculatedFollowUp;
  const diff = dueDate ? daysBetween(today(), dueDate) : null;

  if (diff === null) return { billDate, dueDate, followDays, label: 'No follow-up', tone: 'neutral' };
  if (diff < 0) return { billDate, dueDate, followDays, label: `${Math.abs(diff)}d overdue`, tone: 'danger' };
  if (diff === 0) return { billDate, dueDate, followDays, label: 'Due today', tone: 'warning' };
  return { billDate, dueDate, followDays, label: `${diff}d left`, tone: 'ok' };
}

function Customers({ data, reload, toast, user }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importInputRef = useRef(null);
  const canManage = user.role === 'admin';
  const customers = data.customers.filter((customer) => [customer.name, customer.mobile, customer.tags].join(' ').toLowerCase().includes(query.toLowerCase()));

  const importCustomers = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const rows = await readCustomerRowsFromExcel(file);
      if (!rows.length) throw new Error('No customer rows found in this file');
      const result = await api('/customers/import', { method: 'POST', body: { rows } });
      setImportResult(result);
      toast(`Import complete: ${result.imported} new, ${result.updated} updated, ${result.skipped} skipped`);
      await reload();
    } catch (error) {
      toast(error.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const deleteCustomer = async (customer) => {
    if (user.role !== 'admin') return toast('Only admin can delete customers', 'warn');
    if (!window.confirm(`Delete customer ${customer.name}? This also removes their reminders and call history.`)) return;
    await api(`/customers/${customer.id}`, { method: 'DELETE' });
    toast('Customer deleted', 'warn');
    await reload();
  };

  return (
    <section className="page-flow">
      <div className="toolbar">
        <div className="searchbox"><Search size={17} /><input placeholder="Search customers..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        {canManage && (
          <div className="toolbar-actions">
            <input ref={importInputRef} className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={importCustomers} />
            <button onClick={() => importInputRef.current?.click()} disabled={importing}><Upload size={16} /> {importing ? 'Importing...' : 'Import Excel'}</button>
            <button className="primary-btn" onClick={() => setEditing({})}><Plus size={16} /> Add Customer</button>
          </div>
        )}
      </div>
      {importResult && (
        <div className="import-summary">
          <div className="import-counts">
            <span><b>{importResult.imported}</b> new</span>
            <span><b>{importResult.updated}</b> updated</span>
            <span><b>{importResult.skipped}</b> skipped</span>
          </div>
          {importResult.skippedRows?.length > 0 && (
            <div className="skip-list">
              {importResult.skippedRows.slice(0, 5).map((row) => (
                <span key={`${row.rowNumber}-${row.reason}`}>Row {row.rowNumber}: {row.reason}</span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="customer-grid">
        {customers.map((customer) => {
          const msg = `Namaste ${customer.name}, Hanuman Medical se. Aapki medicine ka term khatam ho gaya hai. Kya aapko aur medicine chahiye? Hum ready kar denge.`;
          const status = customerFollowupStatus(customer);
          return (
            <div className="customer-card" key={customer.id}>
              <div className="avatar">{customer.name?.[0] || 'C'}</div>
              <div className="customer-body">
                <div className="customer-title-row">
                  <div>
                    <strong>{customer.name}</strong>
                    <span>{customer.mobile}</span>
                  </div>
                  {canManage && (
                    <div className="icon-actions">
                      <button title="Edit customer" onClick={() => setEditing(customer)}>Edit</button>
                      <button className="danger-btn" title="Delete customer" onClick={() => deleteCustomer(customer)}><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>
                <div className="pill-row">
                  <span>Bill {fmtDate(status.billDate)}</span>
                  <span>{money(customer.billAmount)}</span>
                  <span>{status.followDays ? `${status.followDays}d cycle` : 'No cycle'}</span>
                  <span className={`follow-pill ${status.tone}`}>{status.label}</span>
                </div>
                <div className="customer-note">Follow-up {fmtDate(status.dueDate)} · Updated {fmtDate(datePart(customer.updatedAt))}</div>
                <div className="row-actions left">
                  <a className="whatsapp-btn" target="_blank" href={whatsappUrl(customer.mobile, msg)} rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>
                  <a className="call-btn" href={telUrl(customer.mobile)}><PhoneCall size={15} /> Call</a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {!customers.length && <Card title="Customers"><Empty text="No customers found." /></Card>}
      {canManage && editing && <CustomerModal customer={editing} close={() => setEditing(null)} reload={reload} toast={toast} />}
    </section>
  );
}

function CustomerModal({ customer, close, reload, toast }) {
  const [form, setForm] = useState({
    name: customer.name || '',
    mobile: customer.mobile || '',
    address: customer.address || '',
    tags: customer.tags || '',
    prescription: customer.prescription || '',
    notes: customer.notes || '',
    followDays: customer.followDays || 28,
    lastSaleDate: customer.lastSaleDate || today(),
    billAmount: customer.billAmount || 0,
    nextFollowUp: customer.nextFollowUp || '',
    loyaltyPoints: customer.loyaltyPoints || 0
  });
  const save = async () => {
    await api(customer.id ? `/customers/${customer.id}` : '/customers', { method: customer.id ? 'PATCH' : 'POST', body: form });
    toast(customer.id ? 'Customer updated' : 'Customer added');
    await reload();
    close();
  };
  return (
    <Modal title={customer.id ? 'Edit Customer' : 'Add Customer'} close={close}>
      <div className="form-grid">
        {[
          ['name', 'Customer Name'],
          ['mobile', 'WhatsApp / Mobile'],
          ['lastSaleDate', 'Last Bill Date', 'date'],
          ['billAmount', 'Bill Amount', 'number'],
          ['followDays', 'Follow-up Days', 'number'],
          ['nextFollowUp', 'Next Follow-up', 'date'],
          ['loyaltyPoints', 'Loyalty Points', 'number'],
          ['tags', 'Tags']
        ].map(([key, label, type]) => (
          <label key={key}>
            {label}
            <input type={type || 'text'} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </label>
        ))}
        <label className="wide">Address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        <label className="wide">Prescription / Medicines<textarea value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })} /></label>
        <label className="wide">Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div>
      <div className="modal-actions">
        <button onClick={close}>Cancel</button>
        <button className="primary-btn" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

function Reminders({ data, reload, toast, user }) {
  const followups = data.followupsDue || [];
  const pending = data.reminders.filter((item) => item.status !== 'done');
  const done = data.reminders.filter((item) => item.status === 'done').slice(0, 20);
  const canManage = user.role === 'admin';
  const customerMap = new Map(data.customers.map((customer) => [customer.id, customer]));
  const markDone = async (id) => {
    await api(`/reminders/${id}/done`, { method: 'POST' });
    toast('Reminder marked done');
    await reload();
  };
  return (
    <section className="page-flow">
      <Card title="WhatsApp Follow-ups Due">
        {followups.map(({ customer, message, dueDate }) => (
          <div className="action-row" key={customer.id}>
            <div>
              <strong>{customer.name}</strong>
              <span>{customer.mobile} · medicine term ended {fmtDate(dueDate)}</span>
            </div>
            <div className="row-actions">
              <a className="whatsapp-btn" target="_blank" href={whatsappUrl(customer.mobile, message)} rel="noreferrer">
                <MessageCircle size={16} /> Send WhatsApp
              </a>
              <a className="call-btn" href={telUrl(customer.mobile)}><PhoneCall size={16} /> Call</a>
            </div>
          </div>
        ))}
        {!followups.length && <Empty text="No customer medicine terms have ended today." />}
      </Card>
      <Card title="Pending Reminders">
        {pending.map((reminder) => {
          const customer = customerMap.get(reminder.customerId);
          return (
            <div className="action-row" key={reminder.id}>
              <div>
                <strong>{customer?.name || 'Unknown customer'}</strong>
                <span>{reminder.message} · {fmtDate(reminder.dueDate)} {reminder.dueTime}</span>
              </div>
              <div className="row-actions">
                {customer?.mobile && <a className="call-btn" href={telUrl(customer.mobile)}><PhoneCall size={15} /> Call</a>}
                {canManage && <button className="ok-btn" onClick={() => markDone(reminder.id)}><Check size={15} /> Done</button>}
              </div>
            </div>
          );
        })}
        {!pending.length && <Empty text="No pending reminders." />}
      </Card>
      <Card title="Completed">
        <Table
          columns={['Customer', 'Message', 'Date']}
          rows={done.map((reminder) => [customerMap.get(reminder.customerId)?.name || '-', reminder.message, fmtDate(reminder.dueDate)])}
          empty="No completed reminders yet."
        />
      </Card>
    </section>
  );
}

function Calls({ data, reload, toast, user }) {
  const [form, setForm] = useState({ customerId: '', outcome: 'contacted', duration: 0, notes: '', nextAction: '', nextActionDate: '' });
  const canManage = user.role === 'admin';
  const save = async () => {
    await api('/calls', { method: 'POST', body: form });
    setForm({ customerId: '', outcome: 'contacted', duration: 0, notes: '', nextAction: '', nextActionDate: '' });
    toast('Call logged');
    await reload();
  };
  const customerMap = new Map(data.customers.map((customer) => [customer.id, customer]));
  return (
    <section className="page-flow">
      {canManage && (
        <Card title="Log a Call">
          <div className="form-grid">
            <label>
              Customer
              <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">Select customer</option>
                {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.mobile}</option>)}
              </select>
            </label>
            <label>
              Outcome
              <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}>
                <option value="contacted">Contacted</option>
                <option value="no_answer">No Answer</option>
                <option value="callback">Callback</option>
              </select>
            </label>
            <label>Duration<input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></label>
            <label>Next Action Date<input type="date" value={form.nextActionDate} onChange={(e) => setForm({ ...form, nextActionDate: e.target.value })} /></label>
            <label className="wide">Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <label className="wide">Next Action<input value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} /></label>
          </div>
          <button className="primary-btn" onClick={save}>Save Call</button>
        </Card>
      )}
      <Card title="Call History">
        <Table
          columns={['Customer', 'Outcome', 'Duration', 'Notes', 'By']}
          rows={data.calls.map((call) => {
            const customer = customerMap.get(call.customerId);
            return [
              <div className="table-customer" key={call.id}>
                <strong>{customer?.name || '-'}</strong>
                {customer?.mobile && <a className="call-btn" href={telUrl(customer.mobile)}><PhoneCall size={14} /> Call</a>}
              </div>,
              call.outcome,
              `${call.duration || 0} min`,
              call.notes || '-',
              call.loggedBy
            ];
          })}
          empty="No calls logged yet."
        />
      </Card>
    </section>
  );
}

function UsersPage({ data, reload, toast }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'staff' });
  const create = async () => {
    await api('/users', { method: 'POST', body: form });
    setForm({ name: '', username: '', password: '', role: 'staff' });
    toast('User added');
    await reload();
  };
  return (
    <section className="page-flow">
      <Card title="Add Username & Password">
        <div className="form-grid">
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Username<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="staff">Staff</option><option value="admin">Admin</option></select></label>
        </div>
        <button className="primary-btn" onClick={create}>Create User</button>
      </Card>
      <Card title="Users">
        <Table columns={['Name', 'Username', 'Role', 'Status']} rows={data.users.map((user) => [user.name, user.username, user.role, user.active ? 'Active' : 'Inactive'])} />
      </Card>
    </section>
  );
}

function SettingsPage({ data, reload, toast, user, setUser }) {
  const [form, setForm] = useState(data.settings || {});
  const [adminForm, setAdminForm] = useState({ username: user.username || '', password: '', confirmPassword: '' });
  const canManage = user.role === 'admin';
  useEffect(() => setForm(data.settings || {}), [data.settings]);
  useEffect(() => setAdminForm((current) => ({ ...current, username: user.username || '' })), [user.username]);
  const save = async () => {
    if (!canManage) return;
    await api('/settings', { method: 'PATCH', body: form });
    toast('Settings saved');
    await reload();
  };
  const saveAdminLogin = async () => {
    if (!adminForm.username.trim()) return toast('Username is required', 'warn');
    if (adminForm.password && adminForm.password !== adminForm.confirmPassword) return toast('Passwords do not match', 'warn');
    try {
      const body = { username: adminForm.username };
      if (adminForm.password) body.password = adminForm.password;
      const updatedUser = await api(`/users/${user.id}`, { method: 'PATCH', body });
      setUser(updatedUser);
      setAdminForm({ username: updatedUser.username, password: '', confirmPassword: '' });
      toast('Admin login updated');
      await reload();
    } catch (error) {
      toast(error.message || 'Could not update admin login', 'error');
    }
  };
  const resetData = async () => {
    if (!window.confirm('Delete all customers, reminders, calls, products, and sales? Your admin login and shop settings will stay.')) return;
    await api('/settings/reset-data', { method: 'POST' });
    toast('All shop data deleted', 'warn');
    await reload();
  };
  const backup = async () => {
    const data = await api('/backup');
    downloadJson(data, `hanuman-medical-backup-${today()}.json`);
  };
  return (
    <section className="page-flow">
      <Card title="Shop Details">
        <div className="form-grid">
          <label>Shop Name<input disabled={!canManage} value={form.shopName || ''} onChange={(e) => setForm({ ...form, shopName: e.target.value })} /></label>
          <label>Phone<input disabled={!canManage} value={form.shopPhone || ''} onChange={(e) => setForm({ ...form, shopPhone: e.target.value })} /></label>
          <label className="wide">Address<input disabled={!canManage} value={form.shopAddress || ''} onChange={(e) => setForm({ ...form, shopAddress: e.target.value })} /></label>
        </div>
        {canManage && <button className="primary-btn" onClick={save}>Save Settings</button>}
      </Card>
      {canManage && (
        <Card title="Admin Login">
          <div className="form-grid">
            <label>Admin Username<input value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} /></label>
            <label>New Password<input type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} placeholder="Leave blank to keep current" /></label>
            <label>Confirm Password<input type="password" value={adminForm.confirmPassword} onChange={(e) => setAdminForm({ ...adminForm, confirmPassword: e.target.value })} placeholder="Repeat new password" /></label>
          </div>
          <button className="primary-btn" onClick={saveAdminLogin}>Update Admin Login</button>
        </Card>
      )}
      <Card title="Data Management">
        {canManage ? (
          <div className="settings-actions">
            <button onClick={backup}><Download size={16} /> Download Backup</button>
            <button className="danger-btn" onClick={resetData}><Trash2 size={16} /> Delete All Shop Data</button>
          </div>
        ) : (
          <p className="muted-text">Backup and data reset are available to admin users only.</p>
        )}
      </Card>
      <Card title="Workflow & Deployment">
        <div className="workflow-list">
          <p><b>Daily opening:</b> login, check due WhatsApp follow-ups, check low stock, then start POS billing.</p>
          <p><b>During sale:</b> select customer, add medicines, complete invoice. Stock reduces and next follow-up is created.</p>
          <p><b>Follow-up:</b> when medicine term ends, click WhatsApp to send: “Aapki medicine ka term khatam ho gaya hai. Kya aapko aur medicine chahiye?”</p>
          <p><b>Deployment:</b> use `npm run build` then `npm start`. For multi-counter use, deploy behind HTTPS and replace JSON file storage with PostgreSQL/Supabase.</p>
        </div>
      </Card>
    </section>
  );
}

function Modal({ title, close, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        <div className="card-head">
          <h3>{title}</h3>
          <button onClick={close}><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [toastState, setToastState] = useState(null);
  const data = useLoad(user);

  useEffect(() => {
    const token = localStorage.getItem('hm_token');
    if (!token) return;
    api('/auth/me').then((res) => setUser(res.user)).catch(() => setToken(null));
  }, []);

  const toast = (message, type = 'ok') => setToastState({ message, type });
  const logout = () => {
    setToken(null);
    setUser(null);
    setPage('dashboard');
  };

  if (!user) return <><Login onLogin={setUser} /><Toast toast={toastState} clear={() => setToastState(null)} /></>;
  if (data.loading) return <div className="loading"><Activity className="spin" /> Loading shop...</div>;

  const props = { data, reload: data.reload, toast, user, setUser };
  const pageNode = {
    dashboard: <Dashboard data={data} setPage={setPage} user={user} />,
    pos: <POS {...props} />,
    inventory: <Inventory {...props} />,
    customers: <Customers {...props} />,
    reminders: <Reminders {...props} />,
    calls: <Calls {...props} />,
    users: user.role === 'admin' ? <UsersPage {...props} /> : <Dashboard data={data} setPage={setPage} user={user} />,
    settings: <SettingsPage {...props} />
  }[page];

  return (
    <>
      <Shell user={user} data={data} page={page} setPage={setPage} onLogout={logout}>
        {data.error && <div className="form-error">{data.error}</div>}
        {pageNode}
      </Shell>
      <Toast toast={toastState} clear={() => setToastState(null)} />
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
