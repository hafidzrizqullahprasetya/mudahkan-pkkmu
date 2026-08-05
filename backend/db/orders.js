// db/orders.js — order persistence (SQLite / in-memory fallback)
import { state } from "../state.js";

export function initOrdersTable() {
  if (!state.db) return;
  state.db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      orderId TEXT PRIMARY KEY,
      name TEXT,
      nim TEXT,
      prodi TEXT,
      faculty TEXT,
      whatsapp TEXT,
      products TEXT,
      total REAL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      photoBase64 TEXT,
      photoName TEXT,
      photoType TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function saveOrder(orderData) {
  if (!state.db) {
    state.ordersStore[orderData.orderId] = orderData;
    return;
  }
  state.db.prepare(`
    INSERT INTO orders (orderId, name, nim, prodi, faculty, whatsapp, products, total, status, photoBase64, photoName, photoType)
    VALUES (@orderId, @name, @nim, @prodi, @faculty, @whatsapp, @products, @total, @status, @photoBase64, @photoName, @photoType)
    ON CONFLICT(orderId) DO UPDATE SET
      name = excluded.name,
      nim = excluded.nim,
      prodi = excluded.prodi,
      faculty = excluded.faculty,
      whatsapp = excluded.whatsapp,
      products = excluded.products,
      total = excluded.total,
      status = excluded.status,
      photoBase64 = excluded.photoBase64,
      photoName = excluded.photoName,
      photoType = excluded.photoType
  `).run({
    orderId: orderData.orderId,
    name: orderData.name || "",
    nim: orderData.nim || "",
    prodi: orderData.prodi || "",
    faculty: orderData.faculty || "",
    whatsapp: orderData.whatsapp || "",
    products: Array.isArray(orderData.products) ? JSON.stringify(orderData.products) : (orderData.products || ""),
    total: orderData.total || 0,
    status: orderData.status || "PENDING",
    photoBase64: orderData.photoBase64 || "",
    photoName: orderData.photoName || "",
    photoType: orderData.photoType || "",
  });
}

export function getOrder(orderId) {
  if (!state.db) return state.ordersStore[orderId] || null;
  const row = state.db.prepare("SELECT * FROM orders WHERE orderId = ?").get(orderId);
  if (!row) return null;
  return {
    ...row,
    products: row.products ? (() => { try { return JSON.parse(row.products); } catch { return row.products; } })() : [],
  };
}

export function updateOrderStatus(orderId, status) {
  if (!state.db) {
    if (!state.ordersStore[orderId]) state.ordersStore[orderId] = { orderId };
    state.ordersStore[orderId].status = status;
    return state.ordersStore[orderId];
  }
  // INSERT OR IGNORE first so webhook can mark PAID even if /api/send-order-notif hasn't persisted yet
  state.db.prepare("INSERT OR IGNORE INTO orders (orderId, status) VALUES (?, ?)").run(orderId, status);
  state.db.prepare("UPDATE orders SET status = ? WHERE orderId = ?").run(status, orderId);
  return getOrder(orderId);
}
