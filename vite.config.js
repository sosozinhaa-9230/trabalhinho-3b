import { defineConfig } from "vite";

export default defineConfig({
  server: {
    allowedHosts: [".trycloudflare.com"],
    fs: {
      deny: ["**/app.db", "**/app.py", "**/.venv/**", "**/.env*", "**/.git/**", "*.{crt,pem}"],
    },
    proxy: {
      "^/(register|login|logout|me|save)$": "http://127.0.0.1:5000",
    },
  },
});