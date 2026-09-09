import { defineConfig } from "vite";
import path from "node:path";
import { buildContent, root, sitePath, json, esc } from "./scripts/content.mjs";
const id = process.env.RHINE_SITE ?? "rhine";
const dir = sitePath(id);
const config = await json(path.join(dir, "site.json"));
export default defineConfig({
  cacheDir: path.join(root, ".generated", id, "vite-cache"),
  publicDir: path.join(root, ".generated", id, "public"),
  build: { outDir: path.join(root, "dist", id), emptyOutDir: true },
  resolve: {
    alias: [
      {
        find: "../sites/rhine/generated/catalog.json",
        replacement: path.join(dir, "generated/catalog.json"),
      },
    ],
  },
  optimizeDeps: { exclude: ["three-mesh-bvh/worker"] },
  server: {
    host: "127.0.0.1",
    port: config.port,
    strictPort: true,
    watch: {
      ignored: [
        "**/archive/**",
        "**/sites/*/data/**",
        "**/sites/*/generated/**",
        "**/.generated/**",
        "**/dist/**",
      ],
    },
  },
  plugins: [
    {
      name: "rhine-site-content",
      transformIndexHtml(html) {
        return html
          .replace('lang="zh-CN"', `lang="${esc(config.locale)}"`)
          .replace(/<title>.*?<\/title>/, `<title>${esc(config.title)}</title>`)
          .replace(
            /content="Rhine Lab[^"\n]*"/,
            `content="${esc(config.description)}"`,
          );
      },
      configureServer(server) {
        let timer;
        let running = false;
        let pending = false;
        let refreshAssets = false;
        server.watcher.add([
          path.join(dir, "content"),
          path.join(dir, "site.json"),
          path.join(dir, "public"),
        ]);
        const rebuild = async () => {
          if (running) {
            pending = true;
            return;
          }
          running = true;
          const assets = refreshAssets;
          refreshAssets = false;
          try {
            await buildContent(id, { refreshAssets: assets });
            server.moduleGraph.invalidateAll();
            server.ws.send({ type: "full-reload" });
          } catch (e) {
            server.ws.send({
              type: "error",
              err: { message: e.message, stack: "", plugin: "rhine-content" },
            });
          } finally {
            running = false;
            if (pending) {
              pending = false;
              void rebuild();
            }
          }
        };
        server.watcher.on("all", (_event, file) => {
          const changed = path.resolve(file);
          if (
            changed.startsWith(path.join(dir, "content") + path.sep) ||
            changed === path.join(dir, "site.json") ||
            changed.startsWith(path.join(dir, "public") + path.sep)
          ) {
            refreshAssets ||=
              changed === path.join(dir, "site.json") ||
              changed.startsWith(path.join(dir, "public") + path.sep);
            clearTimeout(timer);
            timer = setTimeout(rebuild, 180);
          }
        });
      },
    },
  ],
});
