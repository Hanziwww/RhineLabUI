export type ArchiveUiMode = "boot" | "archive" | "detail";

const ramp = (value: number, start: number, end: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

// One reversible state follows the rendered camera. A new input changes its
// destination, without restarting a timer or resetting anything already visible.
export class ArchiveUiTimeline {
  mode: ArchiveUiMode = "boot";
  reduced = false;
  readonly values = {
    overview: 0,
    back: 0,
    heading: 0,
    rule: 0,
    metadata: 0,
    body: 0,
    caption: 0,
    atmosphere: 0,
  };

  setMode(mode: ArchiveUiMode) {
    this.mode = mode;
    if (mode === "boot") {
      for (const key of Object.keys(
        this.values,
      ) as (keyof typeof this.values)[])
        this.values[key] = 0;
    }
  }

  update(camera: number, dt: number) {
    if (this.mode === "boot") return this.values;
    const reading = this.mode === "detail";
    if (this.reduced) camera = reading ? 1 : 0;
    const targets = {
      overview: reading ? 0 : 1 - ramp(camera, 0.08, 0.58),
      back: reading ? 1 : 0,
      heading: reading ? ramp(camera, 0.02, 0.46) : 0,
      rule: reading ? ramp(camera, 0.1, 0.6) : 0,
      metadata: reading ? ramp(camera, 0.18, 0.72) : 0,
      body: reading ? ramp(camera, 0.36, 0.94) : 0,
      caption: reading ? ramp(camera, 0.24, 0.84) : 0,
      atmosphere: ramp(camera, 0, 0.72),
    };
    for (const key of Object.keys(targets) as (keyof typeof targets)[]) {
      const target = targets[key];
      const current = this.values[key];
      const rate = target < current ? 22 : key === "overview" ? 12 : 16;
      const next = this.reduced
        ? target
        : target + (current - target) * Math.exp(-Math.max(0, dt) * rate);
      this.values[key] = Math.abs(next - target) < 0.001 ? target : next;
    }
    return this.values;
  }

  get phase() {
    if (this.mode === "boot") return "boot";
    if (this.mode === "detail")
      return this.values.body >= 0.995 ? "reading" : "opening";
    return this.values.overview >= 0.995 ? "overview" : "returning";
  }
}

type Reveal = "heading" | "rule" | "metadata" | "body";

export class ArchiveUiMotion {
  private stage: HTMLElement;
  private archive: HTMLElement;
  private detail: HTMLElement;
  private article: HTMLElement;
  private back: HTMLElement;
  private caption: HTMLElement;
  private atmosphere: HTMLElement;
  private readingAtmosphere: HTMLElement;
  private callout: HTMLElement;
  private navigation: HTMLElement[];
  private pieces: { node: HTMLElement; reveal: Reveal }[] = [];
  private timeline = new ArchiveUiTimeline();
  private last = 0;
  private camera = 0;
  private opener: HTMLElement | null = null;
  private pendingFocus: "detail" | "archive" | null = null;
  private panelAnimation?: Animation;

  constructor(stage: HTMLElement) {
    this.stage = stage;
    const find = (selector: string) =>
      stage.querySelector<HTMLElement>(selector)!;
    this.archive = find("#archive-ui");
    this.detail = find("#detail-ui");
    this.article = find("#detail-content");
    this.back = find(".back-button");
    this.caption = find(".object-caption");
    this.atmosphere = find(".scene-atmosphere");
    this.readingAtmosphere = find(".reading-atmosphere");
    this.callout = find(".archive-callout");
    this.navigation = [
      ".archive-counter",
      ".archive-controls",
      ".column-navigation",
    ].map(find);
    stage.tabIndex = -1;
    stage.dataset.uiMotion = "boot";
    this.setInert(this.archive, true, true);
    this.setInert(this.detail, true, true);
  }

  setReduced(reduced: boolean) {
    this.timeline.reduced = reduced;
    if (reduced) this.panelAnimation?.cancel();
    this.timeline.update(this.camera, 0);
    if (this.timeline.mode !== "boot") this.apply();
  }

  setMode(mode: ArchiveUiMode) {
    const previous = this.timeline.mode;
    if (previous === mode) return;
    this.panelAnimation?.cancel();
    if (mode === "detail") {
      const active = document.activeElement;
      this.opener =
        active instanceof HTMLElement && this.archive.contains(active)
          ? active
          : this.archive.querySelector<HTMLElement>(".file-title");
      this.pendingFocus = "detail";
      this.stage.focus({ preventScroll: true });
    } else if (previous === "detail" && mode === "archive") {
      this.pendingFocus = "archive";
      if (this.detail.contains(document.activeElement))
        this.stage.focus({ preventScroll: true });
    }
    this.timeline.setMode(mode);
    this.stage.dataset.uiMotion = this.timeline.phase;
    if (mode === "boot") {
      this.pendingFocus = null;
      this.archive.style.opacity = "";
      this.atmosphere.style.opacity = "";
      this.readingAtmosphere.style.opacity = "0";
      for (const node of [this.callout, ...this.navigation])
        node.style.translate = "";
      this.detail.hidden = true;
      this.detail.inert = true;
      this.archive.inert = true;
      this.detail.setAttribute("aria-hidden", "true");
      this.archive.setAttribute("aria-hidden", "true");
      return;
    }
    this.timeline.update(this.camera, 0);
    this.apply();
  }

  bindDetail() {
    this.pieces = [
      ...this.article.querySelectorAll<HTMLElement>("[data-detail-reveal]"),
    ].map((node) => ({ node, reveal: node.dataset.detailReveal as Reveal }));
    this.paintDetail();
  }

  panelChanged(animate: boolean) {
    this.panelAnimation?.cancel();
    if (!animate || this.timeline.reduced) return;
    const panel = this.article.querySelector<HTMLElement>("#tab-panel")!;
    this.panelAnimation = panel.animate(
      [
        { opacity: 0.45, translate: "0 4px" },
        { opacity: 1, translate: "0 0" },
      ],
      { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }

  update(time: number, camera: number) {
    const dt = this.last ? Math.min(time - this.last, 0.05) : 1 / 60;
    this.last = time;
    this.camera = camera;
    this.timeline.update(camera, dt);
    if (this.timeline.mode !== "boot") this.apply();
  }

  private write(node: HTMLElement, property: string, value: string) {
    if (node.style.getPropertyValue(property) !== value)
      node.style.setProperty(property, value);
  }

  private setInert(node: HTMLElement, inert: boolean, aria = false) {
    if (node.inert !== inert) node.inert = inert;
    if (aria && node.getAttribute("aria-hidden") !== String(inert))
      node.setAttribute("aria-hidden", String(inert));
  }

  private reveal(node: HTMLElement, amount: number, offset = 10) {
    this.write(node, "opacity", amount.toFixed(3));
    this.write(node, "translate", `0 ${((1 - amount) * offset).toFixed(2)}px`);
  }

  private paintDetail() {
    const values = this.timeline.values;
    for (const { node, reveal } of this.pieces) {
      const amount = values[reveal];
      this.reveal(node, amount, reveal === "rule" ? 0 : 10);
      if (reveal === "rule")
        this.write(
          node,
          "transform",
          `scaleX(${(0.9 + 0.1 * amount).toFixed(4)})`,
        );
      if (reveal === "body") this.setInert(node, amount < 0.65);
    }
  }

  private apply() {
    const { values: v, mode } = this.timeline;
    const reading = mode === "detail";
    const phase = this.timeline.phase;
    if (this.stage.dataset.uiMotion !== phase)
      this.stage.dataset.uiMotion = phase;
    this.write(this.archive, "opacity", v.overview.toFixed(3));
    this.write(
      this.callout,
      "translate",
      `0 ${((1 - v.overview) * 8).toFixed(2)}px`,
    );
    for (const node of this.navigation)
      this.write(
        node,
        "translate",
        `0 ${((1 - v.overview) * 10).toFixed(2)}px`,
      );
    this.write(this.atmosphere, "opacity", (1 - v.atmosphere).toFixed(3));
    this.write(this.readingAtmosphere, "opacity", v.atmosphere.toFixed(3));
    this.reveal(this.back, v.back, 4);
    this.reveal(this.caption, v.caption, 8);
    this.paintDetail();
    const hidden =
      !reading &&
      Math.max(v.heading, v.metadata, v.body, v.back, v.caption) < 0.001;
    if (this.detail.hidden !== hidden) this.detail.hidden = hidden;
    this.setInert(this.detail, !reading, true);
    this.setInert(this.back, v.back < 0.5);
    this.setInert(this.caption, v.caption < 0.65);
    this.setInert(this.article, v.body < 0.65);
    this.setInert(this.archive, mode !== "archive" || v.overview < 0.55, true);
    const canFocus =
      document.activeElement === this.stage ||
      document.activeElement === document.body;
    if (this.pendingFocus === "detail" && reading && v.body >= 0.65) {
      this.pendingFocus = null;
      if (canFocus) this.article.focus({ preventScroll: true });
    } else if (
      this.pendingFocus === "archive" &&
      !reading &&
      v.overview >= 0.75
    ) {
      this.pendingFocus = null;
      if (canFocus) {
        const target =
          this.opener?.isConnected && !this.opener.closest("[hidden], [inert]")
            ? this.opener
            : this.archive.querySelector<HTMLElement>(".file-title");
        target?.focus({ preventScroll: true });
      }
    }
  }
}
