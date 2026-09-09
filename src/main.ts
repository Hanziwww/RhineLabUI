import "katex/dist/katex.min.css";
import {
  site,
  english,
  text as uiText,
  escapeHtml as h,
  displayCode,
  storageKey,
  migrateDefaultStorage,
} from "./site";
import { localizeUi, message } from "./ui-language";
import { ArchiveReader } from "./archive-reader";
import { contentProvider, knowledgeSearch } from "./content-provider";
import "@kitlangton/rolling-number/styles.css";
import "./style.css";
import "./responsive.css";
import "./archive-ui-motion.css";
import "./content.css";
import { createRollingNumber } from "@kitlangton/rolling-number";
import { ArchiveScene } from "./scene";
import { ModelViewer } from "./model-viewer";
import { ScrubTitle } from "./scrub-title";
import { ArchiveUiMotion } from "./archive-ui-motion";
import { archiveLayout } from "./archive-layout";
import { BootSequence } from "./boot";
import { wrap, type ArchiveNavigation } from "./archive-loop";
import {
  records,
  categories,
  archiveColumns,
  columnFiles,
  fileLocation,
} from "./data";
import { TerminalAudio } from "./audio";

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
import { logo } from "./brand";

$("#stage").innerHTML = `
  <div id="three-scene" class="three-scene"></div>
  <div class="scene-atmosphere"></div>
  <div class="reading-atmosphere" aria-hidden="true"></div>
  <div id="boot-background" class="boot-background"><svg viewBox="0 0 1920 1080" preserveAspectRatio="none"><g fill="none" stroke="#fff" stroke-width="3"><path d="M-210 705C-45 705 182 704 247 567C337 377 99 306 4 435S27 680 169 631C309 584 227 314 279 111S568-113 568-113"/><path d="M1560-80C1374 114 1671 168 1601 323S1371 367 1431 480S1692 666 1559 787S1329 886 1498 1130"/><circle cx="1450" cy="648" r="346"/><circle cx="1450" cy="648" r="348"/></g></svg></div>
  <header class="brand"><h1>${h(site.brand.name)}</h1><div>${h(site.brand.subtitle)}</div><p>${h(site.brand.system)} <b>${h(site.brand.systemAccent)}</b></p></header>
  <nav class="system-nav" aria-label="系统导航">
    <button data-action="search" aria-label="搜索档案"><span class="nav-glyph">⌕</span> ARCHIVE INDEX <span class="key">/</span></button>
    <button data-action="saved" aria-label="查看收藏档案" title="收藏档案">＋ SAVED <span id="saved-count">00</span></button>
    <button data-action="settings" aria-label="系统设置" title="系统设置"><span class="settings-glyph">◷</span></button>
  </nav>
  <button id="skip" class="skip" data-action="skip">ENTER SYSTEM <span>↗</span></button>
  <section id="boot" class="boot" aria-label="系统启动">
    <div class="access-text">ACCESS</div>
    <div class="boot-logo">${logo}</div>
    <div class="auth-status"><span>▪</span> <span id="auth-message"></span><i></i></div>
    <div class="scan"><svg viewBox="0 0 1920 1080" aria-hidden="true"><g fill="none" stroke="#080a08" stroke-width="2" stroke-linecap="round"><path/><path stroke="#fff"/><path/><path/><path/><path/><circle class="orbit-dot" r="8" fill="#ed821b" stroke="none"/><circle class="orbit-dot" r="8" fill="#ed821b" stroke="none"/><circle class="scan-core" cx="960" cy="540" r="5" fill="#080a08" stroke="none"/></g></svg><span>PERMISSION AUTHORIZED</span></div>
    <div class="welcome"><div class="welcome-panel"></div><div class="welcome-heading">WELCOME TO</div><div class="welcome-company"><strong>${h(site.brand.company)}</strong><strong class="welcome-highlight" aria-hidden="true">${h(site.brand.company)}</strong></div><div class="welcome-database">${h(site.brand.database)}</div><div class="welcome-logo">${logo}</div></div>
  </section>
  <div id="cinema-caption" class="cinema-caption"></div>
  <svg id="inspection-marks" viewBox="0 0 1920 1080" aria-hidden="true"><path id="inspection-lines"/><g id="inspection-corners"></g></svg>
  <div id="inspection-text" aria-hidden="true">CONFIDENTIALITY:<strong>GENERAL BUSINESS USE</strong></div>
  <section id="archive-ui" class="archive-ui" aria-label="档案选择">
    <div class="archive-callout"><div class="eyebrow">${h(site.brand.database)} <span>／</span> <span id="archive-category">机构档案</span></div><button class="file-title" data-action="open">FILE NUMBER: <span id="selected-id">${h(site.numberPrefix)}<span id="selected-code">001</span></span><span class="file-open">↗</span></button><div class="callout-rule"><i></i></div><div class="file-summary"><span id="selected-title">莱茵生命</span></div><button class="read-file" data-action="open">ACCESS FILE <span>→</span></button></div>
    <div id="hover-label" class="hover-label" hidden>${h(site.numberPrefix)}<span id="hover-code">001</span><span id="hover-title"></span></div>
    <div class="archive-counter"><span class="tiny-label">ARCHIVE / SELECT</span><div><span id="selected-number">01</span><i>/</i><span class="count-total">12</span></div></div>
    <div class="archive-controls">
      <div class="archive-navigation"><button data-action="prev" aria-label="上一个档案">↑</button><div id="file-ticks" class="file-ticks"></div><button data-action="next" aria-label="下一个档案">↓</button></div>
      <div class="archive-hint"><kbd>←</kbd> <kbd>→</kbd> 切换列 <span>／</span> <kbd>↑</kbd> <kbd>↓</kbd> 前后档案 <span>／</span> <kbd>ENTER</kbd> 读取</div>
    </div>
    <div class="column-navigation"><button data-action="column-prev" aria-label="上一列">←</button><div><span id="column-number">COLUMN <span id="column-index">03</span> / ${String(archiveColumns.length).padStart(2, "0")}</span><strong id="column-name">机构档案</strong></div><button data-action="column-next" aria-label="下一列">→</button></div>
  </section>
  <section id="detail-ui" class="detail-ui" aria-label="档案内容" hidden>
    <button class="back-button" data-action="back">← <span>ARCHIVE OVERVIEW</span><small>ESC</small></button>
    <div class="object-caption"><span id="object-id">NO.001</span><div>${h(site.brand.database)}</div></div>
    <article id="detail-content" class="detail-content"></article>
  </section>
  <div class="powered">POWERED BY <b>${h(site.brand.name)}</b><i></i></div>
  <footer class="system-footer"><span class="session-status"><i class="status-light"></i> SESSION AUTHORIZED</span><span>${h(site.brand.operator)} <i>／</i> <span id="clock">00:00:00</span></span><button data-action="replay" title="重播启动流程">REINITIALIZE ↗</button></footer>
  <div id="modal-root"></div><div id="toast" class="toast" role="status"></div>
  <div id="loading" class="loading"><div class="loading-mark">${logo}</div><span>CONNECTING TO ${h(site.brand.database)}</span><i></i></div>
`;

