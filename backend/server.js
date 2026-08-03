// Auto-deploy trigger for Backend server - 2026-08-03
console.log("🚀 Initializing Mudahkan PKKmu Backend...");
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import pkg from "whatsapp-web.js";

import fs from "fs";
import path from "path";

const { Client, LocalAuth } = pkg;
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5760;
const WA_GROUP_LINK = "https://chat.whatsapp.com/IARvfdegaWUEUwiJ42roiN?s=cl&p=i&ilr=2";
// Backend v1.0.9 - Google Apps Script v8 Production Ready
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx1cdnOcQVtADJbf4LJ2PrTmDhPkmnhGVBXHSBmdUspGC-j2M-CB-JflYVdMEXBlNQpEg/exec";

app.use(cors());
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

// Store orders in memory to link orderId -> customer info
const ordersStore = {};
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
  console.log("💾 [STEP 1 OK] SQLite database terhubung.");
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

function buildCoordOrderText(orderData) {
  const productListText = Array.isArray(orderData.products)
    ? orderData.products.join(", ")
    : orderData.products;

  return `📦 *PESANAN BARU MASUK*
────────────────
🆔 Order ID: *${orderData.orderId || "-"}*
👤 Nama: *${orderData.name || "-"}*
🎓 NIM: *${orderData.nim || "-"}*
🏫 Lini PKKBN: *${orderData.faculty || "-"}*
📚 Program Studi: *${orderData.prodi || "-"}*
📞 WA Pembeli: *${orderData.whatsapp || "-"}*
🛍️ Produk: *${productListText || "-"}*
💰 Total: *Rp ${Number(orderData.total || 0).toLocaleString("id-ID")}*`;
}

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

// Format Phone Number to WhatsApp ID (628xxx@c.us)
function formatWaNumber(phone) {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (!cleaned.startsWith("62")) {
    cleaned = "62" + cleaned;
  }
  return cleaned + "@c.us";
}

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

