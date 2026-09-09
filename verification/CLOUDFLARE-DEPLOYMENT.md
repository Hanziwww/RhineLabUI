# Cloudflare 部署记录

- 日期：2026-09-09（Asia/Taipei）。
- 地址：https://rhine-lab-analysis-os.marspenman.workers.dev/
- 服务：Cloudflare Workers Static Assets，项目 `rhine-lab-analysis-os`。
- Wrangler：4.129.1，已固定在 `package.json` 和锁文件中。
- 发布版本：`3bcd5bc0-a28a-4ef2-af15-7253071dcc36`。
- 上传内容：`dist/` 下的 60 个网站文件；发布前同名 Worker 不存在。

TypeScript、Vite 生产构建及 Wrangler dry run 通过。发布后直接请求公网地址，首页返回 200，标题和入口文件 `index-FayIjXKZ.js` 与本地构建一致。档案页、主 JS/CSS、两个 GLB 模型、BVH Worker、光追模块、MiSans 字体和档案文本均返回 200，Content-Type 正确。

本次线上验证覆盖 HTTP 页面和资源可用性；未重新进行线上浏览器的完整 GPU 画面与交互测试。

后续更新执行 `npm run deploy`，该命令先构建再上传。配置见 `wrangler.jsonc`，登录凭据由 Wrangler 在项目外管理。
