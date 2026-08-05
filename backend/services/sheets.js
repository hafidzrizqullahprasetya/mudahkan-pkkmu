// services/sheets.js — Google Apps Script integration
import { GOOGLE_SCRIPT_URL } from "../config.js";

export async function sendToGoogleSheets(data) {
  try {
    console.log(`📊 [Google Sheets] Mengirim data (${data.orderId || "unknown"})...`);
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
      redirect: "manual",
    });

    if (res.status === 302 || res.status === 301 || res.status === 200 || res.ok) {
      console.log(`📊 [Google Sheets OK] Data (${data.orderId}) berhasil diterima oleh Google Apps Script!`);
      return;
    }
    const text = await res.text().catch(() => "");
    console.log(`📊 [Google Sheets] Status: ${res.status}, Respon: ${text.slice(0, 150)}`);
  } catch (e) {
    console.error("❌ [Google Sheets FAIL] Error:", e && (e.message || e));
  }
}

