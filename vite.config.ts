import { pwaPlugin } from "./pwa-plugin.mjs";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { contentSecurityPolicy, securityHeaders } from "./security-policy.mjs";
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [
    solid(),
    tailwindcss(),
    pwaPlugin(process.env.BASE_PATH || "/"),
    {
      name: "production-security",
      apply: "build",
      transformIndexHtml() {
        return [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content: contentSecurityPolicy,
            },
            injectTo: "head-prepend" as const,
          },
        ];
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "_headers",
          source:
            "/*\n" +
            Object.entries(securityHeaders)
              .map(([name, value]) => `  ${name}: ${value}`)
              .join("\n") +
            "\n",
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    fs: {
      strict: true,
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "**/.git/**",
        "**/.aws/**",
        "**/.codex/**",
        "**/.agents/**",
      ],
    },
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  },
  preview: { host: "127.0.0.1", headers: securityHeaders },
});
