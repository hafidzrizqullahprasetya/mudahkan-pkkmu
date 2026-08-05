export const QRIS_STATIC_TEMPLATE = "00020101021226680016ID.CO.MIDTRANS.WWW0118936000140000017857520215G5015737555303360540";

export function crc16ccitt(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildQrisFallback(amount) {
  const amtStr = String(amount);
  const payload = QRIS_STATIC_TEMPLATE + `${amtStr.length}${amtStr}` + "5802ID";
  const crc = crc16ccitt(payload + "6304");
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${payload}6304${crc}`;
}