localizeUi($("#stage"));
$("#stage").dataset.site = site.features.knowledgeBase
  ? "knowledge"
  : "archive";
document.title = site.title;
document.querySelector<HTMLMetaElement>('meta[name="description"]')!.content =
  site.description;
document.documentElement.lang = site.locale;
$("#stage").style.setProperty("--site-ink", site.theme.ink);
$("#stage").style.setProperty("--site-accent", site.theme.accent);
document.body.style.background = site.theme.background;

$("#boot-background").insertAdjacentHTML(
  "beforeend",
  '<div class="boot-white"></div>',
);
const bootSequence = new BootSequence($("#stage"));
const uiMotion = new ArchiveUiMotion($("#stage"));
const reader = new ArchiveReader($("#detail-content"));
reader.onPanelChange = (animate) => uiMotion.panelChanged(animate);
reader.onTabChange = (id) => {
  activeTab = id;
};
const callout = $(".archive-callout");
const hoverInput = matchMedia("(hover: hover) and (pointer: fine)");
let uiPointer: { x: number; y: number } | null = null;
let uiPointerFrame = 0;
function refreshUiPointer() {
  if (uiPointerFrame) return;
  uiPointerFrame = requestAnimationFrame(() => {
    uiPointerFrame = 0;
    if ($("#stage").dataset.mode !== "archive") return;
    let opacity = 1;
    if (
      uiPointer &&
      hoverInput.matches &&
      $("#stage").dataset.mode === "archive"
    ) {
      const bounds = callout.getBoundingClientRect();
      const dx = Math.max(
        bounds.left - uiPointer.x,
        0,
        uiPointer.x - bounds.right,
      );
      const dy = Math.max(
        bounds.top - uiPointer.y,
        0,
        uiPointer.y - bounds.bottom,
      );
      const scale =
        $("#stage").getBoundingClientRect().width / $("#stage").clientWidth;
      const proximity = Math.max(0, 1 - Math.hypot(dx, dy) / (100 * scale));
      opacity = 1 - 0.8 * proximity * proximity * (3 - 2 * proximity);
    }
    callout.style.setProperty("--callout-opacity", opacity.toFixed(3));
  });
}
document.addEventListener("pointermove", (event) => {
  uiPointer =
    event.pointerType === "touch"
      ? null
      : { x: event.clientX, y: event.clientY };
  refreshUiPointer();
});
const clearUiPointer = () => {
  uiPointer = null;
  refreshUiPointer();
};
document.addEventListener("pointerleave", clearUiPointer);
document.addEventListener("pointercancel", clearUiPointer);
window.addEventListener("blur", clearUiPointer);
hoverInput.addEventListener("change", refreshUiPointer);

type Mode = "boot" | "archive" | "detail";
let mode: Mode = "boot",
  selected = Math.max(
    0,
    records.findIndex((r) => r.id === site.defaultDocument),
  ),
  bootStart = 0,
  lastStep = "",
  ready = false;
let modal: "search" | "saved" | "settings" | null = null,
  searchQuery = "",
  filter = categories[0];
let activeTab = "overview";
const reviewParams = new URLSearchParams(location.search);
let frozenTime =
  reviewParams.get("freeze") === "1"
    ? Number(reviewParams.get("time") ?? 0)
    : null;
