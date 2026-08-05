// Auto-deploy trigger for Backend server - 2026-08-03
console.log("🚀 Initializing Mudahkan PKKmu Backend...");
import express from "express";
import cors from "cors";
import helmet from "helmet";
import crypto from "crypto";

import fs from "fs";
import path from "path";

import { PORT, WA_GROUP_LINK, ALLOWED_ORIGINS, MIDTRANS_SERVER_KEY, SESSION_TTL } from "./config.js";
import { state } from "./state.js";
import { initOrdersTable, saveOrder, getOrder, updateOrderStatus } from "./db/orders.js";
import { initDb, loadSettings, saveSettings, SETTINGS_DB } from "./services/settings.js";
import { formatWaNumber, resolveCoordTarget, fetchChatsFromStore } from "./services/whatsapp.js";
import { computeTotal } from "./services/midtrans.js";
import { sendToGoogleSheets } from "./services/sheets.js";
import { createWaClient, startWaClient } from "./services/wa-client.js";
import { rateLimitLogin, newToken, checkAuth } from "./middleware/auth.js";
import { notifyPaymentSuccessSSE } from "./services/sse.js";

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
// ===== Bootstrap: SQLite + settings =====
await initDb();
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

// WhatsApp client (LocalAuth); delay 2s so HTTP opens first
console.log("📍 [STEP 2] Creating WhatsApp Client instance...");
state.waClient = createWaClient();
setTimeout(() => {
  startWaClient();
}, 2000);

// Halaman Web /qr untuk scan QR Code di browser dengan gambar HD bersih
function qrPageShell(title, contentHtml) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#174b36" />
  ${!state.isWaReady ? '<meta http-equiv="refresh" content="4" />' : ""}
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
  if (state.isWaReady) {
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

  if (state.latestQrImage) {
    return res.send(qrPageShell("Scan WhatsApp QR", `
      <div class="card">
        <h2>Scan QR Code</h2>
        <p>Buka WhatsApp di HP → <strong>Perangkat Tertaut</strong> → <strong>Tautkan Perangkat</strong> → scan QR di bawah ini.</p>
        <img class="qr" src="${state.latestQrImage}" alt="QR Code WhatsApp" />
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
    whatsapp_ready: state.isWaReady,
    mode: state.settings.mode,
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

// Buat session token (untuk persist login)
app.post("/api/auth", rateLimitLogin, (req, res) => {
  const { pin } = req.body || {};
  if (!state.settings.pin || pin !== state.settings.pin) {
    return res.status(401).json({ error: "PIN salah." });
  }
  const token = newToken();
  state.sessions.set(token, Date.now() + SESSION_TTL);
  res.json({ status: "success", token });
});

// Ambil pengaturan (tanpa auth hanya kembalikan mode)
app.get("/api/settings", (req, res) => {
  const isAuth = checkAuth(req);
  res.json({
    mode: state.settings.mode,
    coordWa: isAuth ? state.settings.coordWa : "",
    coordType: isAuth ? state.settings.coordType : "",
    locked: !isAuth,
    whatsapp_ready: state.isWaReady,
  });
});

// Simpan pengaturan (wajib auth)
app.post("/api/settings", (req, res) => {
  const { mode, coordWa, coordType, newPin } = req.body || {};

  if (!checkAuth(req)) {
    return res.status(401).json({ error: "PIN salah." });
  }

  if (mode === "production" || mode === "testing") {
    state.settings.mode = mode;
  }
  if (typeof coordWa === "string") {
    state.settings.coordWa = coordWa.trim();
  }
  if (coordType === "wa" || coordType === "group") {
    state.settings.coordType = coordType;
  }
  if (newPin && newPin.trim().length >= 4) {
    state.settings.pin = newPin.trim();
  }

  saveSettings();
  res.json({
    status: "success",
    mode: state.settings.mode,
    coordWa: state.settings.coordWa,
    coordType: state.settings.coordType,
    whatsapp_ready: state.isWaReady,
  });
});

app.get("/api/chats", async (req, res) => {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: "Silakan login dengan PIN terlebih dahulu." });
  }
  if (!state.isWaReady) {
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
    const chargeAmount = state.settings.mode === "testing" ? 1 : computedTotal;

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

  if (!state.sseClients[orderId]) {
    state.sseClients[orderId] = [];
  }
  state.sseClients[orderId].push(res);

  // ponytail: heartbeat tiap 15s cegah proxy/LB cut idle SSE — add when: polling-based push (WebSocket)
  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat\n\n`); } catch (e) {}
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    if (state.sseClients[orderId]) {
      state.sseClients[orderId] = state.sseClients[orderId].filter((client) => client !== res);
    }
  });
});

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

      if (state.isWaReady) {
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

          await state.waClient.sendMessage(formattedNumber, successMsg);
          console.log(`📩 Notifikasi PEMBAYARAN LUNAS terkirim via WA ke pembeli: ${formattedNumber}`);
        }

        // 2. PESAN KOORDINASI HANYA KETIKA PEMBAYARAN LUNAS KE GRUP 2FOUNDERS / ADMIN
        if (state.settings.coordWa) {
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

              await state.waClient.sendMessage(coordTarget, paidCoordText);
              console.log(`🤝 Pesan koordinasi pesanan LUNAS terkirim ke grup: ${state.settings.coordWa} (${coordTarget})`);
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
