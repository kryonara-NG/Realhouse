import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Vite/esbuild cannot reliably lower modern JS constructs such as
  // for-of, destructuring, and async functions all the way to Chrome 49.
  // Use ES2017 as the compatibility floor so production builds succeed
  // while retaining broad support on modern Android browsers.
  build: {
    target: "es2017"
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000"
    }
  }
});