if (reviewParams.get("review") === "1") {
  $("#stage").dataset.review = "true";
  window.addEventListener("message", (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== window.parent ||
      event.data?.type !== "rhine-review-frame"
    )
      return;
    const t = Number(event.data.time);
    if (!Number.isFinite(t) || t < 0 || t >= 35) return;
    frozenTime = t;
    if (ready && mode !== "boot") setMode("boot");
  });
}
let toastTimer: ReturnType<typeof setTimeout>;
let previousFocus: HTMLElement | null = null;
function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
try {
  migrateDefaultStorage(localStorage);
} catch {}
const saved = new Set<string>(
  readLocal<string[]>(storageKey("saved"), []).filter((id) =>
    records.some((r) => r.id === id),
  ),
);
const prefs = {
  ...readLocal(storageKey("settings"), {
    sound: false,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    quality: true,
  }),
  pathTracing: site.features.pathTracing,
};
const numberOptions = {
  locales: "en-US",
  format: { minimumIntegerDigits: 2, useGrouping: false },
  duration: 460,
  motionBlur: true,
  animated: !prefs.reduced,
};
const fileCounter = createRollingNumber($("#selected-number"), {
  ...numberOptions,
  value: 1,
});
const columnCounter = createRollingNumber($("#column-index"), {
  ...numberOptions,
  value: 3,
});
const codeOptions = {
  ...numberOptions,
  format: { minimumIntegerDigits: 3, useGrouping: false },
  value: 1,
};
const selectionTitle = new ScrubTitle($("#selected-title"));
const selectedCode = createRollingNumber($("#selected-code"), codeOptions);
const hoverCode = createRollingNumber($("#hover-code"), codeOptions);
const audio = new TerminalAudio();
audio.enabled = prefs.sound;
let scene: ArchiveScene;
let viewer: ModelViewer | undefined;
const accessLog: { id: string; time: string }[] = [];
const columnMemory = archiveColumns.map((_, lane) => columnFiles(lane)[0]);
function recordAccess() {
  accessLog.unshift({
    id: records[selected].id,
    time: new Date().toLocaleTimeString("en-GB"),
  });
}
function savePrefs() {
  try {
    localStorage.setItem(storageKey("settings"), JSON.stringify(prefs));
  } catch {}
  audio.enabled = prefs.sound;
  if (prefs.reduced) selectionTitle.reset();
  scene?.setReduced(prefs.reduced);
  uiMotion.setReduced(prefs.reduced);
  scene?.setQuality(prefs.quality);
  scene?.setPathTracing(prefs.pathTracing);
  fileCounter.update({ animated: !prefs.reduced && mode === "archive" });
  columnCounter.update({ animated: !prefs.reduced && mode === "archive" });
  selectedCode.update({ animated: !prefs.reduced && mode === "archive" });
  hoverCode.update({ animated: !prefs.reduced && mode === "archive" });
  $("#stage").classList.toggle("reduce-motion", prefs.reduced);
}
const layoutMeasure = document.createElement("canvas").getContext("2d")!;
function fit() {
  const stage = $("#stage");
  const reference = reviewParams.get("review") === "1";
  const referenceScale = Math.min(innerWidth / 1920, innerHeight / 1080);
  const scale = reference ? referenceScale : Math.max(0.8, referenceScale);
  const width = reference ? 1920 : innerWidth / scale;
  const height = reference ? 1080 : innerHeight / scale;
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  stage.style.setProperty(
    "--boot-scale",
    String(Math.min(width / 1920, height / 1080)),
  );
  stage.dataset.viewport = reference ? "reference" : "fluid";
  stage.dataset.layout =
    width < 1400 || width / height < 1.2 ? "compact" : "wide";
  stage.dataset.narrow = String(width < 720);
  if (!reference) {
    layoutMeasure.font = "750 30px MiSans";
    const layout = archiveLayout(
      width,
      layoutMeasure.measureText(
        `${uiText("fileNumber", "FILE NUMBER:", "FILE NUMBER:")} ${site.numberPrefix}000`,
      ).width,
    );
    stage.style.setProperty("--ui-gutter", `${layout.gutter}px`);
    stage.style.setProperty("--archive-left", `${layout.left}px`);
    stage.style.setProperty("--archive-width", `${layout.panelWidth}px`);
    stage.style.setProperty("--column-left", `${layout.navigationLeft}px`);
    stage.style.setProperty("--column-width", `${layout.navigationWidth}px`);
  }
  $("#viewport").style.setProperty("--scale", String(scale));
  scene?.resize();
  viewer?.resize();
  refreshUiPointer();
}
window.addEventListener("resize", fit);
fit();
$("#file-ticks").innerHTML = records
  .map(
    (r, i) =>
      `<button data-select="${i}" aria-label="${uiText("selectArchive", "选择档案", "Select archive")} ${h(displayCode(r))} ${h(r.title)}" title="${h(displayCode(r))} · ${h(r.title)}"></button>`,
  )
  .join("");

function setMode(next: Mode) {
  if (next !== "detail") {
    reader.setExpanded(false);
    reader.cancel();
  }
  if (next !== "archive") selectionTitle.reset();
  if (next === "detail" && mode !== "detail") recordAccess();
  mode = next;
  $("#stage").dataset.mode = next;
  $("#boot").inert = next !== "boot";
  $("#boot").setAttribute("aria-hidden", String(next !== "boot"));
  $(".system-nav").inert = next === "boot";
  $(".system-footer").inert = next === "boot";
  scene?.setMode(next === "boot" ? "hidden" : next);
  if (next !== "boot") {
    bootSequence.reset();
    $(".file-title").firstChild!.textContent = uiText(
      "fileNumber",
      "FILE NUMBER: ",
      "FILE NUMBER: ",
    );
    $("#stage").dataset.boot = "done";
    $("#cinema-caption").textContent = "";
  }
  if (next === "detail") renderDetail();
  uiMotion.setMode(next);
  refreshUiPointer();
}
function select(index: number, navigation?: ArchiveNavigation) {
  selected = (index + records.length) % records.length;
  columnMemory[fileLocation(selected).lane] = selected;
  if (mode === "detail") setMode("archive");
  activeTab = "overview";
  scene?.select(selected, navigation);
  updateSelection(navigation);
  audio.play("tick");
}
function stepFile(direction: number) {
  const files = columnFiles(fileLocation(selected).lane);
  select(
    files[(files.indexOf(selected) + direction + files.length) % files.length],
    { axis: "row", direction },
  );
}
function stepColumn(direction: number) {
  const lane = fileLocation(selected).lane;
  const next = wrap(lane + direction, archiveColumns.length);
  select(columnMemory[next], { axis: "lane", direction });
}
function updateSelection(navigation?: ArchiveNavigation) {
  const r = records[selected];
  const { lane } = fileLocation(selected);
  const files = columnFiles(lane);
  selectionTitle.update(r.title, !prefs.reduced && mode === "archive");
  $("#archive-category").textContent = r.category;
  const direction =
    navigation && "axis" in navigation
      ? navigation.direction > 0
        ? "up"
        : "down"
      : "auto";
  selectedCode.update({
    value: r.number,
    animated: !prefs.reduced && mode === "archive",
    direction,
  });
  fileCounter.update({
    value: files.indexOf(selected) + 1,
    animated: !prefs.reduced && mode === "archive",
    direction:
      navigation && "axis" in navigation && navigation.axis === "row"
        ? direction
        : "auto",
  });
  $(".count-total").textContent = String(files.length).padStart(2, "0");
  columnCounter.update({
    value: lane + 1,
    animated: !prefs.reduced && mode === "archive",
    direction:
      navigation && "axis" in navigation && navigation.axis === "lane"
        ? direction
        : "auto",
  });
  $("#column-name").textContent = archiveColumns[lane];
  $<HTMLButtonElement>('[data-action="column-prev"]').disabled = false;
  $<HTMLButtonElement>('[data-action="column-next"]').disabled = false;
  document.querySelectorAll("[data-select]").forEach((b) => {
    (b as HTMLElement).hidden = !files.includes(
      Number((b as HTMLElement).dataset.select),
    );
    b.classList.toggle(
      "selected",
      Number((b as HTMLElement).dataset.select) === selected,
    );
    b.setAttribute(
      "aria-pressed",
      String(Number((b as HTMLElement).dataset.select) === selected),
    );
  });
  $("#saved-count").textContent = String(saved.size).padStart(2, "0");
  if (mode === "detail") renderDetail();
}
function openFile(anchor = "") {
  if (!ready) return;
  closeModal();
  setMode("detail");
  const url = new URL(location.href);
  url.hash = anchor;
  url.searchParams.set("document", records[selected].id);
  url.searchParams.set("scene", "detail");
  if (url.href !== location.href) history.pushState({}, "", url);
  audio.play("open");
}
function toggleSaved() {
  const id = records[selected].id;
  if (saved.has(id)) saved.delete(id);
  else saved.add(id);
  try {
    localStorage.setItem(storageKey("saved"), JSON.stringify([...saved]));
  } catch {}
  $("#saved-count").textContent = String(saved.size).padStart(2, "0");
  const button = $<HTMLButtonElement>('[data-action="bookmark"]');
  button.innerHTML = bookmarkMarkup();
  button.focus({ preventScroll: true });
  audio.play("confirm");
  notify(saved.has(id) ? "档案已加入收藏" : "已取消收藏");
}
function bookmarkMarkup() {
  const on = saved.has(records[selected].id);
  return `${on ? "− REMOVE FROM SAVED" : "＋ SAVE ARCHIVE"}<span>${on ? uiText("saved", "已收藏", "Saved") : uiText("saveArchive", "收藏档案", "Save archive")}</span>`;
}

