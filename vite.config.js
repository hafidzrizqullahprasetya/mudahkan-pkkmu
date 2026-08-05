import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ponytail: minimal config — add define/alias when env vars or deep imports appear
export default defineConfig({
  plugins: [react()],
});
