import { english, site } from "./site.ts";
// Literal UI copy only. Markdown and source evidence are never translated here.
const en: Record<string, string> = {
  返回档案: "Return to archive",
  档案模型: "Archive model",
  模型装配结构: "Model assembly",
  装配结构: "Assembly",
  "正在载入模型…": "Loading model…",
  "重新载入 ↗": "Reload ↗",
  拖动旋转: "Drag to rotate",
  平移: "Pan",
  滚轮缩放: "Scroll to zoom",
  拆解档案: "Explode archive",
  一键重组: "Reassemble",
  复位视角: "Reset view",
  已组装: "Assembled",
  "模型载入失败，请重试": "The model could not be loaded. Please retry.",
  正在拆解: "Exploding",
  正在重组: "Reassembling",
  "准备光追…": "Preparing path tracing…",
  "光追未就绪 · 可重试": "Path tracing is unavailable · Retry",
  已拆解: "Exploded",
  交互预览: "Interactive preview",
  "光追细化中…": "Refining path tracing…",
  精细光追: "Path tracing",
  "档案三维模型：拖动旋转，方向键平移，滚轮或加减键缩放，Home 复位":
    "3D archive model: drag to rotate, arrow keys to pan, scroll or plus/minus to zoom, Home to reset",
  系统导航: "System navigation",
  搜索档案: "Search archives",
  查看收藏档案: "View saved archives",
  收藏档案: "Saved archives",
  系统设置: "System settings",
  系统启动: "System startup",
  档案选择: "Archive selection",
  上一个档案: "Previous archive",
  下一个档案: "Next archive",
  上一列: "Previous column",
  下一列: "Next column",
  切换列: "Switch columns",
  前后档案: "Browse archives",
  读取: "Read",
  档案内容: "Archive content",
  重播启动流程: "Replay startup",
  选择档案: "Select archive",
  全部档案: "All archives",
  档案已加入收藏: "Archive saved",
  已取消收藏: "Archive removed from saved",
  关闭窗口: "Close dialog",
  档案检索: "Archive search",
  内部档案检索: "Internal archive directory",
  "输入档案编号、名称或科室": "Search topics, genes, aliases, disease or PMID",
  检索档案: "Search archives",
  "FILE / 档案": "FILE / ARCHIVE",
  "DEPARTMENT / 科室": "COLLECTION",
  尚无收藏档案: "No saved archives yet",
  没有匹配的档案: "No matching archives",
  "读取档案时，选择 SAVE ARCHIVE 将其保存在此处。":
    "Use SAVE ARCHIVE while reading to keep an archive here.",
  "尝试其他名称、档案编号，或切换科室分类。":
    "Try another name, gene alias, PMID or collection.",
  "查看全部档案 →": "View all archives →",
  "重置检索 →": "Reset search →",
  终端偏好设置: "Terminal preferences",
  界面反馈音: "Interface feedback sounds",
  减少镜头移动和过渡动效: "Reduce camera movement and transitions",
  "精细网格阴影、环境遮蔽与高分辨率渲染":
    "Detailed shadows, ambient occlusion and high resolution rendering",
  切列: "Columns",
  选档: "Archives",
  检索: "Search",
  返回: "Back",
  "使用 MiSans 字体（小米）": "MiSans typeface by Xiaomi",
  字体许可: "Font license",
  "请使用浏览器的全屏快捷键 F11": "Use the browser fullscreen shortcut F11.",
  "三维档案资源未能载入。请确认浏览器已启用硬件加速，然后重新连接。":
    "The 3D archive could not be loaded. Enable browser hardware acceleration and reconnect.",
};
export function message(value: string) {
  if (site.labels[value] !== undefined) return site.labels[value];
  if (site.labels[value.trim()] !== undefined)
    return value.replace(value.trim(), site.labels[value.trim()]);
  if (!english) return value;
  for (const [from, to] of Object.entries(en).sort(
    (a, b) => b[0].length - a[0].length,
  ))
    value = value.replaceAll(from, to);
  return value;
}
export function localizeUi(root: HTMLElement) {
  if (!english && !Object.keys(site.labels).length) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode())
    walker.currentNode.textContent = message(
      walker.currentNode.textContent ?? "",
    );
  for (const element of [root, ...root.querySelectorAll<HTMLElement>("*")])
    for (const attr of ["aria-label", "title", "placeholder"]) {
      if (element.hasAttribute(attr))
        element.setAttribute(attr, message(element.getAttribute(attr)!));
    }
}