function renderDetail() {
  const r = records[selected];
  $("#detail-content").dataset.contentLayout = r.layout;
  $("#object-id").textContent = "NO." + String(r.number).padStart(3, "0");
  $("#detail-content").innerHTML = `
  <div class="detail-heading" data-detail-reveal="heading"><div class="detail-kicker"><span>FILE ${h(displayCode(r))}</span><span>${h(r.clearance)}</span></div>
  <h2>${h(r.en)}</h2><div class="detail-title-cn">${h(r.title)}<span>${h(r.category)}</span></div></div>
  <div class="detail-rule" data-detail-reveal="rule"></div>
  <dl class="metadata" data-detail-reveal="metadata">${r.metadata.map((m, i) => `<div><dt>${h(m.label)}</dt><dd>${r.layout === "legacy" && i === 3 ? "<i></i>" : ""}${h(m.value)}</dd></div>`).join("")}</dl>
  <div class="detail-reading" data-detail-reveal="body">
  ${site.features.expandedReader ? `<div class="reader-toolbar"><button data-reader="expand" aria-expanded="false">${uiText("expandReading", "展开阅读 ↗", "Expand reading ↗")}</button></div>` : ""}
  <div id="reader-tabs" class="detail-tabs" role="tablist" aria-label="${uiText("readingSections", "阅读章节", "Reading sections")}"></div>
  <div class="reader-grid"><aside id="reader-toc"></aside><div id="tab-panel" class="tab-panel" role="tabpanel"></div></div>
  <div class="detail-actions"><button class="solid-button" data-action="bookmark">${bookmarkMarkup()}</button><a class="export-button" href="${h(r.exportUrl)}" download aria-label="${uiText("export", "导出", "Export")} ${h(displayCode(r))}">EXPORT <span>↓</span></a></div>
  <div class="detail-footnote">${r.source ? `<a href="${h(r.source)}" target="_blank" rel="noopener">${uiText("sourceLink", "设定参考 ↗", "Source attribution ↗")}</a>` : "<span></span>"}<span>${String(r.number).padStart(3, "0")} / ${String(records.length).padStart(3, "0")}</span></div>
  ${site.attribution ? `<div class="content-attribution">${h(site.attribution.text)} · <a href="${h(site.attribution.license)}" target="_blank" rel="noopener">Data license ↗</a></div>` : ""}</div>`;
  $("#detail-content").setAttribute("tabindex", "-1");
  const log = `<div class="panel-label">${uiText("accessLog", "ACCESS LOG / 本次访问", "ACCESS LOG / THIS SESSION")}</div>${accessLog
    .filter((entry) => entry.id === r.id)
    .slice(0, 4)
    .map(
      (entry) =>
        `<div class="log-row"><span>${entry.time}</span><span>${h(site.brand.operator)}</span><b>READ AUTHORIZED</b></div>`,
    )
    .join(
      "",
    )}<p class="log-note">${uiText("sessionNote", "本次会话已通过身份验证。档案内容以当前终端可访问范围展示。", "This session is authorized to read the available archive content.")}</p>`;
  reader.mount(r, log, activeTab);
  uiMotion.bindDetail();
}
function setTab(tab: string, sound = true) {
  activeTab = tab;
  reader.setTab(tab, sound);
  if (sound) audio.play("tick");
}
const localizeMessage = message;
function notify(message: string) {
  clearTimeout(toastTimer);
  $("#toast").textContent = localizeMessage(message);
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2600);
}

