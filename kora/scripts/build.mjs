import { build } from "esbuild";
import { writeFile, mkdir, copyFile } from "node:fs/promises";
const url = process.env.SUPABASE_URL || "",
  key = process.env.SUPABASE_PUBLISHABLE_KEY || "";
if (key && !key.startsWith("sb_publishable_"))
  throw new Error(
    "Use only a Supabase publishable key. Never use a secret/service-role key.",
  );
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))
  throw new Error("Expected your HTTPS Supabase project URL.");
if (Boolean(url) !== Boolean(key))
  throw new Error("Set both public Supabase configuration values.");
if (process.env.CF_PAGES === "1" && !url)
  throw new Error(
    "Cloudflare deployment requires Supabase configuration. Sample mode is for local preview only.",
  );
await writeFile(
  "dist/config.js",
  `window.KORA_CONFIG=${JSON.stringify({ url, key })};\n`,
);
await build({
  entryPoints: ["src/cloud.js"],
  bundle: true,
  format: "esm",
  outfile: "dist/cloud.js",
  minify: true,
});
await mkdir("dist/fonts", { recursive: true });
for (const font of ["dm-sans", "manrope"])
  await copyFile(
    `node_modules/@fontsource-variable/${font}/LICENSE`,
    `dist/fonts/${font}-LICENSE.txt`,
  );
for (const font of ["dm-sans", "manrope"])
  await copyFile(
    `node_modules/@fontsource-variable/${font}/files/${font}-latin-wght-normal.woff2`,
    `dist/fonts/${font}.woff2`,
  );
console.log(
  url
    ? "Built configured app. Verify database policies before deployment."
    : "Built local sample preview. No backend configured.",
);
