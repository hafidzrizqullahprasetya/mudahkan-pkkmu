// config.js — shared backend constants & env-derived config
import dotenv from "dotenv";
dotenv.config();

export const PORT = process.env.PORT || 5760;
export const WA_GROUP_LINK = "https://chat.whatsapp.com/IARvfdegaWUEUwiJ42roiN?s=cl&p=i&ilr=2";
// Backend v1.0.11 - Google Apps Script v10 Leading Zero WA Fixed
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw50zEWkCzBo4qf-8h3mdgddkqF5wAgrN5V17IaEdVyI47yrWWxyIXTCKf5UVHDzCU5Qg/exec";

export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://mudahkan-pkkmu.vercel.app,http://localhost:5173,http://localhost:4173").split(",").map((s) => s.trim()).filter(Boolean);

export const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
export const DEFAULT_PIN = process.env.SETTINGS_PIN || "pkkmu2026";

export const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 jam
export const LOGIN_MAX = 5;
export const LOGIN_WINDOW = 15 * 60 * 1000;
export const MAX_INIT_RETRIES = 8;
