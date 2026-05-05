const TOKEN_KEY = 'hm_token';

function localApiOrigins() {
  if (typeof window === 'undefined') return [''];

  const origins = [];
  const addOrigin = (origin) => {
    if (!origin || origins.includes(origin)) return;
    origins.push(origin);
  };

  if (window.location.protocol !== 'file:') addOrigin(window.location.origin);

  const isLocalHost = ['127.0.0.1', 'localhost', ''].includes(window.location.hostname);
  if (isLocalHost) {
    ['127.0.0.1', 'localhost'].forEach((host) => {
      addOrigin(`http://${host}:5174`);
      addOrigin(`http://${host}:5180`);
    });
  }

  return origins.length ? origins : [''];
}

function routeMissingMessage(message) {
  return typeof message === 'string' && (
    message.includes('Route not found') ||
    message.includes('Cannot GET /api') ||
    message.includes('Cannot POST /api')
  );
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const body = options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body;
  const origins = localApiOrigins();
  let lastError = null;

  for (let index = 0; index < origins.length; index += 1) {
    const origin = origins[index];
    const url = origin ? `${origin}/api${path}` : `/api${path}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        body
      });

      if (response.status === 204) return null;
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : await response.text();
      if (response.ok) return data;

      const message = typeof data === 'string' ? data : data.error || 'Request failed';
      lastError = new Error(message);
      const shouldRetry = index < origins.length - 1 && response.status === 404 && routeMissingMessage(message);
      if (!shouldRetry) throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Request failed');
      if (index === origins.length - 1) throw lastError;
    }
  }

  throw lastError || new Error('Request failed');
}

export const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value || 0));

export const fmtDate = (value) => {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const today = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export function whatsappUrl(mobile, message) {
  const phone = String(mobile || '').replace(/\D/g, '');
  const indiaPhone = phone.length === 10 ? `91${phone}` : phone;
  return `https://wa.me/${indiaPhone}?text=${encodeURIComponent(message)}`;
}

export function telUrl(mobile) {
  const phone = String(mobile || '').replace(/[^\d+]/g, '');
  return phone ? `tel:${phone}` : '#';
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