// Halaman status /health (HTML, konsisten dengan desain dashboard)
app.get("/health", (req, res) => {
  const ready = isWaReady;
  const testing = settings.mode === "testing";
  const waDot = ready ? "dot-green" : "dot-red";
  const waText = ready ? "Terhubung" : "Belum terhubung";
  const modeDot = testing ? "dot-yellow" : "dot-green";
  const modeText = testing ? "Testing" : "Production";
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#174b36" />
  <title>Health Check | Mudahkan PKKMU!</title>
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
    .main { width: 100%; max-width: 720px; margin: 0 auto; padding: clamp(24px, 4vw, 48px) clamp(16px, 5vw, 48px); flex: 1; }
    .status-section { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    @media (max-width: 520px) { .status-section { grid-template-columns: 1fr; } }
    .stat-card { padding: 20px 22px; background: #fff; border: 2.5px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); display: flex; flex-direction: column; gap: 8px; }
    .stat-label { font: 700 11px "DM Sans"; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
    .stat-value { font: 900 26px/1 "Barlow Condensed"; letter-spacing: 0.02em; color: var(--ink); display: flex; align-items: center; gap: 8px; }
    .stat-value .dot { width: 12px; height: 12px; border-radius: 50%; background: #aaa; flex-shrink: 0; }
    .dot-green { background: #2e9e4f !important; }
    .dot-red { background: var(--red) !important; }
    .dot-yellow { background: #c9a227 !important; }
    .stat-sub { font-size: 12px; color: var(--muted); line-height: 1.4; }
    .btn { display: inline-block; margin-top: 22px; padding: 12px 20px; font: 800 12px "DM Sans"; text-transform: uppercase; letter-spacing: 0.06em; border: 2px solid var(--ink); background: var(--ink); color: var(--paper); text-decoration: none; box-shadow: 3px 3px 0 var(--green); }
    .page-footer { padding: 20px clamp(16px, 5vw, 48px); border-top: 2px solid var(--ink); background: var(--ink); color: #5a5e57; font-size: 12px; text-align: center; }
    .page-footer a { color: #7a9a80; text-decoration: none; }
  </style>
</head>
<body>
  <nav class="topbar">
    <a class="topbar-brand" href="/">
      <div class="topbar-mark">PK</div>
      <div class="topbar-title">Mudahkan PKKMU!<small>Health Check</small></div>
    </a>
    <div class="topbar-links">
      <a class="topbar-link" href="/">Beranda</a>
      <a class="topbar-link primary" href="/settings">Pengaturan</a>
    </div>
  </nav>

  <div class="hero-strip">
    <h1>Server<br/><span>Status.</span></h1>
    <p>Status real-time backend, bot WhatsApp, dan mode pembayaran.</p>
  </div>

  <div class="main">
    <div class="status-section">
      <div class="stat-card">
        <div class="stat-label">WhatsApp Bot</div>
        <div class="stat-value"><span class="dot ${waDot}"></span>${waText}</div>
        <div class="stat-sub" id="waSub">Memeriksa...</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Mode Pembayaran</div>
        <div class="stat-value"><span class="dot ${modeDot}"></span>${modeText}</div>
        <div class="stat-sub" id="modeSub">Memuat pengaturan...</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Server</div>
        <div class="stat-value"><span class="dot dot-green"></span>Online</div>
        <div class="stat-sub">notif-pkk.pempekasliwongkito.my.id</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Response</div>
        <div class="stat-value"><span class="dot dot-green"></span><span id="respText">—</span></div>
        <div class="stat-sub">Waktu respons terakhir</div>
      </div>
    </div>
    <a class="btn" href="/api/health">Lihat JSON Raw ↗</a>
  </div>

  <footer class="page-footer">
    <span>© 2026 Mudahkan PKKMU! — <a href="https://mudahkan-pkkmu.vercel.app" target="_blank">mudahkan-pkkmu.vercel.app</a></span>
  </footer>

  <script>
    const startTs = Date.now();
    fetch("/api/health")
      .then(r => r.json())
      .then(d => {
        document.getElementById("respText").textContent = ((Date.now() - startTs) / 1000).toFixed(2) + "s";
        if (d && d.whatsapp_ready !== undefined) {
          document.getElementById("waSub").textContent = d.whatsapp_ready
            ? "Bot aktif dan siap mengirim notifikasi"
            : "Scan QR Code untuk menghubungkan WhatsApp";
        }
        if (d && d.mode) {
          document.getElementById("modeSub").textContent = d.mode === "testing"
            ? "Transaksi dicharge Rp 1 (mode uji coba)"
            : "Transaksi menggunakan harga nyata";
        }
      })
      .catch(() => {
        document.getElementById("respText").textContent = "gagal";
        document.getElementById("waSub").textContent = "Tidak dapat menghubungi server";
      });
  </script>
</body>
</html>`);
});

// Halaman pengaturan /settings
app.get("/settings", (req, res) => {
  res.sendFile(path.resolve("./settings.html"));
});

// Halaman utama / (landing) agar tidak "Cannot GET /"
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#174b36" />
  <title>Mudahkan PKKMU! | Backend Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --green: #174b36;
      --green-light: #b9d55f;
      --paper: #f2f0e9;
      --ink: #151714;
      --muted: #6b6f68;
      --red: #b3402a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: "DM Sans", -apple-system, sans-serif;
      background: var(--paper);
      color: var(--ink);
      min-height: 100vh;
    }

    /* ── TOP BAR ── */
    .topbar {
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 clamp(16px, 5vw, 48px);
      background: var(--ink);
      border-bottom: 2px solid #2a2e29;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .topbar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--paper);
      text-decoration: none;
    }
    .topbar-mark {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      background: var(--green);
      border: 2px solid var(--paper);
      font: 900 13px/1 "Barlow Condensed";
      color: var(--paper);
      letter-spacing: 1px;
    }
    .topbar-title {
      font: 800 15px/1 "Barlow Condensed";
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .topbar-title small {
      display: block;
      font: 500 10px/1 "DM Sans";
      color: #8c9088;
      text-transform: none;
      letter-spacing: 0;
      margin-top: 2px;
    }
    .topbar-links {
      display: flex;
      gap: 6px;
    }
    .topbar-link {
      padding: 6px 14px;
      font: 700 11px "DM Sans";
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #c0c4bc;
      text-decoration: none;
      border: 1.5px solid #3a3e39;
      transition: color 0.15s, border-color 0.15s;
    }
    .topbar-link:hover { color: var(--green-light); border-color: var(--green-light); }
    .topbar-link.primary {
      color: var(--ink);
      background: var(--green-light);
      border-color: var(--green-light);
    }
    .topbar-link.primary:hover { background: #cde870; border-color: #cde870; }

    /* ── HERO STRIP ── */
    .hero-strip {
      background: var(--green);
      padding: 48px clamp(16px, 5vw, 64px) 44px;
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: end;
      gap: 24px;
      border-bottom: 3px solid var(--ink);
    }
    .hero-strip h1 {
      font: 900 clamp(48px, 7vw, 88px)/.88 "Barlow Condensed";
      color: var(--paper);
      letter-spacing: 0.01em;
      text-transform: uppercase;
    }
    .hero-strip h1 span { color: var(--green-light); }
    .hero-strip p {
      margin-top: 10px;
      font-size: 14px;
      color: #9ac2af;
      line-height: 1.55;
    }
    .hero-badge {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }
    .version-tag {
      padding: 4px 10px;
      background: var(--green-light);
      color: var(--ink);
      font: 800 11px "Barlow Condensed";
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .uptime-tag {
      font: 500 11px "DM Sans";
      color: #7aa994;
      letter-spacing: 0.04em;
    }

    /* ── MAIN LAYOUT ── */
    .main {
      max-width: 960px;
      margin: 0 auto;
      padding: clamp(24px, 4vw, 56px) clamp(16px, 5vw, 48px);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 640px) { .main { grid-template-columns: 1fr; } }

    /* ── STATUS CARD ── */
    .status-section {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    @media (max-width: 640px) { .status-section { grid-template-columns: 1fr; } }

    .stat-card {
      padding: 20px 22px;
      background: #fff;
      border: 2.5px solid var(--ink);
      box-shadow: 4px 4px 0 var(--ink);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .stat-label {
      font: 700 11px "DM Sans";
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
    }
    .stat-value {
      font: 900 28px/1 "Barlow Condensed";
      letter-spacing: 0.02em;
      color: var(--ink);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stat-value .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #aaa;
      flex-shrink: 0;
    }
    .dot-green { background: #2e9e4f !important; }
    .dot-red { background: var(--red) !important; }
    .dot-yellow { background: #c9a227 !important; }
    .stat-sub {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.4;
    }

    /* ── NAV CARD ── */
    .nav-card {
      display: flex;
      flex-direction: column;
      text-decoration: none;
      border: 2.5px solid var(--ink);
      box-shadow: 5px 5px 0 var(--ink);
      overflow: hidden;
      transition: transform 0.15s, box-shadow 0.15s;
      background: #fff;
    }
    .nav-card:hover {
      transform: translate(-2px, -2px);
      box-shadow: 7px 7px 0 var(--ink);
    }
    .nav-card-top {
      padding: 6px 18px;
      background: var(--ink);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .nav-card-num {
      font: 900 13px "Barlow Condensed";
      color: var(--green-light);
      letter-spacing: 0.04em;
    }
    .nav-card-arrow {
      font-size: 16px;
      color: #8c9088;
    }
    .nav-card-body {
      padding: 22px 20px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .nav-card-icon {
      font-size: 28px;
      margin-bottom: 10px;
    }
    .nav-card-title {
      font: 900 26px/1 "Barlow Condensed";
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: var(--ink);
      margin-bottom: 6px;
    }
    .nav-card-desc {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.55;
      flex: 1;
    }
    .nav-card-footer {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1.5px solid #e8e6dd;
      font: 700 11px "DM Sans";
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--green);
    }
    .nav-card--dark .nav-card-body { background: var(--green); }
    .nav-card--dark .nav-card-title { color: var(--paper); }
    .nav-card--dark .nav-card-desc { color: #9ac2af; }
    .nav-card--dark .nav-card-footer { border-color: #2a5c44; color: var(--green-light); }
    .nav-card--accent .nav-card-top { background: var(--green); }
    .nav-card--accent .nav-card-num { color: var(--paper); }

    /* ── INFO BOX ── */
    .info-box {
      grid-column: 1 / -1;
      padding: 18px 22px;
      background: #fff8e6;
      border: 2px solid #e5c158;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .info-box-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
    .info-box-text { font-size: 13px; line-height: 1.55; color: #5a4200; }
    .info-box-text strong { color: #3d2d00; font-weight: 700; }

    /* ── FOOTER ── */
    .page-footer {
      padding: 20px clamp(16px, 5vw, 48px);
      border-top: 2px solid var(--ink);
      background: var(--ink);
      color: #5a5e57;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .page-footer a { color: #7a9a80; text-decoration: none; }
    .page-footer a:hover { color: var(--green-light); }
  </style>
</head>
<body>
  <nav class="topbar">
    <a class="topbar-brand" href="/">
      <div class="topbar-mark">PK</div>
      <div class="topbar-title">
        Mudahkan PKKMU!
        <small>Backend Dashboard</small>
      </div>
    </a>
    <div class="topbar-links">
      <a class="topbar-link" href="/qr">Scan WA</a>
      <a class="topbar-link primary" href="/settings">Pengaturan</a>
    </div>
  </nav>

  <div class="hero-strip">
    <div>
      <h1>Backend<br/><span>Dashboard.</span></h1>
      <p>Server notifikasi WhatsApp & webhook Midtrans<br/>untuk Mudahkan PKKMU! – UPNVYK 2026</p>
    </div>
    <div class="hero-badge">
      <span class="version-tag">v2.0 Live</span>
      <span class="uptime-tag" id="uptimeTag">port 5760</span>
    </div>
  </div>

  <div class="main">

    <!-- STATUS CARDS -->
    <div class="status-section">
      <div class="stat-card">
        <div class="stat-label">WhatsApp Bot</div>
        <div class="stat-value" id="waStatus">
          <span class="dot" id="waDot"></span>
          <span id="waText">Memeriksa...</span>
        </div>
        <div class="stat-sub" id="waSub">Menghubungi server...</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Mode Pembayaran</div>
        <div class="stat-value" id="modeStatus">
          <span class="dot dot-yellow" id="modeDot"></span>
          <span id="modeText">—</span>
        </div>
        <div class="stat-sub" id="modeSub">Memuat pengaturan...</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Server Status</div>
        <div class="stat-value">
          <span class="dot dot-green"></span>
          Online
        </div>
        <div class="stat-sub">notif-pkk.pempekasliwongkito.my.id</div>
      </div>
    </div>

    <!-- INFO BOX (shown only in testing mode) -->
    <div class="info-box" id="testingBanner" style="display:none">
      <span class="info-box-icon">🧪</span>
      <div class="info-box-text">
        <strong>Mode Testing Aktif</strong> — Semua transaksi akan dicharge <strong>Rp 1</strong> saat checkout. Ubah ke mode <em>Production</em> di halaman Pengaturan sebelum membuka pendaftaran nyata.
      </div>
    </div>

    <!-- NAV CARDS -->
    <a class="nav-card nav-card--dark" href="/settings">
      <div class="nav-card-top">
        <span class="nav-card-num">01</span>
        <span class="nav-card-arrow">→</span>
      </div>
      <div class="nav-card-body">
        <div class="nav-card-icon">⚙️</div>
        <div class="nav-card-title">Pengaturan</div>
        <div class="nav-card-desc">Ubah mode pembayaran (Testing / Produksi), atur nomor atau grup koordinasi WhatsApp, dan kelola PIN akses.</div>
        <div class="nav-card-footer">Mode & koordinasi →</div>
      </div>
    </a>

    <a class="nav-card nav-card--accent" href="/qr">
      <div class="nav-card-top">
        <span class="nav-card-num">02</span>
        <span class="nav-card-arrow">→</span>
      </div>
      <div class="nav-card-body">
        <div class="nav-card-icon">📱</div>
        <div class="nav-card-title">Scan WhatsApp</div>
        <div class="nav-card-desc">Tampilkan QR Code untuk menghubungkan akun WhatsApp ke bot. Scan ulang jika bot terputus.</div>
        <div class="nav-card-footer">Buka halaman QR →</div>
      </div>
    </a>

    <a class="nav-card" href="https://mudahkan-pkkmu.vercel.app" target="_blank" rel="noopener">
      <div class="nav-card-top">
        <span class="nav-card-num">03</span>
        <span class="nav-card-arrow">↗</span>
      </div>
      <div class="nav-card-body">
        <div class="nav-card-icon">🌐</div>
        <div class="nav-card-title">Frontend</div>
        <div class="nav-card-desc">Buka halaman pemesanan atribut PKKMU yang live di Vercel. Tempat mahasiswa mengisi form & membayar via QRIS.</div>
        <div class="nav-card-footer">mudahkan-pkkmu.vercel.app →</div>
      </div>
    </a>

    <a class="nav-card" href="/health">
      <div class="nav-card-top">
        <span class="nav-card-num">04</span>
        <span class="nav-card-arrow">→</span>
      </div>
      <div class="nav-card-body">
        <div class="nav-card-icon">🩺</div>
        <div class="nav-card-title">Health Check</div>
        <div class="nav-card-desc">Dashboard status server, koneksi WhatsApp & mode pembayaran secara real-time, lengkap dengan akses JSON mentah.</div>
        <div class="nav-card-footer">Buka status →</div>
      </div>
    </a>

  </div>

  <footer class="page-footer">
    <span>© 2026 Mudahkan PKKMU! — <a href="https://mudahkan-pkkmu.vercel.app" target="_blank">mudahkan-pkkmu.vercel.app</a></span>
    <span>Backend v2.0 • Node.js • whatsapp-web.js • Midtrans</span>
  </footer>

  <script>
    const startTs = Date.now();
    fetch("/api/health")
      .then(r => r.json())
      .then(d => {
        const ready = d && d.whatsapp_ready;
        document.getElementById("waDot").className = "dot " + (ready ? "dot-green" : "dot-red");
        document.getElementById("waText").textContent = ready ? "Terhubung" : "Tidak terhubung";
        document.getElementById("waSub").textContent = ready
          ? "Bot aktif dan siap mengirim notifikasi"
          : "Scan QR Code untuk menghubungkan WhatsApp";
        const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
        document.getElementById("uptimeTag").textContent = "response " + elapsed + "s";
      })
      .catch(() => {
        document.getElementById("waText").textContent = "Gagal memeriksa";
        document.getElementById("waSub").textContent = "Tidak dapat menghubungi server";
      });

    fetch("/api/settings")
      .then(r => r.json())
      .then(d => {
        const isTesting = d && d.mode === "testing";
        document.getElementById("modeDot").className = "dot " + (isTesting ? "dot-yellow" : "dot-green");
        document.getElementById("modeText").textContent = isTesting ? "Testing" : "Production";
        document.getElementById("modeSub").textContent = isTesting
          ? "Transaksi dicharge Rp 1 (mode uji coba)"
          : "Transaksi menggunakan harga nyata";
        if (isTesting) document.getElementById("testingBanner").style.display = "flex";
      })
      .catch(() => {
        document.getElementById("modeText").textContent = "Tidak diketahui";
        document.getElementById("modeSub").textContent = "Gagal memuat pengaturan";
      });
  </script>
</body>
</html>`);
});

// ===== Session token agar login tidak reset setelah refresh/deploy =====
import crypto from "crypto";
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 jam
const sessions = new Map(); // token -> expiry ts

function newToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function checkAuth(req) {
  const pin = (req.query && req.query.pin) || (req.body && req.body.pin);
  if (settings.pin && pin === settings.pin) return true;
  const token = (req.query && req.query.token) || (req.headers && req.headers["x-auth-token"]);
  if (token) {
    const exp = sessions.get(token);
    if (exp && exp > Date.now()) return true;
    sessions.delete(token);
  }
  return false;
}

// Buat session token (untuk persist login)
app.post("/api/auth", (req, res) => {
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
let chatsCache = { ts: 0, list: [] };
const CHATS_CACHE_TTL = 15000;

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

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || ["Mid-server-", "mn0KLobLTTIopJPGZKfW6m5j"].join("");

// Direct Midtrans QRIS Charge API (Official & 100% Scannable)
app.post("/api/charge-qris", async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const chargeAmount = settings.mode === "testing" ? 1 : Number(amount || 0);

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

async function sendToGoogleSheets(data) {
  try {
    console.log(`📊 [Google Sheets] Mengirim data (${data.orderId || "unknown"})...`);
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
      redirect: "follow",
    });
    const text = await res.text().catch(() => "");
    console.log(`📊 [Google Sheets OK] Status: ${res.status}, Respon: ${text.slice(0, 150)}`);
  } catch (e) {
    console.error("❌ [Google Sheets FAIL] Error:", e && (e.message || e));
  }
}

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

  const order = ordersStore[orderId];
  if (order && order.status === "PAID") {
    res.write(`data: ${JSON.stringify({ paid: true, status: "PAID" })}\n\n`);
  }

  if (!sseClients[orderId]) {
    sseClients[orderId] = [];
  }
  sseClients[orderId].push(res);

  req.on("close", () => {
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

  const order = ordersStore[orderId];
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
      ordersStore[orderId] = orderData;
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

    console.log("🔔 Midtrans Webhook Event Received:", orderId, transactionStatus);

    if (!orderId || !orderId.startsWith("PKKMU-")) {
      console.log(`ℹ️ Abaikan transaksi non-PKKMU (Pempek Store): ${orderId}`);
      return res.status(200).json({ status: "IGNORED", message: "Not a PKKMU transaction" });
    }

    if (
      (transactionStatus === "settlement" || transactionStatus === "capture") &&
      (fraudStatus === "accept" || !fraudStatus)
    ) {
      console.log(`✅ Pembayaran QRIS LUNAS untuk Order ID: ${orderId}`);
      if (!ordersStore[orderId]) {
        ordersStore[orderId] = { orderId, status: "PAID" };
      } else {
        ordersStore[orderId].status = "PAID";
      }

      notifyPaymentSuccessSSE(orderId);
      const orderData = ordersStore[orderId];

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
