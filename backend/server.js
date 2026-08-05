// Auto-deploy trigger for Backend server - 2026-08-03
console.log("🚀 Initializing Mudahkan PKKmu Backend...");
import express from "express";
import cors from "cors";
import helmet from "helmet";
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import pkg from "whatsapp-web.js";

import fs from "fs";
import path from "path";

import { PORT, WA_GROUP_LINK, ALLOWED_ORIGINS, MIDTRANS_SERVER_KEY } from "./config.js";
import { formatWaNumber } from "./services/whatsapp.js";
import { PRODUCT_PRICES, computeTotal } from "./services/midtrans.js";
import { sendToGoogleSheets } from "./services/sheets.js";

const { Client, LocalAuth } = pkg;

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // ponytail: crossOriginResourcePolicy:false biar QR image/stream gak ke-block, tighten when CORS origin locked
// CORS origin-locked: hanya izinkan domain frontend resmi + localhost dev.
// ponytail: SSE/EventSource gak kirim Origin header di beberapa browser lama — add when: perlu dukungan legacy
app.use(cors({
  origin(origin, cb) {
    // Allow requests tanpa origin (curl, healthcheck, server-to-server, same-origin)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "50mb" }));

process.on("unhandledRejection", (reason, p) => {
  console.error("⚠️ Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception:", err);
});

// Start HTTP Server immediately so Docker container stays UP
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Node.js Backend Server listening on port: ${PORT}`);
});

// Store orders — SQLite with in-memory fallback
// ponytail: in-memory fallback when SQLite unavailable, migrate fully when DB proven stable
const ordersStore = {};

function initOrdersTable() {
  if (!db) return;
  db.exec(`
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

function saveOrder(orderData) {
  if (!db) {
    ordersStore[orderData.orderId] = orderData;
    return;
  }
  db.prepare(`
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

function getOrder(orderId) {
  if (!db) return ordersStore[orderId] || null;
  const row = db.prepare("SELECT * FROM orders WHERE orderId = ?").get(orderId);
  if (!row) return null;
  return {
    ...row,
    products: row.products ? (() => { try { return JSON.parse(row.products); } catch { return row.products; } })() : [],
  };
}

function updateOrderStatus(orderId, status) {
  if (!db) {
    if (!ordersStore[orderId]) ordersStore[orderId] = { orderId };
    ordersStore[orderId].status = status;
    return ordersStore[orderId];
  }
  // INSERT OR IGNORE first so webhook can mark PAID even if /api/send-order-notif hasn't persisted yet
  db.prepare("INSERT OR IGNORE INTO orders (orderId, status) VALUES (?, ?)").run(orderId, status);
  db.prepare("UPDATE orders SET status = ? WHERE orderId = ?").run(status, orderId);
  return getOrder(orderId);
}

let latestQrImage = "";
let isWaReady = false;

// ===== Pengaturan (SQLite local DB / JSON fallback) =====
const SETTINGS_DB = path.resolve("./.wwebjs_auth/settings.db");
const LEGACY_SETTINGS = path.resolve("./settings.json");
const DEFAULT_PIN = process.env.SETTINGS_PIN || "pkkmu2026";
let settings = {
  mode: "production", // "production" | "testing"
  coordWa: "",        // Nomor WA koordinator (khusus koordinasi)
  coordType: "wa",    // "wa" (nomor) | "group" (nama grup WhatsApp)
  pin: DEFAULT_PIN,
};

let db = null;
console.log("📍 [STEP 1] Loading SQLite database...");
try {
  const dir = path.dirname(SETTINGS_DB);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const Database = (await import("better-sqlite3")).default;
  db = new Database(SETTINGS_DB);
  db.pragma("journal_mode = WAL");
  console.log("💾 [STEP 1 OK] SQLite database terhubung (WAL mode).");
} catch (e) {
  console.error("⚠️ [STEP 1 FALLBACK] SQLite tidak dapat dimuat, fallback ke settings.json:", e && e.message);
  db = null;
}

function loadSettings() {
  try {
    if (!db) {
      if (fs.existsSync(LEGACY_SETTINGS)) {
        settings = { ...settings, ...JSON.parse(fs.readFileSync(LEGACY_SETTINGS, "utf8")) };
      }
      return;
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        mode TEXT NOT NULL DEFAULT 'production',
        coordWa TEXT NOT NULL DEFAULT '',
        coordType TEXT NOT NULL DEFAULT 'wa',
        pin TEXT NOT NULL
      );
    `);
    const row = db.prepare("SELECT mode, coordWa, coordType, pin FROM settings WHERE id = 1").get();
    if (row) {
      settings = {
        mode: row.mode || "production",
        coordWa: row.coordWa || "",
        coordType: row.coordType || "wa",
        pin: row.pin || DEFAULT_PIN,
      };
    }
  } catch (e) {
    console.error("Gagal membaca SQLite settings:", e);
  }
}

function saveSettings() {
  try {
    if (!db) {
      fs.writeFileSync(LEGACY_SETTINGS, JSON.stringify(settings, null, 2));
      return;
    }
    db.prepare(`
      INSERT INTO settings (id, mode, coordWa, coordType, pin)
      VALUES (1, @mode, @coordWa, @coordType, @pin)
      ON CONFLICT(id) DO UPDATE SET
        mode = excluded.mode,
        coordWa = excluded.coordWa,
        coordType = excluded.coordType,
        pin = excluded.pin
    `).run(settings);
  } catch (e) {
    console.error("Gagal menyimpan SQLite settings:", e);
  }
}

loadSettings();
initOrdersTable();

// Clean all stale Chromium locks before initializing.
// NOTE: SingletonLock/Cookie/Socket are SYMLINKS to a (now-dead) container hostname.
// fs.existsSync follows symlinks and returns false for dangling ones, so use lstatSync
// to detect and remove them reliably.
const sessionDir = path.resolve("./.wwebjs_auth/session");
if (fs.existsSync(sessionDir)) {
  const lockFiles = ["SingletonLock", "SingletonCookie", "SingletonSocket", "DevToolsActivePort"];
  lockFiles.forEach((file) => {
    const fullPath = path.join(sessionDir, file);
    try {
      if (fs.lstatSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`🧹 Lock dibersihkan: ${file}`);
      }
    } catch (e) {}
  });
}

// Initialize WhatsApp Web Client with LocalAuth for session persistence
function createWaClient() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", async (qr) => {
    console.log("\n==========================================");
    console.log("SCAN QR CODE DENGAN WHATSAPP UNTUK LOGIN:");
    console.log("==========================================\n");
    qrcodeTerminal.generate(qr, { small: true });

    try {
      latestQrImage = await QRCode.toDataURL(qr);
    } catch (err) {
      console.error("Gagal membuat data URL QR:", err);
    }
  });

  client.on("ready", () => {
    console.log("✅ WhatsApp Web Bot siap dan terhubung!");
    isWaReady = true;
    latestQrImage = "";
  });

  client.on("authenticated", () => {
    console.log("🔐 Autentikasi WhatsApp Berhasil.");
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ Gagal Autentikasi WhatsApp:", msg);
  });

  client.on("disconnected", (reason) => {
    console.log("⚠️ WhatsApp Terputus:", reason);
    isWaReady = false;
  });

  return client;
}

