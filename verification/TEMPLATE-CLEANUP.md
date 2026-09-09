# 模板化后的项目清理

日期：2026-09-09。仅移除已弃用的构建副本、缓存、临时类型检查文件和本地部署日志。删除前逐项确认绝对路径在项目内，且没有目录链接。

| 路径 | 文件数 | 字节数 |
| --- | ---: | ---: |
| dist/archives | 40 | 32762 |
| dist/assets | 9 | 4130616 |
| dist/fonts | 6 | 19824326 |
| dist/licenses | 3 | 3233 |
| dist/favicon.svg | 1 | 296 |
| dist/index.html | 1 | 718 |
| node_modules/.vite | 36 | 6805422 |
| node_modules/.vite-temp | 0 | 0 |
| .generated/typecheck-isolated | 3 | 3696 |
| .wrangler/logs | 1 | 11718 |
| .wrangler/tmp | 0 | 0 |

合计清理 100 个文件，释放 30812787 字节（约 30.8 MB）。

保留共享源码、全部站点配置与 Markdown、IEKB 数据快照及导入报告、Blender 源文件、模型/字体与许可、历史实验归档、验收报告和截图。

dist/rhine、dist/rhine-audiology 和 dist/example-notes 是当前独立构建，予以保留。旧 dist 根目录的平铺输出已移除。三个本地开发服务所使用的 .generated/<site> 和 sites/<site>/generated 缓存保留，node_modules 依赖保留。

当前站点的构建命令与恢复方式见 docs/TEMPLATE.md。旧 dist 输出由当前 npm run build / npm run build:audiology 生成的独立站点输出取代；旧 Vite 缓存及临时检查副本无需恢复。清理不涉及 IEKB 源目录或线上 Cloudflare。

清理后检查：5173、5174、5175 三个预览首页均返回 HTTP 200；原站正文、案例站正文与专题数据可读取；当前三个独立构建入口均保留。
