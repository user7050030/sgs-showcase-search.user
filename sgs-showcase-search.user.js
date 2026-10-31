// ==UserScript==
// @name         三国杀·设置展示搜索
// @namespace    https://
// @version      1.0.0
// @description  在「设置展示」窗口里加一个搜索框，按武将名、皮肤名或拼音过滤列表。
// @author       主页展示皮肤搜索插件
// @match        https://game.4399iw2.com/yxxsgs/*
// @match        *://*.sanguosha.com/10/*
// @match        *://*.sanguosha.com/x/*
// @match        *://*.sanguosha.com/10th/*
// @match        https://wan.baidu.com/*gameId=19793616*
// @match        *://h5.7k7k.com/web/H5GAMES.html?gid=960982bec2f555de44ea43ca8a7ef418/*
// @match        *://qqgame.qq.com/webappframe/?appid=10951
// @match        *://s118.app1107877410.qqopenapp.com/pc/qqLobby_index.php*
// @match        *://sgsszn.wan.360.cn/game_login.php*
// @exclude      *://*.sanguosha.com/220/*
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  if (window.__SGS_SHOWCASE_SEARCH__) return;
  window.__SGS_SHOWCASE_SEARCH__ = true;

  const ROOT_ID = 'sgs-showcase-search';
  const state = {
    root: null, input: null, clear: null,
    win: null, lastView: null, lastVisible: false,
    term: '',
    viewHooked: new WeakSet(),
    winHooked: new WeakSet(),
    positioned: '',
  };

  const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch (_) { return fallback; } };
  const typeOf = node => safe(() => (node.constructor && (node.constructor.__class__ || node.constructor.name)) || '', '');

  function stage() {
    const Laya = window.Laya;
    return Laya && Laya.stage && Laya.stage.numChildren != null ? Laya.stage : null;
  }

  function findWin(root) {
    if (!root) return null;
    let found = null;
    const walk = node => {
      if (found || !node) return;
      if (typeOf(node) === 'NewStyleUserInfoDisplaySettingWindow') {
        if (safe(() => node.visible, false)) found = node;
        return;
      }
      for (let i = 0; i < safe(() => node.numChildren, 0); i++) walk(safe(() => node.getChildAt(i), null));
    };
    walk(root);
    return found;
  }

  function currentView(win) {
    return safe(() => win.viewStack.selectedChild, null) || null;
  }

  function textOf(item, isSkin) {
    if (!item) return '';
    if (isSkin) {
      const skin = item.skinVO || {};
      const base = skin.skinBaseVO || {};
      const general = skin.generalInfo || {};
      return [base.ItemName, base.Searchkey, base.Desc, base.PvName, general.generalName, general.searchkey, general.ShortName, general.PvName]
        .filter(Boolean).join(' ').toLowerCase();
    }
    return [item.generalName, item.searchkey, item.ShortName, item.PvName, item.rolePoint]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function filterView(view) {
    const panel = safe(() => view && view.panel, null);
    if (!panel) return;
    const term = state.term.trim().toLowerCase();
    if (!term) return;
    const data = safe(() => panel.DataProvider, null);
    if (!Array.isArray(data)) return;
    const isSkin = /SkinView/i.test(typeOf(view)) || safe(() => Boolean(data[0] && data[0].skinVO), false);
    // 中文按字词段、拉丁按字母段拆开：允许「陆抗lukang」「月兔 陆抗」这类连写
    const tokens = term.toLowerCase().match(/[\u4e00-\u9fff]+|[a-z0-9]+/g) || [];
    if (!tokens.length) return;
    const filtered = data.filter(item => {
      const hay = textOf(item, isSkin);
      return hay && tokens.every(token => hay.indexOf(token) !== -1);
    });
    panel.DataProvider = filtered;
  }

  function hookView(view) {
    if (!view || state.viewHooked.has(view) || typeof view.UpdatePanel !== 'function') return;
    state.viewHooked.add(view);
    const original = view.UpdatePanel;
    view.UpdatePanel = function () {
      const result = original.apply(this, arguments);
      try { filterView(this); } catch (_) {}
      return result;
    };
  }

  function hookWin(win) {
    if (!win || state.winHooked.has(win)) return;
    state.winHooked.add(win);
    const original = win.onTabClick;
    if (typeof original === 'function') {
      win.onTabClick = function (index) {
        const result = original.apply(this, arguments);
        refresh(120);
        return result;
      };
    }
  }

  function refresh(delay) {
    const task = () => {
      const win = state.win || findWin(stage());
      if (!win) return;
      const view = currentView(win);
      if (!view) return;
      hookView(view);
      try { view.UpdatePanel(); } catch (_) {}
    };
    if (delay) setTimeout(task, delay); else task();
  }

  function installCss() {
    if (window.__SGS_SHOWCASE_SEARCH_CSS__) return;
    const host = document.head || document.documentElement;
    if (!host) return; // 插件在 document-start 注入时 html/head 可能还不存在
    window.__SGS_SHOWCASE_SEARCH_CSS__ = true;
    const css = document.createElement('style');
    css.id = 'sgs-showcase-search-css';
    css.textContent = `
      #${ROOT_ID} {
        position: fixed; z-index: 2147483000; display: none; align-items: center;
        box-sizing: border-box; padding: 0 4px 0 6px; gap: 4px;
        background: linear-gradient(180deg, #f6ead0 0%, #e9d5ac 100%);
        border: 1px solid #8a683c; border-radius: 4px;
        box-shadow: inset 0 1px 3px rgba(120, 82, 32, .32), 0 1px 2px rgba(0, 0, 0, .35);
        font-family: "FZBW", "STKaiti", "KaiTi", "Microsoft YaHei", serif;
      }
      #${ROOT_ID} svg {
        width: 14px; height: 14px; flex: 0 0 auto; fill: none;
        stroke: #7c5a2e; stroke-width: 2; stroke-linecap: round;
      }
      #${ROOT_ID} input {
        flex: 1 1 auto; min-width: 0; height: 100%; margin: 0; padding: 0;
        border: 0; outline: 0; background: transparent;
        color: #4f3427; font: inherit; letter-spacing: .5px;
      }
      #${ROOT_ID} input::placeholder { color: #8b7357; }
      #${ROOT_ID} button {
        flex: 0 0 auto; display: none; width: 18px; height: 18px; margin: 0; padding: 0;
        border: 0; background: transparent; color: #7a5a32; cursor: pointer;
        font: inherit; font-size: 16px; line-height: 18px;
      }
      #${ROOT_ID} button:hover { color: #3f2a16; }
    `;
    host.appendChild(css);
  }

  function ensureUi() {
    if (state.root || !document.body) return;
    installCss();
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"></circle><path d="M15 15l5 5"></path></svg><input type="text" spellcheck="false" autocomplete="off" placeholder="搜索武将 / 皮肤 / 拼音"><button type="button" aria-label="清空搜索">×</button>';
    document.body.appendChild(root);
    state.root = root;
    state.input = root.querySelector('input');
    state.clear = root.querySelector('button');

    const input = state.input;
    const stop = event => event.stopPropagation();
    for (const type of ['keydown', 'keypress', 'keyup', 'mousedown', 'pointerdown']) input.addEventListener(type, stop);
    root.addEventListener('mousedown', stop);
    root.addEventListener('pointerdown', stop);

    const apply = () => {
      state.term = input.value || '';
      state.clear.style.display = state.term ? 'block' : 'none';
      refresh();
    };
    input.addEventListener('input', apply);
    input.addEventListener('compositionend', apply);
    state.clear.addEventListener('click', () => {
      input.value = '';
      apply();
      input.focus();
    });
  }

  function position(win) {
    const canvas = document.getElementById('layaCanvas') || document.querySelector('canvas');
    const Laya = window.Laya;
    if (!canvas || !Laya || !Laya.stage || !state.root) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scaleX = rect.width / Laya.stage.width;
    const scaleY = rect.height / Laya.stage.height;
    const point = win.localToGlobal(new Laya.Point(700, 10));
    const left = rect.left + point.x * scaleX;
    const top = rect.top + point.y * scaleY;
    const width = 280 * scaleX;
    const height = 30 * scaleY;
    const key = [left, top, width, height].map(v => Math.round(v * 100) / 100).join('|');
    if (key === state.positioned) return;
    state.positioned = key;
    const style = state.root.style;
    style.left = `${left}px`;
    style.top = `${top}px`;
    style.width = `${width}px`;
    style.height = `${height}px`;
    style.fontSize = `${Math.max(12, Math.round(16 * scaleX * 10) / 10)}px`;
  }

  function tick() {
    const rootStage = stage();
    if (!rootStage) return;
    let win = findWin(rootStage);
    state.win = win;
    if (!win) {
      if (state.root) state.root.style.display = 'none';
      if (state.lastVisible) {
        state.lastVisible = false;
        state.term = '';
        state.lastView = null;
        if (state.input) state.input.value = '';
        if (state.clear) state.clear.style.display = 'none';
      }
      return;
    }
    ensureUi();
    if (!state.root) return;
    state.root.style.display = 'flex';
    position(win);
    hookWin(win);
    const view = currentView(win);
    if (view) {
      hookView(view);
      if (!state.lastVisible || view !== state.lastView) {
        state.lastView = view;
        // 打开窗口/切页时重新取一次完整数据，再把当前搜索词加上去
        refresh(60);
      }
    }
    if (!state.lastVisible) {
      state.lastVisible = true;
      refresh(80);
    }
  }

  setInterval(tick, 250);
})();
