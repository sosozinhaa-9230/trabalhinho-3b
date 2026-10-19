import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "^/(register|login|logout|me|save)$": "http://127.0.0.1:5000",
    },
  },
});