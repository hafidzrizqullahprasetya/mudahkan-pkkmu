// services/settings.js — pengaturan bot (SQLite local DB / JSON fallback)
import fs from "fs";
import path from "path";
import { state } from "../state.js";
import { DEFAULT_PIN } from "../config.js";

export const SETTINGS_DB = path.resolve("./.wwebjs_auth/settings.db");
const LEGACY_SETTINGS = path.resolve("./settings.json");

// Inisialisasi SQLite (state.db). Gagal → fallback JSON (state.db = null).
export async function initDb() {
  console.log("📍 [STEP 1] Loading SQLite database...");
  try {
    const dir = path.dirname(SETTINGS_DB);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const Database = (await import("better-sqlite3")).default;
    state.db = new Database(SETTINGS_DB);
    state.db.pragma("journal_mode = WAL");
    console.log("💾 [STEP 1 OK] SQLite database terhubung (WAL mode).");
  } catch (e) {
    console.error("⚠️ [STEP 1 FALLBACK] SQLite tidak dapat dimuat, fallback ke settings.json:", e && e.message);
    state.db = null;
  }
}

export function loadSettings() {
  try {
    if (!state.db) {
      if (fs.existsSync(LEGACY_SETTINGS)) {
        state.settings = { ...state.settings, ...JSON.parse(fs.readFileSync(LEGACY_SETTINGS, "utf8")) };
      }
      return;
    }
    state.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        mode TEXT NOT NULL DEFAULT 'production',
        coordWa TEXT NOT NULL DEFAULT '',
        coordType TEXT NOT NULL DEFAULT 'wa',
        pin TEXT NOT NULL
      );
    `);
    const row = state.db.prepare("SELECT mode, coordWa, coordType, pin FROM settings WHERE id = 1").get();
    if (row) {
      state.settings = {
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

export function saveSettings() {
  try {
    if (!state.db) {
      fs.writeFileSync(LEGACY_SETTINGS, JSON.stringify(state.settings, null, 2));
      return;
    }
    state.db.prepare(`
      INSERT INTO settings (id, mode, coordWa, coordType, pin)
      VALUES (1, @mode, @coordWa, @coordType, @pin)
      ON CONFLICT(id) DO UPDATE SET
        mode = excluded.mode,
        coordWa = excluded.coordWa,
        coordType = excluded.coordType,
        pin = excluded.pin
    `).run(state.settings);
  } catch (e) {
    console.error("Gagal menyimpan SQLite settings:", e);
  }
}
