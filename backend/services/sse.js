// services/sse.js — Server-Sent Events push untuk notifikasi pembayaran real-time
import { state } from "../state.js";

export function notifyPaymentSuccessSSE(orderId) {
  const clients = state.sseClients[orderId];
  if (clients && clients.length > 0) {
    console.log(`⚡ [SSE Real-Time Push OK] Notifying ${clients.length} frontend browser client(s) for Order: ${orderId}`);
    const payload = `data: ${JSON.stringify({ paid: true, status: "PAID" })}\n\n`;
    clients.forEach((client) => {
      try {
        client.write(payload);
      } catch (e) {}
    });
  }
}
