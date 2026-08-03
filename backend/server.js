// Auto-deploy trigger test for Host mode binding
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

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Store orders in memory to link orderId -> customer info
const ordersStore = {};
let latestQrImage = "";
let isWaReady = false;

// ===== Pengaturan (settings.json) =====
const SETTINGS_FILE = path.resolve("./settings.json");
const DEFAULT_PIN = process.env.SETTINGS_PIN || "pkkmu2026";

let settings = {
  mode: "production", // "production" | "testing"
  coordWa: "",        // Nomor WA koordinator (khusus koordinasi)
  coordType: "wa",    // "wa" (nomor) | "group" (nama grup WhatsApp)
  pin: DEFAULT_PIN,
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      settings = { ...settings, ...saved };
    }
  } catch (e) {
    console.error("Gagal membaca settings.json:", e);
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error("Gagal menyimpan settings.json:", e);
  }
}

loadSettings();

function buildCoordOrderText(orderData, paid) {
  const productListText = Array.isArray(orderData.products)
    ? orderData.products.join(", ")
    : orderData.products;
  const statusLine = paid
    ? "✅ Status: *SUDAH BAYAR (LUNAS)*"
    : "⏳ Status: *MENUNGGU PEMBAYARAN*";

  return `📦 *PESANAN BARU MASUK*
────────────────
🆔 Order ID: *${orderData.orderId || "-"}*
👤 Nama: *${orderData.name || "-"}*
🎓 NIM: *${orderData.nim || "-"}*
🏫 Lini PKKBN: *${orderData.faculty || "-"}*
📚 Program Studi: *${orderData.prodi || "-"}*
📞 WA Pembeli: *${orderData.whatsapp || "-"}*
🛍️ Produk: *${productListText || "-"}*
💰 Total: *Rp ${Number(orderData.total || 0).toLocaleString("id-ID")}*
${statusLine}`;
}

// Clean all stale Chromium locks before initializing
const sessionDir = path.resolve("./.wwebjs_auth/session");
if (fs.existsSync(sessionDir)) {
  const lockFiles = ["SingletonLock", "SingletonCookie", "SingletonSocket", "DevToolsActivePort"];
  lockFiles.forEach((file) => {
    const fullPath = path.join(sessionDir, file);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (e) {}
    }
  });
}

// Initialize WhatsApp Web Client with LocalAuth for session persistence
const waClient = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu"
    ],
  },
});

