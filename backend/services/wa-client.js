// services/wa-client.js — WhatsApp Web client lifecycle (LocalAuth, retry otomatis)
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import pkg from "whatsapp-web.js";
import { state } from "../state.js";

const { Client, LocalAuth } = pkg;

export function createWaClient() {
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
      state.latestQrImage = await QRCode.toDataURL(qr);
    } catch (err) {
      console.error("Gagal membuat data URL QR:", err);
    }
  });

  client.on("ready", () => {
    console.log("✅ WhatsApp Web Bot siap dan terhubung!");
    state.isWaReady = true;
    state.latestQrImage = "";
  });

  client.on("authenticated", () => {
    console.log("🔐 Autentikasi WhatsApp Berhasil.");
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ Gagal Autentikasi WhatsApp:", msg);
  });

  client.on("disconnected", (reason) => {
    console.log("⚠️ WhatsApp Terputus:", reason);
    state.isWaReady = false;
  });

  return client;
}

// initialize dengan retry otomatis — jangan biarkan crash mematikan proses
const MAX_INIT_RETRIES = 8;
export async function startWaClient() {
  for (let attempt = 1; attempt <= MAX_INIT_RETRIES; attempt++) {
    try {
      console.log(`🤖 [STEP 3] Inisialisasi WhatsApp Puppeteer (percobaan ${attempt})...`);
      await state.waClient.initialize();
      return; // sukses, selesai
    } catch (err) {
      console.error(`❌ Inisialisasi gagal (percobaan ${attempt}):`, err && err.message);
      if (attempt >= MAX_INIT_RETRIES) {
        console.error("⛔ Semua percobaan inisialisasi WhatsApp gagal. Tetap menjalankan server HTTP.");
        return;
      }
      try {
        await state.waClient.destroy();
      } catch (e) {}
      state.waClient = createWaClient();
      const delayMs = Math.min(10000, 3000 * attempt);
      console.log(`⏳ Coba lagi dalam ${delayMs / 1000} detik...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
