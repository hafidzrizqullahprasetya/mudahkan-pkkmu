export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://notif-pkk.pempekasliwongkito.my.id";

export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