function openModal(kind: NonNullable<typeof modal>) {
  if (!ready) return;
  previousFocus = document.activeElement as HTMLElement;
  modal = kind;
  searchQuery = "";
  searchPage = 1;
  evidenceFilter = "";
  cellFilter = "";
  filter = categories[0];
  audio.play("open");
  renderModal();
}
function closeModal() {
  if (!modal) return;
  modal = null;
  searchAbort?.abort();
  searchTicket++;
  $("#modal-root").innerHTML = "";
  previousFocus?.focus({ preventScroll: true });
}
function renderModal() {
  if (!modal) return;
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="terminal-modal ${modal === "settings" ? "settings-modal" : ""}" role="dialog" aria-modal="true" aria-label="${modal === "settings" ? "系统设置" : modal === "saved" ? "收藏档案" : "档案检索"}"><div class="modal-top"><span>${h(site.brand.name)} / ${modal === "settings" ? "SYSTEM PREFERENCES" : "ARCHIVE DIRECTORY"}</span><button data-action="close-modal" aria-label="关闭窗口">CLOSE <span>×</span></button></div>${modal === "settings" ? settingsMarkup() : `<h2>${modal === "saved" ? "SAVED ARCHIVES" : "ARCHIVE INDEX"}<small>${modal === "saved" ? "收藏档案" : "内部档案检索"}</small></h2><div class="search-field"><span>⌕</span><input id="archive-search" type="search" autocomplete="off" placeholder="输入档案编号、名称或科室" aria-label="检索档案"/><span class="key">ESC</span></div><div class="category-filters">${categories.map((c, i) => `<button data-filter="${h(c)}" class="${i === 0 ? "active" : ""}">${h(c)}</button>`).join("")}</div>${site.features.knowledgeBase && modal !== "saved" ? `<div class="search-facets"><label>Evidence <select id="evidence-filter"><option value="">All evidence</option><option value="phenotype">Phenotype association</option><option value="mechanism_or_expression">Mechanism / expression</option></select></label><label>Cell type <select id="cell-filter"><option value="">All cells</option></select></label></div>` : ""}<div class="result-header"><span>FILE / 档案</span><span>DEPARTMENT / 科室</span><span>ACCESS</span></div><div id="search-results" class="search-results"></div><div id="search-pages" class="search-pages"></div><div class="modal-bottom"><span id="result-count"></span><span>${h(site.brand.database)} <i>●</i> CONNECTED</span></div>`}</section></div>`;
  localizeUi($("#modal-root"));
  if (modal !== "settings") {
    if (site.features.knowledgeBase && modal !== "saved")
      void loadSearchFacets();
    renderResults();
    requestAnimationFrame(() => $("#archive-search").focus());
  } else
    requestAnimationFrame(() =>
      $<HTMLButtonElement>('[data-action="close-modal"]').focus(),
    );
  $("#modal-root")
    .querySelector(".modal-backdrop")
    ?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
}
let searchPage = 1,
  evidenceFilter = "",
  cellFilter = "",
  searchTicket = 0;
let searchAbort: AbortController | undefined,
  searchTimer: ReturnType<typeof setTimeout>;
async function loadSearchFacets() {
  const evidence = $<HTMLSelectElement>("#evidence-filter"),
    cell = $<HTMLSelectElement>("#cell-filter");
  try {
    const data = await knowledgeSearch();
    if (!evidence.isConnected) return;
    evidence.insertAdjacentHTML(
      "beforeend",
      data.evidence
        .map(
          (v) =>
            `<option value="${h(v)}">${h(v.replaceAll("_", " "))}</option>`,
        )
        .join(""),
    );
    cell.insertAdjacentHTML(
      "beforeend",
      data.cells
        .map((v) => `<option value="${h(v)}">${h(v)}</option>`)
        .join(""),
    );
  } catch {
    /* Search itself supplies a retry if the index is unavailable. */
  }
}
async function renderResults() {
  if (!modal || modal === "settings") return;
  searchAbort?.abort();
  searchAbort = new AbortController();
  const ticket = ++searchTicket;
  const host = $("#search-results");
  host.innerHTML = `<div class="reader-status" role="status">${uiText("searching", "正在检索…", "Searching archives…")}</div>`;
  try {
    const column = site.columns.find((c) => c.title === filter)?.id;
    let result;
    if (modal === "saved") {
      const hits = records
        .filter(
          (r) =>
            saved.has(r.id) &&
            (!column || r.column === column) &&
            `${displayCode(r)} ${r.title} ${r.en}`
              .toLowerCase()
              .includes(searchQuery.toLowerCase()),
        )
        .map((r) => ({
          id: r.id,
          title: r.title,
          subtitle: r.en,
          kind: "topic" as const,
          geneId: undefined,
        }));
      result = {
        hits: hits.slice((searchPage - 1) * 50, searchPage * 50),
        total: hits.length,
      };
    } else
      result = await contentProvider.search(
        searchQuery,
        {
          column,
          evidence: evidenceFilter,
          cell: cellFilter,
          page: searchPage,
        },
        searchAbort.signal,
      );
    if (ticket !== searchTicket || !host.isConnected) return;
    host.innerHTML = result.hits.length
      ? result.hits
          .map((hit) => {
            const i = records.findIndex((r) => r.id === hit.id),
              r = records[i];
            return `<button class="result-row" data-result="${i}" ${hit.geneId ? `data-gene="${h(hit.geneId)}"` : ""}><span class="result-name"><b>${hit.kind === "gene" ? "GENE" : h(displayCode(r))}</b><span>${h(hit.title)}<small>${h(hit.subtitle)}</small></span>${saved.has(r.id) ? "<i>＋</i>" : ""}</span><span>${h(hit.kind === "gene" ? hit.geneId : r.department)}</span><span>${hit.kind === "gene" ? "EVIDENCE" : r.clearance === "RESTRICTED" ? "CATALOG ONLY" : "AUTHORIZED"} <i>↗</i></span></button>`;
          })
          .join("")
      : `<div class="empty-results"><span>∅</span><strong>${uiText("noMatches", "没有匹配的档案", "No matching archives")}</strong><p>${uiText("searchSuggestion", "尝试其他名称、档案编号，或切换科室分类。", "Try a topic, gene alias, disease, PMID or another filter.")}</p><button data-action="reset-search">${uiText("resetSearch", "重置检索 →", "Reset search →")}</button></div>`;
    $("#result-count").textContent =
      `${String(result.total).padStart(2, "0")} RECORDS FOUND`;
    const pages = Math.max(1, Math.ceil(result.total / 50));
    $("#search-pages").innerHTML =
      pages > 1
        ? `<button data-search-page="${searchPage - 1}" ${searchPage === 1 ? "disabled" : ""}>← ${uiText("previous", "上一页", "Previous")}</button><span>${searchPage} / ${pages}</span><button data-search-page="${searchPage + 1}" ${searchPage === pages ? "disabled" : ""}>${uiText("next", "下一页", "Next")} →</button>`
        : "";
  } catch (error) {
    if (ticket === searchTicket && host.isConnected)
      host.innerHTML = `<div class="reader-status">${uiText("searchError", "检索目录暂时无法载入。", "The search index could not be loaded.")}<button data-search-retry>${uiText("retry", "重试 →", "Retry →")}</button></div>`;
  }
}
function settingsMarkup() {
  return `<h2>SYSTEM SETTINGS<small>终端偏好设置</small></h2><p class="settings-intro">${h(site.brand.operator)} <span>·</span> SESSION AUTHORIZED</p><div class="settings-list"><label><div><strong>INTERFACE SOUND</strong><span>界面反馈音</span></div><input type="checkbox" data-pref="sound" ${prefs.sound ? "checked" : ""}/><i class="toggle"></i></label><label><div><strong>REDUCED MOTION</strong><span>减少镜头移动和过渡动效</span></div><input type="checkbox" data-pref="reduced" ${prefs.reduced ? "checked" : ""}/><i class="toggle"></i></label><label><div><strong>HIGH QUALITY RENDERING</strong><span>精细网格阴影、环境遮蔽与高分辨率渲染</span></div><input type="checkbox" data-pref="quality" ${prefs.quality ? "checked" : ""}/><i class="toggle"></i></label></div><div class="settings-shortcuts"><span>KEYBOARD CONTROLS</span><p><kbd>←</kbd><kbd>→</kbd> 切列 <kbd>↑</kbd><kbd>↓</kbd> 选档 <kbd>ENTER</kbd> 读取 <kbd>/</kbd> 检索 <kbd>ESC</kbd> 返回</p></div><div class="settings-bottom"><button data-action="fullscreen">FULLSCREEN <span>↗</span></button><button data-action="restart">REINITIALIZE SYSTEM <span>↻</span></button></div><div class="modal-bottom"><span>${h(site.brand.system)} ${h(site.brand.systemAccent)} / 1.0 · 使用 MiSans 字体（小米） <a href="/fonts/MiSans-license.pdf" target="_blank" rel="noopener">字体许可</a></span><span>POWERED BY ${h(site.brand.name)}</span></div>`;
}

document.addEventListener("input", (e) => {
  if ((e.target as HTMLElement).id === "archive-search") {
    searchQuery = (e.target as HTMLInputElement).value;
    searchPage = 1;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderResults, 130);
  }
});
document.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === "evidence-filter" || el.id === "cell-filter") {
    if (el.id === "evidence-filter") evidenceFilter = el.value;
    else cellFilter = el.value;
    searchPage = 1;
    renderResults();
  }
  if (el.dataset.pref) {
    prefs[el.dataset.pref as keyof typeof prefs] = el.checked;
    savePrefs();
    audio.play("confirm");
  }
});
document.addEventListener("click", (e) => {
  const el = (e.target as Element).closest<HTMLElement>("button");
  if (!el) return;
  if (el.dataset.select) {
    const index = Number(el.dataset.select);
    if (mode === "archive" && index === selected) openFile();
    else select(index);
    return;
  }
  if (el.dataset.searchPage) {
    searchPage = Number(el.dataset.searchPage);
    renderResults();
    return;
  }
  if (el.hasAttribute("data-search-retry")) {
    renderResults();
    return;
  }
  if (el.dataset.result) {
    select(Number(el.dataset.result));
    openFile();
    if (el.dataset.gene) reader.openGene(el.dataset.gene);
    return;
  }
  if (el.dataset.filter) {
    filter = el.dataset.filter;
    document
      .querySelectorAll("[data-filter]")
      .forEach((b) =>
        b.classList.toggle(
          "active",
          (b as HTMLElement).dataset.filter === filter,
        ),
      );
    searchPage = 1;
    renderResults();
    return;
  }
  if (el.dataset.tab) {
    setTab(el.dataset.tab);
    return;
  }
  const action = el.dataset.action;
  if (action === "skip") {
    setMode("archive");
    audio.play("confirm");
  }
  if (action === "prev") stepFile(-1);
  if (action === "next") stepFile(1);
  if (action === "column-prev") stepColumn(-1);
  if (action === "column-next") stepColumn(1);
  if (action === "open") openFile();
  if (action === "model-viewer" && mode === "detail") {
    viewer ??= new ModelViewer($("#stage"), () => audio.play("back"));
    viewer.open(
      records[selected].id,
      records[selected].title,
      () => scene.createAssemblyModel(),
      prefs.reduced,
    );
    audio.play("open");
  }
  if (action === "back") {
    backToArchive();
    audio.play("back");
  }
  if (action === "search" || action === "saved" || action === "settings")
    openModal(action);
  if (action === "close-modal") closeModal();
  if (action === "bookmark") toggleSaved();
  if (action === "reset-search") {
    modal = "search";
    searchQuery = "";
    searchPage = 1;
    evidenceFilter = "";
    cellFilter = "";
    filter = categories[0];
    renderModal();
  }
  if (action === "replay" || action === "restart") {
    closeModal();
    bootStart = performance.now() / 1000 - 1.76;
    frozenTime = null;
    lastStep = "";
    setMode(prefs.reduced ? "archive" : "boot");
    selected = Math.max(
      0,
      records.findIndex((r) => r.id === site.defaultDocument),
    );
    scene.select(selected);
    updateSelection();
    audio.play("back");
  }
  if (action === "fullscreen") {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void document.documentElement
        .requestFullscreen()
        .catch(() => notify("请使用浏览器的全屏快捷键 F11"));
  }
});
document.addEventListener("keydown", (e) => {
  if (viewer?.isOpen) return;
  const typing =
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLSelectElement ||
    e.target instanceof HTMLTextAreaElement;
  if (e.key === "Escape") {
    if (modal) closeModal();
    else if (reader.isExpanded) reader.setExpanded(false);
    else if (mode === "detail") backToArchive();
    else if (mode === "boot" && ready) setMode("archive");
    return;
  }
  if (modal && e.key === "Tab") {
    const focusables = [
      ...$("#modal-root").querySelectorAll<HTMLElement>(
        'button,input,[tabindex="0"]',
      ),
    ];
    const first = focusables[0],
      last = focusables.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
    return;
  }
  if (typing || modal || !ready) return;
  if (
    (e.target as HTMLElement).dataset.tab &&
    ["ArrowLeft", "ArrowRight"].includes(e.key)
  ) {
    e.preventDefault();
    const tabs = reader.tabIds;
    setTab(
      tabs[
        (tabs.indexOf(activeTab) +
          (e.key === "ArrowRight" ? 1 : tabs.length - 1)) %
          tabs.length
      ],
    );
    $<HTMLButtonElement>(`[data-tab="${activeTab}"]`).focus();
    return;
  }
  if (
    reader.isExpanded &&
    [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ].includes(e.key)
  )
    return;
  if (
    mode === "detail" &&
    (e.target as HTMLElement).closest(".knowledge-reader,.markdown-body")
  )
    return;
  if (e.key === "/") {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    openModal("search");
  }
  if (e.key === "ArrowLeft" && mode !== "boot") {
    e.preventDefault();
    stepColumn(-1);
  }
  if (e.key === "ArrowRight" && mode !== "boot") {
    e.preventDefault();
    stepColumn(1);
  }
  if (["ArrowUp", "ArrowDown"].includes(e.key) && mode !== "boot") {
    e.preventDefault();
    stepFile(e.key === "ArrowUp" ? -1 : 1);
  }
  if (
    e.key === "Enter" &&
    (document.activeElement === document.body ||
      document.activeElement?.id === "stage" ||
      document.activeElement?.id === "detail-content" ||
      ["prev", "next", "column-prev", "column-next"].includes(
        (document.activeElement as HTMLElement)?.dataset.action ?? "",
      ) ||
      (document.activeElement as HTMLElement)?.dataset.select)
  ) {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    else if (mode === "archive") openFile();
  }
});

function backToArchive() {
  setMode("archive");
  const url = new URL(location.href);
  url.searchParams.delete("document");
  url.searchParams.set("scene", "archive");
  history.pushState({}, "", url);
}
window.addEventListener("popstate", () => {
  const params = new URLSearchParams(location.search);
  const id = params.get("document");
  if (id) {
    const index = records.findIndex((r) => r.id === id);
    if (index >= 0) {
      select(index);
      setMode("detail");
    }
  } else setMode(params.get("scene") === "detail" ? "detail" : "archive");
});
document.addEventListener("click", (e) => {
  const link = (e.target as Element).closest<HTMLAnchorElement>("a[href]");
  if (!link || link.target || link.download || e.ctrlKey || e.metaKey) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || !url.searchParams.has("document"))
    return;
  const index = records.findIndex(
    (r) => r.id === url.searchParams.get("document"),
  );
  if (index < 0) return;
  e.preventDefault();
  select(index);
  openFile(url.hash);
});
const ease = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
function bootFrame(t: number) {
  const motion = bootSequence.update(t);
  let step: string = motion.step;
  let caption =
    motion.step === "auth"
      ? t < 9.52
        ? english
          ? `Identity confirmed: ${site.brand.operator}`
          : `身份信息确认：${site.brand.operator}`
        : t < 11.84
          ? "请求已接收"
          : "开始处理"
      : motion.step === "scan"
        ? "权限验证通过"
        : motion.step === "welcome"
          ? english
            ? `Welcome to ${site.brand.name}`
            : "欢迎访问莱茵生命内部资料档案"
          : "";
  if (t >= 22) {
    step = "array";
    caption = "选择档案";
  }
  if (t >= 25.68) {
    step = "select";
    caption = english
      ? displayCode(records[selected])
      : `编号：${displayCode(records[selected])}`;
  }
  if (t >= 28.3) {
    step = "inspect";
    caption =
      t >= 29.3
        ? "保密级别：商业区"
        : english
          ? displayCode(records[selected])
          : `编号：${displayCode(records[selected])}`;
  }
  if (step !== lastStep) {
    $("#stage").dataset.boot = step;
    lastStep = step;
    if (["auth", "scan", "select"].includes(step))
      audio.play(step === "scan" ? "confirm" : "tick");
  }
  $("#cinema-caption").textContent = english
    ? message(caption)
        .replace("请求已接收", "Request received")
        .replace("开始处理", "Processing")
        .replace("权限验证通过", "Permission authorized")
        .replace("保密级别：商业区", "General business use")
    : caption;
  $(".file-title").firstChild!.textContent =
    step === "array"
      ? "SELECTING FILES...".slice(0, Math.max(0, Math.floor((t - 21.94) * 18)))
      : uiText("fileNumber", "FILE NUMBER: ", "FILE NUMBER: ");
  $("#stage").style.setProperty(
    "--entry-opacity",
    String(ease((t - 21.9) / 0.13)),
  );
  $(".callout-rule").style.transform = `scaleX(${ease((t - 22.08) / 0.9)})`;
  const reveal = ease((t - 22) / 0.4),
    lift = ease((t - 26) / 1.8),
    zoom = 0.55 * ease((t - 27.3) / 1.65) + 0.45 * ease((t - 29.0) / 5.0);
  if (t >= 35) {
    setMode("detail");
    return undefined;
  }
  return { reveal, lift, zoom, time: t };
}

let lastTime = 0,
  frameCount = 0,
  frameStart = performance.now(),
  fps = 0;
function frame(ms: number) {
  const time = ms / 1000;
  const cinema =
    mode === "boot" && ready
      ? bootFrame(frozenTime ?? time - bootStart)
      : undefined;
  if (!viewer?.isOpen) scene?.update(time, cinema);
  viewer?.update(time);
  if (scene && !viewer?.isOpen) uiMotion.update(time, scene.detailVisibility);
  const inspectTime = cinema?.time ?? -1;
  const inspectOpacity =
    ease((inspectTime - 29.15) / 0.35) * (1 - ease((inspectTime - 31.4) / 0.5));
  $("#inspection-marks").style.opacity = String(inspectOpacity);
  $("#inspection-text").style.opacity = String(inspectOpacity);
  $("#inspection-text strong").style.opacity = String(
    ease((inspectTime - 30.25) / 0.5),
  );
  if (scene && inspectOpacity > 0) {
    const corners = [
      [-2.05, 3.04],
      [2.05, 3.04],
      [-2.05, 0.35],
      [2.05, 0.35],
    ].map(([x, y]) => scene!.projectCard(x, y));
    $("#inspection-corners").innerHTML = corners
      .map(([x, y]) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8"/>`)
      .join("");
    const a = scene.projectCard(-1.88, 0.5),
      b = scene.projectCard(-0.36, 1.7);
    const c = scene.projectCard(0.36, 2.04),
      d = scene.projectCard(1.9, 2.9);
    $("#inspection-lines").setAttribute("d", `M${a}L${b}M${c}L${d}`);
  }
  if (scene && inspectTime > 32.5) {
    const [x, y] = scene.projectCard(0.15, 1.9);
    $("#inspection-marks").style.opacity = String(
      ease((inspectTime - 32.5) / 0.5),
    );
    $("#inspection-corners").innerHTML = "";
    $("#inspection-lines").setAttribute(
      "d",
      `M${x - 2},${y}h4M${x},${y - 2}v4`,
    );
  }
  if (Math.floor(time) !== lastTime) {
    lastTime = Math.floor(time);
    $("#clock").textContent = new Date().toLocaleTimeString("en-GB");
  }
  frameCount++;
  if (ms - frameStart > 1000) {
    fps = (frameCount * 1000) / (ms - frameStart);
    frameStart = ms;
    frameCount = 0;
    $("#three-scene").dataset.fps = String(Math.round(fps));
    $("#three-scene").dataset.renderStats = JSON.stringify(scene?.getStats());
  }
  requestAnimationFrame(frame);
}
async function start() {
  try {
    scene = new ArchiveScene(
      $("#three-scene"),
      undefined,
      false,
      reviewParams.get("review") === "1" ? "baseline" : site.theme.lighting,
    );
    await Promise.all([
      scene.load(),
      document.fonts.load("400 20px MiSans"),
      document.fonts.load("700 20px MiSans"),
    ]);
    fit();
    scene.select(selected);
    scene.onSelect = (i, cell) => {
      if (mode === "boot") return;
      select(i, cell ? { cell } : undefined);
    };
    scene.onOpen = () => {
      if (mode === "archive") openFile();
    };
    scene.onPathTracingState = (state) => {
      $("#three-scene").dataset.traceState = state;
    };
    scene.onHover = (i) => {
      const label = $("#hover-label");
      if (i === null) {
        label.hidden = true;
        return;
      }
      hoverCode.update({
        value: records[i].number,
        animated: !label.hidden && !prefs.reduced && mode === "archive",
      });
      $("#hover-title").textContent = " / " + records[i].title;
      label.hidden = false;
    };
    savePrefs();
    ready = true;
    bootStart = performance.now() / 1000;
    setMode("boot");
    select(
      Math.max(
        0,
        records.findIndex(
          (r) =>
            r.id === (reviewParams.get("document") ?? site.defaultDocument),
        ),
      ),
    );
    $("#loading").classList.add("loaded");
    setTimeout(() => $("#loading").remove(), 600);
    const params = new URLSearchParams(location.search);
    if (params.get("scene") === "archive") setMode("archive");
    if (params.get("scene") === "detail" || params.has("document"))
      setMode("detail");
    bootStart -= params.has("time") ? Number(params.get("time")) : 1.76;
    // Let the loading veil finish before the first reference letter appears.
    if (!params.has("time")) bootStart += 0.6;
    if (
      prefs.reduced &&
      !params.has("time") &&
      !params.has("document") &&
      params.get("scene") !== "detail"
    )
      setMode("archive");
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    $("#loading").innerHTML =
      '<div class="error-state"><strong>CONNECTION INTERRUPTED</strong><p>三维档案资源未能载入。请确认浏览器已启用硬件加速，然后重新连接。</p><button data-reconnect>RECONNECT →</button></div>';
    localizeUi($("#loading"));
    $("[data-reconnect]").onclick = () => location.reload();
  }
}
updateSelection();
void start();
// Deterministic review controls: the running application, never a video surrogate.
Object.assign(window, {
  rhine: {
    seek: (t: number) => {
      setMode("boot");
      bootStart = performance.now() / 1000 - t;
      lastStep = "";
    },
    archive: () => setMode("archive"),
    detail: () => openFile(),
    select: (i: number) => select(i),
    stats: () => ({
      ...scene?.getStats(),
      fps: Math.round(fps),
      mode,
      selected: records[selected].id,
      saved: [...saved],
    }),
  },
});
