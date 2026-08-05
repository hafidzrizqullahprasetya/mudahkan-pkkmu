// state.js — shared mutable state (single source of truth untuk semua modul)
import { DEFAULT_PIN } from "./config.js";

export const state = {
  db: null,
  ordersStore: {},
  settings: {
    mode: "production", // "production" | "testing"
    coordWa: "",        // Nomor WA koordinator (khusus koordinasi)
    coordType: "wa",    // "wa" (nomor) | "group" (nama grup WhatsApp)
    pin: DEFAULT_PIN,
  },
  waClient: null,
  isWaReady: false,
  latestQrImage: "",
  sseClients: {},
  sessions: new Map(),      // token -> expiry ts
  loginAttempts: new Map(), // ip -> { count, resetAt }
};
