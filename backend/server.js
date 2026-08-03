import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import qrcode from "qrcode-terminal";
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

let isWaReady = false;

waClient.on("qr", (qr) => {
  console.log("\n==========================================");
  console.log("SCAN QR CODE DENGAN WHATSAPP UNTUK LOGIN:");
  console.log("==========================================\n");
  qrcode.generate(qr, { small: true });
});

waClient.on("ready", () => {
  console.log("✅ WhatsApp Web Bot siap dan terhubung!");
  isWaReady = true;
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

// Endpoint status server
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "mudahkan-pkkmu-backend",
    whatsapp_ready: isWaReady,
    timestamp: new Date().toISOString(),
  });
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
      }
    }

    res.status(200).json({ status: "OK" });
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).json({ error: err.toString() });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Node.js Backend & WA Bot berjalan di port: ${PORT}`);
});
