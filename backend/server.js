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
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Cleanup stale Chrome session lock if left over
const lockPath = path.resolve("./.wwebjs_auth/session/SingletonLock");
if (fs.existsSync(lockPath)) {
  try {
    fs.unlinkSync(lockPath);
  } catch (e) {}
}

// Initialize WhatsApp Web Client with LocalAuth for session persistence
const waClient = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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
  waClient.initialize();
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
    whatsapp_ready: isWaReady,
    timestamp: new Date().toISOString(),
  });
});

// Endpoint untuk mengirim notifikasi pesanan ke WhatsApp
app.post("/api/send-order-notif", async (req, res) => {
  try {
    const { name, nim, prodi, faculty, whatsapp, products, total, orderId } = req.body;

    if (!whatsapp) {
      return res.status(400).json({ error: "Nomor WhatsApp wajib diisi." });
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
https://chat.whatsapp.com/MudahkanPKKMUDemo

_Pesan ini dikirim otomatis oleh bot Mudahkan PKKMU!_`;

    if (isWaReady) {
      await waClient.sendMessage(formattedNumber, messageText);
      console.log(`📩 Notifikasi WA terkirim ke: ${formattedNumber}`);
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

// Endpoint Webhook Midtrans (Status Pembayaran)
app.post("/api/midtrans-webhook", async (req, res) => {
  try {
    const notification = req.body;
    console.log("🔔 Midtrans Webhook Event Received:", notification.order_id, notification.transaction_status);

    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const grossAmount = notification.gross_amount;

    if (transactionStatus === "settlement" && isWaReady) {
      console.log(`✅ Pembayaran LUNAS untuk ${orderId}`);
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
