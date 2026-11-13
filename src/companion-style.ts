export const companionStyle = `
.nr-root { position: relative; display: flex; flex: 1 1 auto; min-width: 0; min-height: 0; height: 100%; overflow: hidden; }
.nr-root[data-dsh-reader-fullscreen] {
  position: fixed; z-index: 900; width: auto; height: auto;
  /* Native fullscreen can set chrome-top to zero while window controls still overlay the top strip. */
  inset-block-start: max(
    var(--dsh-frame-chrome-top, 0px),
    var(--dsh-frame-top-clearance, 0px),
    var(--dsh-windows-titlebar-height, 0px),
    env(safe-area-inset-top, 0px),
    var(--nr-viewport-top, 0px)
  );
  inset-block-end: max(env(safe-area-inset-bottom, 0px), var(--nr-viewport-bottom, 0px));
  left: env(safe-area-inset-left, 0px);
  right: env(safe-area-inset-right, 0px);
  background: var(--nr-reader-paper, var(--dsw-alias-bg-base, #f7efe3));
}
/* Paint over the macOS shell strip; reserve space inside the reader instead
   of exposing the sidebar/titlebar underneath the fullscreen surface. */
html[data-platform='darwin'] .nr-root[data-dsh-reader-fullscreen] {
  --nr-mac-titlebar: var(--dsh-frame-top-clearance, 48px);
  inset: 0; box-sizing: border-box;
  padding-top: max(var(--nr-mac-titlebar), env(safe-area-inset-top, 0px), var(--nr-viewport-top, 0px));
  padding-bottom: max(env(safe-area-inset-bottom, 0px), var(--nr-viewport-bottom, 0px));
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}
html[data-platform='darwin'] .nr-root[data-dsh-reader-fullscreen]::before {
  content: ''; position: absolute; inset: 0 0 auto; height: var(--nr-mac-titlebar);
  -webkit-app-region: drag;
}
html[data-platform='darwin'][data-fullscreen] .nr-root[data-dsh-reader-fullscreen] {
  --nr-mac-titlebar: 0px;
}
.nr-root > iframe { display: block; flex: 1 1 0; min-width: 0; width: 100%; height: 100%; border: 0; }
.nr-reading-status { display: flex; flex-direction: column; gap: 3px; padding: 5px 12px 8px; font-size: 12px; line-height: 1.5; opacity: .8; }
.nr-reading-status span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nr-companion {
  --nr-ui-size: var(--dsh-content-font-size-secondary, 13px);
  --nr-meta-size: calc(var(--nr-ui-size) - 1px);
  --nr-line: color-mix(in srgb, var(--nr-ink) 16%, var(--nr-paper));
  --nr-shade: color-mix(in srgb, var(--nr-accent) 8%, var(--nr-paper));
  --dsw-alias-bg-base: var(--nr-paper);
  --dsw-alias-bg-layer-1: var(--nr-paper);
  --dsw-alias-label-primary: var(--nr-ink);
  --dsw-alias-label-secondary: color-mix(in srgb, var(--nr-ink) 82%, var(--nr-paper));
  --dsw-alias-label-tertiary: color-mix(in srgb, var(--nr-ink) 70%, var(--nr-paper));
  --dsw-alias-border-l: var(--nr-line);
  --dsw-alias-border-l2: var(--nr-line);
  --dsw-alias-border-l3: var(--nr-line);
  --dsw-alias-interactive-bg-hover: var(--nr-shade);
  --dsw-alias-state-business-primary: var(--nr-accent);
  --dsw-alias-button-info-fill: var(--nr-accent);
  --dsw-alias-button-info-hover: color-mix(in srgb, var(--nr-accent) 86%, var(--nr-ink));
  --dsw-specific-input-major: var(--nr-paper);
  --dsw-specific-selector: var(--nr-shade);
  --dsw-specific-bubble: color-mix(in srgb, var(--nr-accent) 13%, var(--nr-paper));
  position: relative; display: flex; flex-direction: column; flex: 0 0 min(60%, 850px);
  min-width: 0; min-height: 0; color: var(--nr-ink); background: var(--nr-paper);
  border-left: 1px solid var(--nr-line);
}
.nr-companion[data-narrow=true] {
  position: absolute; z-index: 10; inset: 0; border: 0;
  transform: var(--nr-sheet-transform, none);
  transition: transform 220ms ease-out;
}
.nr-companion[data-narrow=true][data-nr-sheet-dragging] { transition: none; }
@media (prefers-reduced-motion: reduce) {
  .nr-companion[data-narrow=true] { transition: none; }
}
.nr-rail button, .nr-chat-header button, .nr-handle, .nr-message button, .nr-overlay button {
  border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer;
}
.nr-rail button:disabled, .nr-message button:disabled { opacity: .55; cursor: default; }
.nr-chat-header button:hover, .nr-row-actions button:hover, .nr-overlay button:hover { background: var(--nr-shade); }
.nr-handle { display: grid; place-items: center; flex: none; height: 24px; touch-action: none; cursor: ns-resize; }
.nr-handle span { width: 38px; height: 4px; border-radius: 4px; background: var(--nr-accent); opacity: .65; }
.nr-companion-body { position: relative; display: flex; flex: 1; min-height: 0; }
.nr-rail {
  display: flex; flex-direction: column; flex: 0 0 146px; gap: 5px;
  padding: 10px 8px; min-width: 0; background: var(--nr-shade); border-right: 1px solid var(--nr-line); overflow: auto;
}
.nr-rail, .nr-chat-header { font-size: var(--nr-ui-size); line-height: 1.4; }
.nr-companion[data-narrow=true] .nr-rail {
  position: absolute; z-index: 4; inset: 0 auto 0 0;
  width: min(calc(100% - 64px), clamp(180px, 56%, 280px)); box-sizing: border-box;
  box-shadow: 5px 0 16px color-mix(in srgb, var(--nr-ink) 15%, transparent);
}
.nr-rail-dismiss {
  position: absolute; z-index: 3; inset: 0; border: 0;
  background: color-mix(in srgb, var(--nr-ink) 20%, transparent); cursor: pointer;
}
.nr-rail-title { display: flex; align-items: center; gap: 4px; min-height: 30px; }
.nr-rail-title > button { display: grid; flex: none; place-items: center; width: 26px; height: 28px; }
.nr-rail-title > button:hover { background: var(--nr-paper); border-radius: 5px; }
.nr-rail strong, .nr-session-name, .nr-chat-header strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nr-rail strong, .nr-chat-header strong { font-weight: 600; }
.nr-rail > button { padding: 6px; border: 1px solid var(--nr-line); border-radius: 6px; background: var(--nr-paper); }
.nr-rail-heading { display: flex; align-items: center; justify-content: space-between; font-size: var(--nr-meta-size); color: var(--dsw-alias-label-secondary); padding: 4px; }
.nr-session-row { position: relative; display: flex; align-items: center; border-radius: 5px; }
.nr-session-row[data-selected=true], .nr-session-row:hover { background: color-mix(in srgb, var(--nr-accent) 13%, var(--nr-paper)); }
.nr-session-name { flex: 1; min-width: 0; padding: 6px; text-align: left; }
.nr-row-actions summary { cursor: pointer; list-style: none; padding: 4px; }
.nr-row-actions div {
  position: absolute; z-index: 4; top: 100%; right: 0; display: grid; min-width: 110px;
  border: 1px solid var(--nr-line); border-radius: 6px; background: var(--nr-paper);
}
.nr-row-actions button { padding: 5px 8px; text-align: left; }
.nr-row-actions button:hover { background: var(--nr-shade); }
.nr-chat { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
.nr-companion[data-narrow=true] .nr-chat { isolation: isolate; }
.nr-chat-header { border-bottom: 1px solid var(--nr-line); flex: none; }
.nr-chat-header > div { display: flex; align-items: center; gap: 8px; padding: 0 10px; }
.nr-chat-title-row { min-height: 34px; }
.nr-chat-tabs { min-height: 32px; }
.nr-chat-header button { display: inline-flex; align-items: center; min-height: 28px; border: 0; padding: 4px 6px; white-space: nowrap; }
.nr-chat-header span, .nr-chat-header .nr-spoiler { font-size: var(--nr-meta-size); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.nr-persona-select {
  min-width: 0; min-height: 28px; max-width: min(48%, 13rem); field-sizing: content;
  padding: 3px 4px; border: 1px solid transparent; border-radius: 6px; cursor: pointer;
  background: transparent; color: var(--nr-accent); font: inherit; font-size: var(--nr-meta-size);
  text-overflow: ellipsis;
}
.nr-persona-select:hover, .nr-persona-select:focus-visible { border-color: var(--nr-line); background: var(--nr-shade); }
.nr-persona-select option { color: var(--nr-ink); background: var(--nr-paper); }
.nr-chat-tabs button[aria-pressed] { align-self: stretch; border-bottom: 2px solid transparent; }
.nr-chat-tabs button[aria-pressed=true] { color: var(--nr-accent); border-bottom-color: var(--nr-accent); font-weight: 600; }
.nr-close, .nr-spoiler { margin-left: auto; }
.nr-selected-quote {
  display: flex; align-items: center; gap: 8px; flex: none; padding: 4px 10px;
  border-bottom: 1px solid var(--nr-line); color: var(--nr-accent); font-size: var(--nr-meta-size);
}
.nr-selected-quote span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nr-selected-quote button { border: 0; border-radius: 4px; background: transparent; padding: 3px 7px; cursor: pointer; }
.nr-selected-quote button:hover { background: var(--nr-shade); }
.nr-chat [data-conversation-scroll]:not(:has([data-conversation-composer-overlay])) > [data-composer-seat] { margin-top: auto; }
.nr-chat [aria-label^="访问模式"], .nr-chat [aria-label^="Access mode"] { display: none; }
.nr-message { margin: auto; padding: 12px; text-align: center; }
.nr-message button { padding: 5px 10px; border: 1px solid var(--nr-line); border-radius: 6px; }
.nr-error { padding: 8px; color: var(--nr-accent); }
.nr-overlay {
  position: absolute; z-index: 7; inset: 0; display: grid; place-items: center;
  background: color-mix(in srgb, var(--nr-ink) 23%, transparent);
}
.nr-overlay > :is(section, form) {
  width: min(420px, calc(100% - 24px)); max-height: calc(100% - 24px); overflow: auto;
  border-radius: 10px; border: 1px solid var(--nr-line); padding: 13px;
  color: var(--nr-ink); background: var(--nr-paper);
}
.nr-overlay .nr-close { float: right; padding: 4px; }
.nr-overlay h3 { margin: 0 0 9px; }
.nr-overlay label { display: flex; justify-content: space-between; margin-top: 10px; }
.nr-overlay input[type=checkbox] { accent-color: var(--nr-accent); }
.nr-overlay input:not([type=checkbox]) { display: block; width: 100%; padding: 6px; margin-bottom: 10px; border: 1px solid var(--nr-line); }
.nr-overlay form button { margin-right: 8px; padding: 5px; }
`;
