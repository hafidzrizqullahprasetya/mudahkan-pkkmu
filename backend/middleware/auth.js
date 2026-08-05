// middleware/auth.js — session token & rate limiter (tanpa dependency eksternal)
import crypto from "crypto";
import { state } from "../state.js";
import { SESSION_TTL, LOGIN_MAX, LOGIN_WINDOW } from "../config.js";

export function rateLimitLogin(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const rec = state.loginAttempts.get(ip);
  if (!rec || rec.resetAt <= now) {
    state.loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW });
    return next();
  }
  rec.count += 1;
  if (rec.count > LOGIN_MAX) {
    const minsLeft = Math.ceil((rec.resetAt - now) / 60000);
    return res.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${minsLeft} menit.` });
  }
  return next();
}

export function newToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function checkAuth(req) {
  // ponytail: PIN/token via header only — query string bocor di URL/logs, add when: butuh backward compat lama
  const pin = (req.headers && req.headers["x-auth-pin"]) || (req.body && req.body.pin);
  if (state.settings.pin && pin === state.settings.pin) return true;
  const token = (req.headers && req.headers["x-auth-token"]);
  if (token) {
    const exp = state.sessions.get(token);
    if (exp && exp > Date.now()) return true;
    state.sessions.delete(token);
  }
  return false;
}
