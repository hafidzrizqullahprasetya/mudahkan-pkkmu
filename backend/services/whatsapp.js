// services/whatsapp.js — WA phone formatting & target resolution
import { state } from "../state.js";

// Format Phone Number to WhatsApp ID (628xxx@c.us)
export function formatWaNumber(phone) {
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
export async function resolveCoordTarget() {
  if (!state.settings.coordWa || !state.isWaReady) return null;

  const targetStr = state.settings.coordWa.trim();
  if (targetStr.endsWith("@g.us") || targetStr.endsWith("@c.us")) {
    return targetStr;
  }

  const isDigitsOnly = /^\+?\d+$/.test(targetStr);
  const nameClean = targetStr.toLowerCase().replace(/[^a-z0-9]/g, "");

  try {
    let chats = await state.waClient.getChats().catch(() => []);
    console.log(`🔍 [DEBUG resolveCoordTarget] Target: "${targetStr}", Total getChats: ${chats.length}`);
    for (const chat of chats) {
      if (!chat || !chat.id) continue;
      const chatId = String(chat.id._serialized || chat.id);
      const rawName = String(chat.name || chat.formattedTitle || chat.title || "");
      const chatNameClean = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (rawName && (chatNameClean.includes(nameClean) || nameClean.includes(chatNameClean))) {
        console.log(`🎯 [resolveCoordTarget OK] Match "${rawName}" -> JID: ${chatId}`);
        if (chatId.includes("@")) return chatId;
      }
    }

    const storeChats = await fetchChatsFromStore();
    console.log(`🔍 [DEBUG resolveCoordTarget] Target: "${targetStr}", Total storeChats: ${storeChats.length}`);
    for (const chat of storeChats) {
      const chatId = String(chat.id || "");
      const rawName = String(chat.name || "");
      const chatNameClean = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (rawName && (chatNameClean.includes(nameClean) || nameClean.includes(chatNameClean))) {
        console.log(`🎯 [resolveCoordTarget Store OK] Match "${rawName}" -> JID: ${chatId}`);
        if (chatId.includes("@")) return chatId;
      }
    }
  } catch (e) {
    console.error("Error resolveCoordTarget group search:", e);
  }

  if (isDigitsOnly) {
    return formatWaNumber(targetStr);
  }
  return null;
}

// Daftar chat yang ada di bot WhatsApp (untuk memilih tujuan koordinasi) — wajib PIN
export async function fetchChatsFromStore() {
  if (!state.isWaReady || !state.waClient) return [];

  // Strategi 1: Official whatsapp-web.js getChats()
  try {
    const chats = await state.waClient.getChats();
    if (Array.isArray(chats) && chats.length > 0) {
      const out = [];
      const seen = new Set();
      for (const c of chats) {
        if (!c || !c.id) continue;
        const jid = c.id._serialized || (typeof c.id === "string" ? c.id : (c.id.user ? c.id.user + (c.isGroup ? "@g.us" : "@c.us") : ""));
        if (!jid || !jid.includes("@")) continue;

        const rawName = c.name || c.formattedTitle || c.title || c.id.user || "";
        const name = String(rawName || jid).trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);

        const isGroup = Boolean(c.isGroup || jid.endsWith("@g.us"));
        out.push({
          type: isGroup ? "group" : "wa",
          name: name,
          phone: jid.replace(/@.*$/, ""),
          id: jid,
        });
      }

      if (out.length > 0) {
        console.log(`✅ [fetchChatsFromStore OK] getChats() returned ${out.length} chats with valid JIDs!`);
        return out.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      }
    }
  } catch (err) {}

  // Strategi 2: Deep React Fiber & Store Traversal (100% Reliable & Presisi JID @g.us)
  try {
    if (!state.waClient.pupPage) return [];
    const directChats = await state.waClient.pupPage.evaluate(() => {
      const list = [];
      const seen = new Set();

      // Check window.Store / Webpack Collections
      try {
        let models = [];
        if (window.Store && window.Store.Chat) {
          models = window.Store.Chat.models || window.Store.Chat._models || [];
        }
        if ((!models || models.length === 0) && window.require) {
          try {
            const chatColl = window.require('WAWebChatCollection');
            if (chatColl && chatColl.ChatCollection) {
              models = chatColl.ChatCollection.getModelsArray() || [];
            }
          } catch (e) {}
        }

        for (const m of models) {
          if (!m || !m.id) continue;
          const jid = m.id._serialized || String(m.id);
          const name = m.name || m.formattedTitle || m.title || m.contact?.name || "";
          if (name && jid && jid.includes("@") && !seen.has(name)) {
            seen.add(name);
            const isGroup = Boolean(m.isGroup || jid.endsWith("@g.us"));
            list.push({
              type: isGroup ? "group" : "wa",
              name: String(name),
              phone: jid.replace(/@.*$/, ""),
              id: jid,
            });
          }
        }
      } catch (e) {}

      // Deep React Fiber Search on #pane-side chat rows
      try {
        const rows = Array.from(document.querySelectorAll('#pane-side div[role="row"], #pane-side [data-testid="chat-list"] > div'));
        for (const row of rows) {
          let name = "";
          let jid = "";
          const titleEl = row.querySelector('span[title]');
          if (titleEl) name = (titleEl.getAttribute('title') || titleEl.textContent || "").trim();

          const stack = [];
          for (const k in row) {
            if (k.startsWith('__reactFiber') || k.startsWith('__reactProps')) {
              stack.push({ node: row[k], depth: 0 });
            }
          }

          while (stack.length > 0) {
            const { node, depth } = stack.pop();
            if (!node || depth > 15 || jid) continue;

            const p = node.memoizedProps;
            if (p) {
              if (p.chat && p.chat.id) {
                jid = p.chat.id._serialized || String(p.chat.id);
                if (!name && p.chat.name) name = p.chat.name;
              } else if (p.id && typeof p.id === "string" && p.id.includes("@")) {
                jid = p.id;
              } else if (p.jid && typeof p.jid === "string" && p.jid.includes("@")) {
                jid = p.jid;
              }
            }

            if (node.child) stack.push({ node: node.child, depth: depth + 1 });
            if (node.sibling) stack.push({ node: node.sibling, depth: depth + 1 });
            if (node.return && depth < 3) stack.push({ node: node.return, depth: depth + 1 });
          }

          if (name && jid && jid.includes("@") && !seen.has(name)) {
            seen.add(name);
            const isGroup = Boolean(jid.endsWith("@g.us"));
            list.push({
              type: isGroup ? "group" : "wa",
              name: name,
              phone: jid.replace(/@.*$/, ""),
              id: jid,
            });
          }
        }
      } catch (e) {}

      return list;
    });

    if (Array.isArray(directChats) && directChats.length > 0) {
      console.log(`✅ [DOM Traversal OK] Found ${directChats.length} chats with valid JIDs!`);
      return directChats.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
  } catch (err) {}

  return [];
}
