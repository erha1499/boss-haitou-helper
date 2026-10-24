export const UI_ICONS = {
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 1.8-2.5 3.5M12 16.5h.01"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6l-3 4v2h10v-2l-3-4V3M12 15v6"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  github: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.1-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2.2"/></svg>',
  wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 20 10-10M14 4v2M14 12v2M10 8h2M18 8h2M17 5l1-1M17 11l1 1"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h5m4 0h7M4 17h7m4 0h5"/><circle cx="11" cy="7" r="2"/><circle cx="13" cy="17" r="2"/></svg>',
};

// 脚本图标：纸飞机（投递）飞过波浪（海投），和脚本头 @icon 是同一套图形。
// 白色图形，放在蓝色渐变底的方块或圆点里；投递中纸飞机和波浪会动（见 styles.js 的 zdl-plane / zdl-wave）。
export const SVG_ICON = `<svg class="zdl-logo" viewBox="7 9 50 50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:100%;height:100%;display:block">
<g class="zdl-plane"><path d="M13 31.5 51 15 42.5 45.5 32.5 37.5Z" fill="#fff"/><path d="M32.5 37.5 51 15 28 34.5 29 44Z" fill="#cfdcff"/></g>
<path class="zdl-wave" d="M11 52.5c4.3-3.6 8.7-3.6 13 0s8.7 3.6 13 0 8.7-3.6 13 0" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" opacity=".85"/>
</svg>`;
