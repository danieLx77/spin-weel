import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({ plugins: [solid(), tailwindcss()], server: { host: "127.0.0.1" }, preview: { host: "127.0.0.1" } });