console.log("📍 [STEP 2] Creating WhatsApp Client instance...");
let waClient = createWaClient();

// initialize dengan retry otomatis — jangan biarkan crash mematikan proses
const MAX_INIT_RETRIES = 8;
async function startWaClient() {
  for (let attempt = 1; attempt <= MAX_INIT_RETRIES; attempt++) {
    try {
      console.log(`🤖 [STEP 3] Inisialisasi WhatsApp Puppeteer (percobaan ${attempt})...`);
      await waClient.initialize();
      return; // sukses, selesai
    } catch (err) {
      console.error(`❌ Inisialisasi gagal (percobaan ${attempt}):`, err && err.message);
      if (attempt >= MAX_INIT_RETRIES) {
        console.error("⛔ Semua percobaan inisialisasi WhatsApp gagal. Tetap menjalankan server HTTP.");
        return;
      }
      try {
        await waClient.destroy();
      } catch (e) {}
      waClient = createWaClient();
      const delayMs = Math.min(10000, 3000 * attempt);
      console.log(`⏳ Coba lagi dalam ${delayMs / 1000} detik...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// Delay WA init by 2 seconds so Express HTTP server opens port 5760 cleanly first
setTimeout(() => {
  startWaClient();
}, 2000);

// Resolve target koordinasi -> chat ID WhatsApp
// coordType "wa"    : nomor HP -> 628xxx@c.us
// coordType "group" : nama grup -> dicari dari daftar chat, pakai invite code jika ada
async function resolveCoordTarget() {
  if (!settings.coordWa || !isWaReady) return null;

  const targetStr = settings.coordWa.trim();
  if (targetStr.endsWith("@g.us") || targetStr.endsWith("@c.us")) {
    return targetStr;
  }

  const isDigitsOnly = /^\+?\d+$/.test(targetStr);
  const nameClean = targetStr.toLowerCase().replace(/[^a-z0-9]/g, "");

  try {
    let chats = await waClient.getChats().catch(() => []);
    console.log(`🔍 [DEBUG resolveCoordTarget] Target: "${targetStr}", Total getChats: ${chats.length}`);
    for (const chat of chats) {
      if (!chat || !chat.id) continue;
      const chatId = String(chat.id._serialized || chat.id);
      const rawName = String(chat.name || chat.formattedTitle || chat.title || "");
      const chatNameClean = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (rawName && (chatNameClean.includes(nameClean) || nameClean.includes(chatNameClean))) {
        console.log(`🎯 [resolveCoordTarget OK] Match "${rawName}" -> JID: ${chatId}`);
        if (chatId.includes("@")) return chatId;
      }
    }

    const storeChats = await fetchChatsFromStore();
    console.log(`🔍 [DEBUG resolveCoordTarget] Target: "${targetStr}", Total storeChats: ${storeChats.length}`);
    for (const chat of storeChats) {
      const chatId = String(chat.id || "");
      const rawName = String(chat.name || "");
      const chatNameClean = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (rawName && (chatNameClean.includes(nameClean) || nameClean.includes(chatNameClean))) {
        console.log(`🎯 [resolveCoordTarget Store OK] Match "${rawName}" -> JID: ${chatId}`);
        if (chatId.includes("@")) return chatId;
      }
    }
  } catch (e) {
    console.error("Error resolveCoordTarget group search:", e);
  }

  if (isDigitsOnly) {
    return formatWaNumber(targetStr);
  }
  return null;
}

// Halaman Web /qr untuk scan QR Code di browser dengan gambar HD bersih
function qrPageShell(title, contentHtml) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#174b36" />
  ${!isWaReady ? '<meta http-equiv="refresh" content="4" />' : ""}
  <title>${title} | Mudahkan PKKMU!</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root { --green:#174b36; --green-light:#b9d55f; --paper:#f2f0e9; --ink:#151714; --muted:#6b6f68; --red:#b3402a; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "DM Sans", -apple-system, sans-serif; background: var(--paper); color: var(--ink); min-height: 100vh; display: flex; flex-direction: column; }
    .topbar { height: 60px; display: flex; align-items: center; justify-content: space-between; padding: 0 clamp(16px, 5vw, 48px); background: var(--ink); border-bottom: 2px solid #2a2e29; position: sticky; top: 0; z-index: 50; }
    .topbar-brand { display: flex; align-items: center; gap: 10px; color: var(--paper); text-decoration: none; }
    .topbar-mark { width: 34px; height: 34px; display: grid; place-items: center; background: var(--green); border: 2px solid var(--paper); font: 900 13px/1 "Barlow Condensed"; color: var(--paper); letter-spacing: 1px; }
    .topbar-title { font: 800 15px/1 "Barlow Condensed"; letter-spacing: 0.05em; text-transform: uppercase; }
    .topbar-title small { display: block; font: 500 10px/1 "DM Sans"; color: #8c9088; text-transform: none; letter-spacing: 0; margin-top: 2px; }
    .topbar-links { display: flex; gap: 6px; }
    .topbar-link { padding: 6px 14px; font: 700 11px "DM Sans"; text-transform: uppercase; letter-spacing: 0.06em; color: #c0c4bc; text-decoration: none; border: 1.5px solid #3a3e39; transition: color 0.15s, border-color 0.15s; }
    .topbar-link:hover { color: var(--green-light); border-color: var(--green-light); }
    .topbar-link.primary { color: var(--ink); background: var(--green-light); border-color: var(--green-light); }
    .topbar-link.primary:hover { background: #cde870; border-color: #cde870; }
    .hero-strip { background: var(--green); padding: 32px clamp(16px, 5vw, 64px) 30px; border-bottom: 3px solid var(--ink); }
    .hero-strip h1 { font: 900 clamp(32px, 5vw, 56px)/.9 "Barlow Condensed"; color: var(--paper); letter-spacing: 0.01em; text-transform: uppercase; }
    .hero-strip h1 span { color: var(--green-light); }
    .hero-strip p { margin-top: 8px; font-size: 13px; color: #9ac2af; }
    .main { width: 100%; max-width: 720px; margin: 0 auto; padding: clamp(24px, 4vw, 48px) clamp(16px, 5vw, 48px); flex: 1; display: grid; place-items: start center; }
    .card { width: 100%; padding: 32px; background: #fff; border: 2.5px solid var(--ink); box-shadow: 5px 5px 0 var(--ink); text-align: center; }
    .card .icon { font-size: 44px; margin-bottom: 14px; }
    .card h2 { font: 900 30px/1 "Barlow Condensed"; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 8px; color: var(--ink); }
    .card p { font-size: 13px; color: var(--muted); line-height: 1.55; }
    .card img.qr { width: 260px; height: 260px; display: block; margin: 20px auto; border: 2.5px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); }
    .card .hint { display: block; margin-top: 12px; font-size: 12px; color: #999; }
    .pill { display: inline-flex; align-items: center; gap: 8px; font: 700 12px "DM Sans"; text-transform: uppercase; letter-spacing: 0.06em; padding: 6px 14px; border: 2px solid var(--ink); background: var(--paper); }
    .pill .dot { width: 10px; height: 10px; border-radius: 50%; background: #aaa; }
    .pill.ready .dot { background: #2e9e4f; }
    .btn { display: inline-block; margin-top: 18px; padding: 12px 20px; font: 800 12px "DM Sans"; text-transform: uppercase; letter-spacing: 0.06em; border: 2px solid var(--ink); background: var(--ink); color: var(--paper); text-decoration: none; box-shadow: 3px 3px 0 var(--green); }
    .page-footer { padding: 20px clamp(16px, 5vw, 48px); border-top: 2px solid var(--ink); background: var(--ink); color: #5a5e57; font-size: 12px; text-align: center; }
    .page-footer a { color: #7a9a80; text-decoration: none; }
  </style>
</head>
<body>
  <nav class="topbar">
    <a class="topbar-brand" href="/">
      <div class="topbar-mark">PK</div>
      <div class="topbar-title">Mudahkan PKKMU!<small>Scan WhatsApp</small></div>
    </a>
    <div class="topbar-links">
      <a class="topbar-link" href="/">Beranda</a>
      <a class="topbar-link primary" href="/settings">Pengaturan</a>
    </div>
  </nav>

  <div class="hero-strip">
    <h1>WhatsApp<br/><span>QR Code.</span></h1>
    <p>Hubungkan akun WhatsApp ke bot — sekali saja, sesi tersimpan otomatis.</p>
  </div>

  <div class="main">
    ${contentHtml}
  </div>

  <footer class="page-footer">
    <span>© 2026 Mudahkan PKKMU! — <a href="https://mudahkan-pkkmu.vercel.app" target="_blank">mudahkan-pkkmu.vercel.app</a></span>
  </footer>
</body>
</html>`;
}

app.get("/qr", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  if (isWaReady) {
    return res.send(qrPageShell("Bot Terhubung", `
      <div class="card">
        <div class="icon">✅</div>
        <h2>Bot Terhubung!</h2>
        <p>Sesi WhatsApp aktif & siap mengirim notifikasi pesanan.</p>
        <span class="pill ready" style="margin-top:18px"><span class="dot"></span> Sesi aktif</span><br/>
        <a class="btn" href="/">Ke Beranda</a>
      </div>
    `));
  }

  if (latestQrImage) {
    return res.send(qrPageShell("Scan WhatsApp QR", `
      <div class="card">
        <h2>Scan QR Code</h2>
        <p>Buka WhatsApp di HP → <strong>Perangkat Tertaut</strong> → <strong>Tautkan Perangkat</strong> → scan QR di bawah ini.</p>
        <img class="qr" src="${latestQrImage}" alt="QR Code WhatsApp" />
        <small>Halaman otomatis reload tiap 6 detik...</small>
      </div>
    `));
  }

  return res.send(qrPageShell("Memuat QR", `
    <div class="card">
      <div class="icon">⏳</div>
      <h2>Memuat QR Code...</h2>
      <p>Silakan tunggu beberapa detik.</p>
    </div>
  `));
});

// Endpoint status server
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "mudahkan-pkkmu-backend",
    whatsapp_ready: isWaReady,
    mode: settings.mode,
    timestamp: new Date().toISOString(),
  });
});

