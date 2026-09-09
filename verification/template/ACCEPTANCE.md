# 模板化与 RHINE AUDIOLOGY 本地验收

验收日期：2026-09-09。范围是共享引擎、两个独立站点及第三站点创建示例；未执行线上发布。

## 可运行交付

| 站点 | 开发端口 | 独立生产输出 | 内容 |
| --- | --- | --- | --- |
| `rhine` | 5173 | `dist/rhine/` | 原始品牌、栏目顺序和 40 份档案 |
| `rhine-audiology` | 5174 | `dist/rhine-audiology/` | RHINE AUDIOLOGY，44 个英文专题 |
| `example-notes` | 5175 | `dist/example-notes/` | 创建命令生成的配置与 Markdown 示例 |

三个站点均通过 TypeScript 检查及 Vite 生产构建。构建不读取 IEKB 源目录。默认站构建没有 IEKB 数据目录或案例站目录内容。各站具有独立资源覆盖、缓存、输出和部署配置；新建站点没有继承 Cloudflare 账户。

## 结果与证据

| 验收项 | 实际检查 | 记录 |
| --- | --- | --- |
| 原站内容回归 | 40 份档案的标题、正文、研究记录、元数据、栏目顺序及全部导出文本与保存的原始基准一致 | `template-report.json`、`default-records.json` |
| 原有三维交互 | 8 组既有检查通过，覆盖阵列、升降、转正归位、材质连续性、拆解重组、UI 过渡、光追几何及深度精度；160 个参考位置与 288 个交互实例池保留 | `core-report.json` |
| 开场及鼠标交互 | 两站检查 9 个原片时间轴阶段、品牌文字与案例英文字幕；实际鼠标悬停抬升、选中卡片再点击打开、抽取/返回及方向键切档通过 | `boot-interaction-report.json` |
| 可变长度导航 | 234,000 次双向移动；每列 1/7/8/9/12/33 份、不同栏目数和不等长栏目；首尾、列记忆、坐标归零及任意默认档案映射正确 | `template-report.json` |
| 模板编辑 | 第三站点只用配置和 Markdown 创建、预览、构建；文件标题、正文、页签和品牌热更新；不会使原站重新加载 | `editing-report.json` |
| Markdown | GFM 表格、任务列表、脚注、图片、长代码及行内/块级公式；不安全 HTML 不执行；无效协议、资源、栏目、重复 ID/编号和损坏的文档/标题链接定位到源文件 | `template-report.json`、`reader-report.json` |
| 阅读和请求竞态 | 50 条分页；别名、PMID、机制/表达及细胞筛选；展开后方向键用于阅读；退出保留页签、基因、证据分区、滚动和焦点；旧响应不覆盖新档案；加载失败可重试 | `browser-report.json`、`reader-report.json` |
| 窄屏 | 390 × 844 的 Markdown 和案例阅读区没有整页或阅读面板横向溢出；宽内容局部滚动 | `browser-report.json`、`reader-report.json` |
| 生产资源和存储隔离 | 从 `dist/` 启动两个临时生产预览；首屏未请求正文或 IEKB 数据；只有原站迁移旧收藏/偏好，已迁移数据不会被旧值覆盖；案例站忽略旧值 | `production-report.json` |
| GPU 光追 | 开发版与生产版的两个首页均产生至少 4 个实际光追样本；设备为 NVIDIA GeForce RTX 5090 D v2，经 ANGLE / Direct3D 11 运行；检查中未发生页面运行或 HTTP 错误 | `pathtracing-report.json`、`production-report.json` |
| 重新导入 | 重新执行只读导入后，44 份已有专题 Markdown 字节不变；按 YAML 中的稳定 ID / dataKey 识别文件，允许独立重命名 | `reimport-report.json` |

导航的长时间循环由确定性算法检查覆盖；浏览器另外检查了实际单档案循环、选取/打开/返回、稳定详情链接及快速切档。GPU 结果来自本机，未把配置中的 enabled 值当作渲染完成证据。

## IEKB 快照逐项核对

| 内容 | 数量 |
| --- | ---: |
| 规范化专题 | 44 |
| 关联基因 | 3,444 |
| CSV 来源记录 | 7,376 |
| 其中表型记录 | 6,448 |
| 其中机制/表达记录 | 928 |
| 互作 | 4,073 |
| 其中未归入专题的互作 | 66 |
| 非预测来源声明 | 55,579 |
| 文献记录 | 15,963 |
| ClinGen 注释 / HHL 注释 | 190 / 223 |
| 已知网络源关系 / 聚合边 | 83,712 / 29,041 |

`data-report.json` 记录了与原始 CSV 及只读 SQLite 的字段级比较。保留原始表型、疾病、映射规则、稳定基因 ID、别名、否定/调控谓词及验证/人工审核状态。网络源关系和聚合边是两个来源层次，不计为新增表型关联或额外互作。全部 66 条未归类互作可通过总览的两页访问。

可独立运行的数据快照约 274 MB，分为按需请求的 JSON 文件，最大数据文件约 2.10 MB；没有将完整 SQLite 发给浏览器。首屏只载入轻量目录。搜索索引首次检索时加载，正文、统计、基因明细、来源和文献按需读取。

来源署名、数据许可及来源链接随快照保留，见 `sites/rhine-audiology/import-report.json` 和 `sites/rhine-audiology/data/LICENSE.txt`。外部链接检查覆盖语法和来源值保真，不声称所有远端页面永远可用。

## 截图与复核入口

- `rhine-production-archive.png`、`rhine-audiology-production-archive.png`：最终生产首页。
- `5173-settled-detail.png`、`5174-settled-detail.png`：模型与正文布局。
- `audiology-expanded.png`、`audiology-narrow.png`：宽阅读区与窄屏。
- `markdown-narrow.png`：第三站点 Markdown 阅读。

编辑命令、内容接口、部署选择和复核命令见 `docs/TEMPLATE.md`；AI 编辑边界见 `docs/AI-EDITING.md`。现有 Cloudflare 发布未更新。
