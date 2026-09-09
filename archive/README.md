# 历史实验归档

2026-09-09 整理工作目录。当前透明亚克力模型、首页与查看器 GPU 路径追踪、动效及界面源码继续保留在原目录。

## 磨砂材质与阴影盒实验

`frosted-shadow-experiment-2026-09-08.zip` 保存 2026-09-08 的旧实验，共 10 个文件。用户试用后要求外壳恢复透明亚克力，原来的盒体阴影近似已由真实三角形路径追踪替代，因此这些文件退出当前源码、运行资产和检查目录。

| 原目录 | 归档内容 |
| --- | --- |
| `art/` | `rhine-frosted.blend`、`make_frosted.py` |
| `public/assets/` | `archive-cassette-frosted.glb`、`frosted/normal.png`、`frosted/roughness.png` |
| `src/` | `ray-shadows.ts`、`shadow-bvh.ts` |
| `scripts/` | `check-shadows.mjs` |
| `verification/` | `shadow-check.html`、`shadow-check.ts` |

移除原位置文件前，逐项核对了 ZIP 内文件的长度与 SHA-256；清单见同名 `.manifest.json`。历史验证结果仍在 [FROSTED-SHADOWS.md](../verification/FROSTED-SHADOWS.md)。

需要恢复实验时，在项目根目录执行：

```powershell
Expand-Archive -LiteralPath .\archive\frosted-shadow-experiment-2026-09-08.zip -DestinationPath .
```

解压保留原目录结构，不使用 `-Force` 覆盖后来新增的同名文件。复现材质仍通过 `scripts/blender-mcp.py` 调用 Blender MCP；旧脚本中的 `ROOT` 固定为本项目路径，换位置运行时需先修改。恢复操作只还原实验文件，不会自动把生产场景改回磨砂版本。

## 保留与可再生成内容

- `art/` 中的现用 Blender 源文件、生成脚本和审阅图保留。
- `reference/` 对照工具及 `verification/` 历史记录保留；例如 `reference/baseline-motion.ts` 仍被当前动效检查使用。
- `node_modules/` 依赖和开发服务器正在使用的 `.generated/<site>/` 缓存保留，避免打断本地预览。模板化之前的 `node_modules/.vite/` 旧缓存已清理。
- Vite 文件监听忽略 `archive/`，避免 Windows 写入 ZIP 时的文件锁使开发服务退出。
- `public/archives/` 的 40 份原始文本作为模板回归检查基准保留；当前下载内容由 `sites/<site>/content/` 编译到各站独立输出。
- `dist/rhine/`、`dist/rhine-audiology/` 和 `dist/example-notes/` 是模板化后已验收的独立构建，保留用于生产预览；模板化之前位于 `dist/` 根目录的平铺产物已清理。

清理后 TypeScript 与生产构建、现用三角形光追快照检查通过。

后续模板化清理移除了旧构建副本、旧缓存、临时类型检查目录及本地部署日志，具体清单见 [TEMPLATE-CLEANUP.md](../verification/TEMPLATE-CLEANUP.md)。