// Halaman status /health (HTML statis, data via client-side fetch)
// ponytail: extract dari inline template, add when: butuh SSR untuk SEO
app.get("/health", (req, res) => {
  res.sendFile(path.resolve("./health.html"));
});

// Halaman pengaturan /settings
app.get("/settings", (req, res) => {
  res.sendFile(path.resolve("./settings.html"));
});

// Halaman utama / (landing) — HTML statis, data via client-side fetch
// ponytail: extract dari inline template, add when: butuh SSR untuk SEO
app.get("/", (req, res) => {
  res.sendFile(path.resolve("./index.html"));
});

// ===== Session token agar login tidak reset setelah refresh/deploy =====
import crypto from "crypto";
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 jam
const sessions = new Map(); // token -> expiry ts

// Rate limiter in-memory (tanpa dependency) — cegah brute-force PIN.
// ponytail: single-instance OK; add when: multi-replica → pindah ke Redis (ioredis) atau express-rate-limit
const loginAttempts = new Map(); // ip -> { count, resetAt }
const LOGIN_MAX = 5;             // max 5 percobaan
const LOGIN_WINDOW = 15 * 60 * 1000; // per 15 menit

function rateLimitLogin(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || rec.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW });
    return next();
  }
  rec.count += 1;
  if (rec.count > LOGIN_MAX) {
    const minsLeft = Math.ceil((rec.resetAt - now) / 60000);
    return res.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${minsLeft} menit.` });
  }
  return next();
}

function newToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function checkAuth(req) {
  // ponytail: PIN/token via header only — query string bocor di URL/logs, add when: butuh backward compat lama
  const pin = (req.headers && req.headers["x-auth-pin"]) || (req.body && req.body.pin);
  if (settings.pin && pin === settings.pin) return true;
  const token = (req.headers && req.headers["x-auth-token"]);
  if (token) {
    const exp = sessions.get(token);
    if (exp && exp > Date.now()) return true;
    sessions.delete(token);
  }
  return false;
}

// Buat session token (untuk persist login)
app.post("/api/auth", rateLimitLogin, (req, res) => {
  const { pin } = req.body || {};
  if (!settings.pin || pin !== settings.pin) {
    return res.status(401).json({ error: "PIN salah." });
  }
  const token = newToken();
  sessions.set(token, Date.now() + SESSION_TTL);
  res.json({ status: "success", token });
});

// Ambil pengaturan (tanpa auth hanya kembalikan mode)
app.get("/api/settings", (req, res) => {
  const isAuth = checkAuth(req);
  res.json({
    mode: settings.mode,
    coordWa: isAuth ? settings.coordWa : "",
    coordType: isAuth ? settings.coordType : "",
    locked: !isAuth,
    whatsapp_ready: isWaReady,
  });
});

// Simpan pengaturan (wajib auth)
app.post("/api/settings", (req, res) => {
  const { mode, coordWa, coordType, newPin } = req.body || {};

  if (!checkAuth(req)) {
    return res.status(401).json({ error: "PIN salah." });
  }

  if (mode === "production" || mode === "testing") {
    settings.mode = mode;
  }
  if (typeof coordWa === "string") {
    settings.coordWa = coordWa.trim();
  }
  if (coordType === "wa" || coordType === "group") {
    settings.coordType = coordType;
  }
  if (newPin && newPin.trim().length >= 4) {
    settings.pin = newPin.trim();
  }

  saveSettings();
  res.json({
    status: "success",
    mode: settings.mode,
    coordWa: settings.coordWa,
    coordType: settings.coordType,
    whatsapp_ready: isWaReady,
  });
});

// Daftar chat yang ada di bot WhatsApp (untuk memilih tujuan koordinasi) — wajib PIN
async function fetchChatsFromStore() {
  if (!isWaReady || !waClient) return [];

  // Strategi 1: Official whatsapp-web.js getChats()
  try {
    const chats = await waClient.getChats();
    if (Array.isArray(chats) && chats.length > 0) {
      const out = [];
      const seen = new Set();
      for (const c of chats) {
        if (!c || !c.id) continue;
        const jid = c.id._serialized || (typeof c.id === "string" ? c.id : (c.id.user ? c.id.user + (c.isGroup ? "@g.us" : "@c.us") : ""));
        if (!jid || !jid.includes("@")) continue;

        const rawName = c.name || c.formattedTitle || c.title || c.id.user || "";
        const name = String(rawName || jid).trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);

        const isGroup = Boolean(c.isGroup || jid.endsWith("@g.us"));
        out.push({
          type: isGroup ? "group" : "wa",
          name: name,
          phone: jid.replace(/@.*$/, ""),
          id: jid,
        });
      }

      if (out.length > 0) {
        console.log(`✅ [fetchChatsFromStore OK] getChats() returned ${out.length} chats with valid JIDs!`);
        return out.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      }
    }
  } catch (err) {}

  // Strategi 2: Deep React Fiber & Store Traversal (100% Reliable & Presisi JID @g.us)
  try {
    if (!waClient.pupPage) return [];
    const directChats = await waClient.pupPage.evaluate(() => {
      const list = [];
      const seen = new Set();

      // Check window.Store / Webpack Collections
      try {
        let models = [];
        if (window.Store && window.Store.Chat) {
          models = window.Store.Chat.models || window.Store.Chat._models || [];
        }
        if ((!models || models.length === 0) && window.require) {
          try {
            const chatColl = window.require('WAWebChatCollection');
            if (chatColl && chatColl.ChatCollection) {
              models = chatColl.ChatCollection.getModelsArray() || [];
            }
          } catch (e) {}
        }

        for (const m of models) {
          if (!m || !m.id) continue;
          const jid = m.id._serialized || String(m.id);
          const name = m.name || m.formattedTitle || m.title || m.contact?.name || "";
          if (name && jid && jid.includes("@") && !seen.has(name)) {
            seen.add(name);
            const isGroup = Boolean(m.isGroup || jid.endsWith("@g.us"));
            list.push({
              type: isGroup ? "group" : "wa",
              name: String(name),
              phone: jid.replace(/@.*$/, ""),
              id: jid,
            });
          }
        }
      } catch (e) {}

      // Deep React Fiber Search on #pane-side chat rows
      try {
        const rows = Array.from(document.querySelectorAll('#pane-side div[role="row"], #pane-side [data-testid="chat-list"] > div'));
        for (const row of rows) {
          let name = "";
          let jid = "";
          const titleEl = row.querySelector('span[title]');
          if (titleEl) name = (titleEl.getAttribute('title') || titleEl.textContent || "").trim();

          const stack = [];
          for (const k in row) {
            if (k.startsWith('__reactFiber') || k.startsWith('__reactProps')) {
              stack.push({ node: row[k], depth: 0 });
            }
          }

          while (stack.length > 0) {
            const { node, depth } = stack.pop();
            if (!node || depth > 15 || jid) continue;

            const p = node.memoizedProps;
            if (p) {
              if (p.chat && p.chat.id) {
                jid = p.chat.id._serialized || String(p.chat.id);
                if (!name && p.chat.name) name = p.chat.name;
              } else if (p.id && typeof p.id === "string" && p.id.includes("@")) {
                jid = p.id;
              } else if (p.jid && typeof p.jid === "string" && p.jid.includes("@")) {
                jid = p.jid;
              }
            }

            if (node.child) stack.push({ node: node.child, depth: depth + 1 });
            if (node.sibling) stack.push({ node: node.sibling, depth: depth + 1 });
            if (node.return && depth < 3) stack.push({ node: node.return, depth: depth + 1 });
          }

          if (name && jid && jid.includes("@") && !seen.has(name)) {
            seen.add(name);
            const isGroup = Boolean(jid.endsWith("@g.us"));
            list.push({
              type: isGroup ? "group" : "wa",
              name: name,
              phone: jid.replace(/@.*$/, ""),
              id: jid,
            });
          }
        }
      } catch (e) {}

      return list;
    });

    if (Array.isArray(directChats) && directChats.length > 0) {
      console.log(`✅ [DOM Traversal OK] Found ${directChats.length} chats with valid JIDs!`);
      return directChats.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
  } catch (err) {}

  return [];
}

app.get("/api/chats", async (req, res) => {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: "Silakan login dengan PIN terlebih dahulu." });
  }
  if (!isWaReady) {
    return res.status(503).json({ error: "WhatsApp bot belum siap." });
  }
  try {
    const list = await fetchChatsFromStore();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({ chats: list, total: list.length });
  } catch (err) {
    console.error("Gagal mengambil daftar chat:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// Direct Midtrans QRIS Charge API (Official & 100% Scannable)
// SECURITY: total dihitung SERVER-SIDE dari productIds, bukan amount dari klien.
// ponytail: single source of truth harga di server; frontend cukup kirim id — add when: produk dinamis dr DB/API
app.post("/api/charge-qris", async (req, res) => {
  try {
    const { orderId } = req.body;
    // amount dihitung server-side — abaikan req.body.amount agar tak bisa di-fraud
    const productIds = Array.isArray(req.body.productIds) ? req.body.productIds : [];
    const computedTotal = computeTotal(productIds);
    if (!orderId || computedTotal <= 0) {
      return res.status(400).json({ error: "orderId valid & daftar produk wajib tersedia." });
    }
    const chargeAmount = settings.mode === "testing" ? 1 : computedTotal;

    const authHeader = "Basic " + Buffer.from(MIDTRANS_SERVER_KEY + ":").toString("base64");
    const response = await fetch("https://api.midtrans.com/v2/charge", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment_type: "qris",
        transaction_details: {
          order_id: orderId,
          gross_amount: chargeAmount,
        },
        qris: {
          acquirer: "gopay",
        },
        custom_expiry: {
          expiry_duration: 10,
          unit: "minute",
        },
      }),
    });

    const data = await response.json();
    let qrUrl = "";
    if (data && data.actions) {
      const qrAction = data.actions.find((a) => a.name === "generate-qr-code");
      if (qrAction) qrUrl = qrAction.url;
    }

    if (qrUrl) {
      console.log(`✅ [Midtrans QRIS OK] Order: ${orderId}, Rp ${chargeAmount}`);
      return res.json({ status: "success", qr_url: qrUrl, gross_amount: chargeAmount, order_id: orderId });
    } else {
      console.error("Midtrans Charge Error:", data);
      return res.status(400).json({ status: "error", message: data.status_message || "Midtrans QRIS failed", raw: data });
    }
  } catch (err) {
    console.error("Error charge-qris endpoint:", err);
    return res.status(500).json({ error: err.toString() });
  }
});

// Active SSE connections keyed by orderId
const sseClients = {};

app.get("/api/payment-stream", (req, res) => {
  const { orderId } = req.query;
  if (!orderId) return res.status(400).end();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (res.flushHeaders) res.flushHeaders();

  const order = getOrder(orderId);
  if (order && order.status === "PAID") {
    res.write(`data: ${JSON.stringify({ paid: true, status: "PAID" })}\n\n`);
  }

  if (!sseClients[orderId]) {
    sseClients[orderId] = [];
  }
  sseClients[orderId].push(res);

  // ponytail: heartbeat tiap 15s cegah proxy/LB cut idle SSE — add when: polling-based push (WebSocket)
  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat\n\n`); } catch (e) {}
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    if (sseClients[orderId]) {
      sseClients[orderId] = sseClients[orderId].filter((client) => client !== res);
    }
  });
});