waClient.on("qr", async (qr) => {
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

waClient.on("ready", () => {
  console.log("✅ WhatsApp Web Bot siap dan terhubung!");
  isWaReady = true;
  latestQrImage = "";
});

waClient.on("authenticated", () => {
  console.log("🔐 Autentikasi WhatsApp Berhasil.");
});

waClient.on("auth_failure", (msg) => {
  console.error("❌ Gagal Autentikasi WhatsApp:", msg);
});

waClient.on("disconnected", (reason) => {
  console.log("⚠️ WhatsApp Terputus:", reason);
  isWaReady = false;
});

waClient.initialize();

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

  if (settings.coordType === "group") {
    const name = settings.coordWa.trim().toLowerCase();
    const chats = await waClient.getChats();
    const groupChat = chats.find(
      (chat) => chat.isGroup && chat.name && chat.name.toLowerCase() === name
    );
    if (groupChat) {
      return groupChat.id._serialized;
    }
    // Fallback: cari lewat kode undangan (link chat.whatsapp.com/<code>)
    const byInvite = chats.find(
      (chat) =>
        chat.isGroup &&
        chat.inviteCode &&
        settings.coordWa.trim().toLowerCase().includes(chat.inviteCode.toLowerCase())
    );
    if (byInvite) {
      return byInvite.id._serialized;
    }
    console.error(`❌ Grup koordinasi "${settings.coordWa}" tidak ditemukan di chat bot.`);
    return null;
  }

  return formatWaNumber(settings.coordWa);
}

// Halaman Web /qr untuk scan QR Code di browser dengan gambar HD bersih
app.get("/qr", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  if (isWaReady) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Bot - Connected</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #f2f0e9; color: #151714; }
          .card { background: #ffffff; padding: 40px; border-radius: 12px; border: 3px solid #174b36; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
          .icon { font-size: 48px; margin-bottom: 12px; }
          h1 { color: #174b36; margin: 0 0 8px; font-size: 24px; }
          p { color: #555; margin: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h1>WhatsApp Bot Terhubung!</h1>
          <p>Sesi login WhatsApp aktif & siap mengabari mahasiswa baru.</p>
        </div>
      </body>
      </html>
    `);
  }

  if (latestQrImage) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Scan WhatsApp QR Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="6">
        <style>
          body { font-family: sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #151714; color: #ffffff; }
          .card { background: #ffffff; color: #151714; padding: 32px; border-radius: 16px; text-align: center; max-width: 360px; }
          h2 { margin: 0 0 8px; color: #174b36; }
          p { margin: 0 0 20px; font-size: 14px; color: #666; }
          img { width: 260px; height: 260px; display: block; margin: 0 auto; border: 2px solid #151714; }
          small { display: block; margin-top: 16px; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Scan WhatsApp QR</h2>
          <p>Buka WhatsApp di HP ➔ Perangkat Tertaut ➔ Scan QR Code ini:</p>
          <img src="${latestQrImage}" alt="QR Code WhatsApp" />
          <small>Halaman otomatis reload tiap 6 detik...</small>
        </div>
      </body>
      </html>
    `);
  }

  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Memuat QR Code...</title>
      <meta http-equiv="refresh" content="3">
      <style>
        body { font-family: sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #f2f0e9; }
        .card { background: #fff; padding: 30px; border-radius: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <h3>⏳ Memuat QR Code WhatsApp...</h3>
        <p>Silakan tunggu 3 detik...</p>
      </div>
    </body>
    </html>
  `);
});

// Endpoint status server
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "mudahkan-pkkmu-backend",
    whatsapp_ready: isWaReady,
    timestamp: new Date().toISOString(),
  });
});

// Halaman pengaturan /settings
app.get("/settings", (req, res) => {
  res.sendFile(path.resolve("./settings.html"));
});

// Halaman utama / (landing) agar tidak "Cannot GET /"
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#174b36" />
      <title>Mudahkan PKKMU! | Notifikasi Bot</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f2f0e9; color: #151714; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
        .shell { width: 100%; max-width: 560px; margin: auto; }
        .hero { text-align: center; margin-bottom: 28px; }
        .brand-mark { width: 72px; height: 72px; border-radius: 50%; background: #174b36; color: #f2f0e9; display: inline-grid; place-items: center; font-weight: 900; font-size: 26px; letter-spacing: 1px; border: 3px solid #151714; box-shadow: 4px 4px 0 #151714; margin-bottom: 18px; }
        h1 { font-size: 26px; text-transform: uppercase; letter-spacing: 0.5px; }
        h1 span { color: #174b36; }
        .sub { font-size: 14px; color: #555; margin-top: 6px; }
        .card { background: #ffffff; border: 3px solid #151714; box-shadow: 4px 4px 0 #151714; padding: 26px; margin-bottom: 22px; }
        .status-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .pill { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; padding: 6px 12px; border: 2px solid #151714; border-radius: 999px; background: #f2f0e9; }
        .pill .dot { width: 10px; height: 10px; border-radius: 50%; background: #aaa; }
        .pill.ready .dot { background: #2e9e4f; }
        .pill.not-ready .dot { background: #b3402a; }
        .links { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .btn { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border: 2px solid #151714; background: #174b36; color: #f2f0e9; box-shadow: 3px 3px 0 #151714; text-decoration: none; transition: transform 0.1s ease, box-shadow 0.1s ease; }
        .btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 #151714; }
        .btn small { display: block; font-size: 11px; text-transform: none; letter-spacing: 0; font-weight: 500; color: #cfe3d8; }
        .btn--light { background: #f2f0e9; color: #151714; }
        .btn--light small { color: #666; }
        footer { text-align: center; font-size: 12px; color: #888; }
        @media (max-width: 520px) { .links { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="hero">
          <span class="brand-mark">PK</span>
          <h1>Mudahkan <span>PKKMU!</span></h1>
          <p class="sub">Backend notifikasi pesanan & WhatsApp bot</p>
        </div>

        <div class="card">
          <div class="status-row">
            <span class="pill" id="waPill"><span class="dot"></span> WhatsApp: memeriksa...</span>
            <span class="pill" id="modePill">Mode: —</span>
          </div>
        </div>

        <div class="links">
          <a class="btn" href="/settings">Pengaturan<small>Mode & tujuan koordinasi</small></a>
          <a class="btn btn--light" href="/qr">Scan WhatsApp<small>QR Code bot</small></a>
        </div>

        <footer>Server notifikasi Mudahkan PKKMU! • pemekasliwongkito</footer>
      </div>

      <script>
        fetch("/api/health")
          .then((r) => r.json())
          .then((d) => {
            const pill = document.getElementById("waPill");
            const ready = d && d.whatsapp_ready;
            pill.className = "pill " + (ready ? "ready" : "not-ready");
            pill.innerHTML = '<span class="dot"></span> WhatsApp: ' + (ready ? "Terhubung" : "Belum terhubung");
          })
          .catch(() => {});
        fetch("/api/settings")
          .then((r) => r.json())
          .then((d) => {
            document.getElementById("modePill").textContent = "Mode: " + (d && d.mode === "testing" ? "TESTING" : "PRODUCTION");
          })
          .catch(() => {});
      </script>
    </body>
    </html>
  `);
});

// Ambil pengaturan (tanpa PIN aman? tanpa PIN hanya kembalikan mode)
app.get("/api/settings", (req, res) => {
  const { pin } = req.query;
  const isAuth = settings.pin && pin === settings.pin;
  res.json({
    mode: settings.mode,
    coordWa: isAuth ? settings.coordWa : "",
    coordType: isAuth ? settings.coordType : "",
    locked: !isAuth,
    whatsapp_ready: isWaReady,
  });
});

// Simpan pengaturan (wajib PIN)
app.post("/api/settings", (req, res) => {
  const { pin, mode, coordWa, coordType, newPin } = req.body || {};

  if (!settings.pin || pin !== settings.pin) {
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
  const raw = await waClient.pupPage.evaluate(() => {
    const out = [];
    let models = [];
    try {
      models = window.require("WAWebCollections").Chat.getModelsArray() || [];
    } catch (e) {
      return { __error: e.toString() };
    }
    for (const c of models) {
      try {
        const id = c && c.id && c.id._serialized;
        if (!id) continue;
        if (id.endsWith("@g.us")) {
          let inviteCode = "";
          try { inviteCode = c.inviteCode || ""; } catch (e) {}
          out.push({
            type: "group",
            name: c.name || c.formattedTitle || c.id.user || "Grup tanpa nama",
            id,
            inviteCode,
          });
        } else if (id.endsWith("@c.us")) {
          let name = "";
          try {
            const contact = c.contact;
            if (contact) name = contact.name || contact.pushname || contact.formattedName || contact.formattedTitle || name;
          } catch (e) {}
          out.push({
            type: "wa",
            name: name || c.formattedTitle || c.id.user || "Nomor tanpa nama",
            phone: c.id.user || "",
            id,
          });
        }
      } catch (e) { /* skip chat bermasalah */ }
    }
    return out;
  });
  if (raw && raw.__error) throw new Error(raw.__error);
  return (raw || []).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

app.get("/api/chats", async (req, res) => {
  const { pin } = req.query;
  if (!settings.pin || pin !== settings.pin) {
    return res.status(401).json({ error: "PIN salah." });
  }
  if (!isWaReady) {
    return res.status(503).json({ error: "WhatsApp bot belum siap." });
  }
  if (Date.now() - chatsCache.ts < CHATS_CACHE_TTL && chatsCache.list.length) {
    return res.json({ chats: chatsCache.list, total: chatsCache.list.length, cached: true });
  }
  try {
    const list = await fetchChatsFromStore();
    chatsCache = { ts: Date.now(), list };
    res.json({ chats: list, total: list.length });
  } catch (err) {
    console.error("Gagal mengambil daftar chat:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// Endpoint untuk mengirim notifikasi awal pesanan ke WhatsApp
app.post("/api/send-order-notif", async (req, res) => {
  try {
    const { name, nim, prodi, faculty, whatsapp, products, total, orderId } = req.body;

    if (!whatsapp) {
      return res.status(400).json({ error: "Nomor WhatsApp wajib diisi." });
    }

    if (orderId) {
      ordersStore[orderId] = { name, nim, prodi, faculty, whatsapp, products, total };
    }

    const orderData = ordersStore[orderId] || { name, nim, prodi, faculty, whatsapp, products, total };

    const formattedNumber = formatWaNumber(whatsapp);
    const productListText = Array.isArray(products) ? products.join(", ") : products;

    const messageText = `🎓 *MUDAHKAN PKKMU! - NOTIFIKASI PESANAN*

Halo kak *${name}*, terima kasih telah memesan atribut ospek UPN Veteran Yogyakarta 2026!

📋 *Detail Pesanan:*
• Order ID: *${orderId || "-"}*
• NIM: *${nim || "-"}*
• Program Studi: *${prodi || "-"}*
• Lini PKKBN: *${faculty || "-"}*
• Atribut: *${productListText || "-"}*
• Total Pembayaran: *Rp ${Number(total || 0).toLocaleString("id-ID")}*

💳 *Metode Pembayaran: QRIS (Midtrans)*
Batas waktu pembayaran adalah *10 menit*. Silakan selesaikan pembayaran melalui aplikasi e-wallet atau mobile banking kamu.

📲 *Grup WhatsApp Resmi:*
${WA_GROUP_LINK}

_Pesan ini dikirim otomatis oleh bot Mudahkan PKKMU!_`;

    if (isWaReady) {
      await waClient.sendMessage(formattedNumber, messageText);
      console.log(`📩 Notifikasi tagihan WA terkirim ke: ${formattedNumber}`);

      // Kirim pesan koordinasi ke koordinator jika sudah diset
      if (settings.coordWa) {
        try {
          const coordTarget = await resolveCoordTarget();
          if (coordTarget) {
            const coordText = buildCoordOrderText(orderData, false);
            const coordMsg = await waClient.sendMessage(coordTarget, coordText);
            console.log(`🤝 Pesan koordinasi terkirim ke koordinator: ${settings.coordWa} (${coordTarget})`);
            if (orderId && coordMsg) {
              ordersStore[orderId].coordMessage = coordMsg;
            }
          } else {
            console.error(`⚠️ Target koordinasi tidak tersedia: ${settings.coordWa}`);
          }
        } catch (coordErr) {
          console.error("Gagal kirim pesan koordinasi:", coordErr);
        }
      }

      return res.json({ status: "success", message: "Notifikasi WA berhasil dikirim!" });
    } else {
      console.log("⚠️ WA Client belum ready, pesan ditunda/dilewati.");
      return res.status(503).json({ status: "warning", message: "WhatsApp bot belum siap/scanned." });
    }
  } catch (err) {
    console.error("Gagal mengirim pesan WA:", err);
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

    // AMAN 100%: Filter hanya transaksi dengan prefix 'PKKMU-' agar transaksi warung Pempek Asli Wong Kito diabaikan
    if (!orderId || !orderId.startsWith("PKKMU-")) {
      console.log(`ℹ️ Abaikan transaksi non-PKKMU (Pempek Store): ${orderId}`);
      return res.status(200).json({ status: "IGNORED", message: "Not a PKKMU transaction" });
    }

    if (
      (transactionStatus === "settlement" || transactionStatus === "capture") &&
      (fraudStatus === "accept" || !fraudStatus)
    ) {
      console.log(`✅ Pembayaran QRIS LUNAS untuk Order ID: ${orderId}`);
      const orderData = ordersStore[orderId];

      if (orderData && isWaReady) {
        const formattedNumber = formatWaNumber(orderData.whatsapp);
        const productListText = Array.isArray(orderData.products)
          ? orderData.products.join(", ")
          : orderData.products;

        const successMsg = `🎉 *PEMBAYARAN QRIS BERHASIL (LUNAS)*

Halo kak *${orderData.name}*, terima kasih! Pembayaran untuk pesanan atribut ospek kamu telah *KAMI TERIMA*!

📋 *Detail Transaksi Lunas:*
• Order ID: *${orderId}*
• Total Pembayaran: *Rp ${Number(orderData.total || 0).toLocaleString("id-ID")}* (LUNAS via QRIS Midtrans)
• Atribut: *${productListText || "-"}*

📲 *LANGKAH WAJIB SELANJUTNYA:*
Silakan langsung bergabung ke grup WhatsApp resmi peserta PKKBN UPNVYK melalui link berikut:
${WA_GROUP_LINK}

_Terima kasih! Sampai jumpa di lokasi pengambilan atribut & PKKBN 2026!_`;

        await waClient.sendMessage(formattedNumber, successMsg);
        console.log(`📩 Notifikasi PEMBAYARAN LUNAS terkirim via WA ke: ${formattedNumber}`);

        // Edit pesan koordinasi sebelumnya menjadi SUDAH BAYAR
        if (orderData.coordMessage && orderData.coordMessage.edit) {
          try {
            const coordPaidText = buildCoordOrderText(orderData, true);
            await orderData.coordMessage.edit(coordPaidText);
            console.log(`✏️ Pesan koordinasi di-edit menjadi SUDAH BAYAR untuk: ${orderId}`);
          } catch (editErr) {
            console.error("Gagal edit pesan koordinasi:", editErr);
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Node.js Backend & WA Bot berjalan di port: ${PORT}`);
});