function notifyPaymentSuccessSSE(orderId) {
  const clients = sseClients[orderId];
  if (clients && clients.length > 0) {
    console.log(`⚡ [SSE Real-Time Push OK] Notifying ${clients.length} frontend browser client(s) for Order: ${orderId}`);
    const payload = `data: ${JSON.stringify({ paid: true, status: "PAID" })}\n\n`;
    clients.forEach((client) => {
      try {
        client.write(payload);
      } catch (e) {}
    });
  }
}

// Endpoint untuk mengecek status pembayaran pesanan real-time dari frontend
app.get("/api/check-order-status", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const { orderId } = req.query;
  if (!orderId) return res.json({ paid: false });

  const order = getOrder(orderId);
  const isPaid = Boolean(order && order.status === "PAID");

  if (isPaid) {
    return res.json({ paid: true, status: "PAID", order });
  }
  return res.json({ paid: false, status: "PENDING" });
});

// Endpoint untuk menyimpan pesanan awal & notifikasi ke backend
app.post("/api/send-order-notif", async (req, res) => {
  try {
    const { name, nim, prodi, faculty, whatsapp, products, total, orderId, photoBase64, photoName, photoType } = req.body;

    if (!whatsapp) {
      return res.status(400).json({ error: "Nomor WhatsApp wajib diisi." });
    }

    const orderData = { name, nim, prodi, faculty, whatsapp, products, total, orderId, status: "PENDING" };
    if (orderId) {
      saveOrder(orderData);
    }

    // Simpan data ke Google Sheets & Google Drive
    sendToGoogleSheets({ name, nim, prodi, faculty, whatsapp, products, total, orderId, photoBase64, photoName, photoType, status: "PENDING" });

    return res.json({ status: "success", message: "Pesanan berhasil disimpan di backend." });
  } catch (err) {
    console.error("Gagal menyimpan data pesanan:", err);
    return res.status(500).json({ error: err.toString() });
  }
});

// Endpoint Webhook Midtrans (Diakses oleh Midtrans ketika Pembayaran QRIS LUNAS)
app.post("/api/midtrans-webhook", async (req, res) => {
  try {
    const notification = req.body;
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;
    const statusCode = notification.status_code;
    const grossAmount = notification.gross_amount;
    const receivedSignature = notification.signature_key;

    console.log("🔔 Midtrans Webhook Event Received:", orderId, transactionStatus);

    if (!orderId || !orderId.startsWith("PKKMU-")) {
      console.log(`ℹ️ Abaikan transaksi non-PKKMU (Pempek Store): ${orderId}`);
      return res.status(200).json({ status: "IGNORED", message: "Not a PKKMU transaction" });
    }

    // Verify Midtrans signature: SHA512(order_id + status_code + gross_amount + SERVER_KEY)
    const expectedSignature = crypto
      .createHash("sha512")
      .update(orderId + statusCode + grossAmount + MIDTRANS_SERVER_KEY)
      .digest("hex");

    if (receivedSignature !== expectedSignature) {
      console.error(`❌ Webhook signature mismatch for ${orderId} — rejecting`);
      return res.status(403).json({ status: "ERROR", message: "Invalid signature" });
    }

    if (
      (transactionStatus === "settlement" || transactionStatus === "capture") &&
      (fraudStatus === "accept" || !fraudStatus)
    ) {
      console.log(`✅ Pembayaran QRIS LUNAS untuk Order ID: ${orderId}`);
      updateOrderStatus(orderId, "PAID");

      notifyPaymentSuccessSSE(orderId);
      const orderData = getOrder(orderId);

      // Update status lunas di Google Sheets
      sendToGoogleSheets({ ...orderData, orderId, status: "LUNAS (PAID)" });

      if (isWaReady) {
        const formattedNumber = orderData.whatsapp ? formatWaNumber(orderData.whatsapp) : "";
        const productListText = Array.isArray(orderData.products)
          ? orderData.products.join(", ")
          : orderData.products;

        // 1. PESAN TUNGGAL RESMI UNTUK PEMBELI
        if (formattedNumber) {
          const successMsg = `🎉 *PEMBAYARAN QRIS BERHASIL (LUNAS)*

Halo kak *${orderData.name || "Peserta"}*, terima kasih! Pembayaran untuk pesanan atribut ospek UPN Veteran Yogyakarta 2026 kamu telah *KAMI TERIMA*!

📋 *Detail Transaksi Lunas:*
• Order ID: *${orderId}*
• Total Pembayaran: *Rp ${Number(orderData.total || 0).toLocaleString("id-ID")}* (LUNAS via QRIS Midtrans)
• Atribut: *${productListText || "-"}*

📲 *LANGKAH WAJIB SELANJUTNYA:*
Silakan langsung bergabung ke grup WhatsApp resmi peserta PKKBN UPNVYK melalui link berikut:
${WA_GROUP_LINK}

_Terima kasih! Sampai jumpa di lokasi pengambilan atribut & PKKBN 2026!_`;

          await waClient.sendMessage(formattedNumber, successMsg);
          console.log(`📩 Notifikasi PEMBAYARAN LUNAS terkirim via WA ke pembeli: ${formattedNumber}`);
        }

        // 2. PESAN KOORDINASI HANYA KETIKA PEMBAYARAN LUNAS KE GRUP 2FOUNDERS / ADMIN
        if (settings.coordWa) {
          try {
            const coordTarget = await resolveCoordTarget();
            if (coordTarget) {
              const paidCoordText = `📦 *PESANAN BARU MASUK (LUNAS)*
────────────────
🆔 Order ID: *${orderId}*
👤 Nama: *${orderData.name || "-"}*
🎓 NIM: *${orderData.nim || "-"}*
🏫 Lini PKKBN: *${orderData.faculty || "-"}*
📚 Program Studi: *${orderData.prodi || "-"}*
📞 WA Pembeli: *${orderData.whatsapp || "-"}*
🛍️ Produk: *${productListText || "-"}*
💰 Total: *Rp ${Number(orderData.total || 0).toLocaleString("id-ID")}*
✅ Status: *LUNAS (VERIFIED QRIS)*`;

              await waClient.sendMessage(coordTarget, paidCoordText);
              console.log(`🤝 Pesan koordinasi pesanan LUNAS terkirim ke grup: ${settings.coordWa} (${coordTarget})`);
            }
          } catch (coordErr) {
            console.error("Gagal kirim pesan koordinasi lunas:", coordErr);
          }
        }
      }
    }

    res.status(200).json({ status: "OK" });
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// Global error handler — catches errors from all routes
// ponytail: add request logging / error tracking (Sentry) when scale demands it
app.use((err, req, res, next) => {
  console.error("⚠️ Unhandled route error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});
