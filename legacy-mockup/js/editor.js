/* ============================================================
   Визуальный редактор макета.
   Позволяет менять тему (токены) и отдельные элементы прямо на странице.
   Всё сохраняется в localStorage и в файл настроек (экспорт/импорт).
   ============================================================ */
window.Editor = (function () {
  'use strict';

  var KEY = 'cpiaz-mockup-settings-v1';

  var TOKENS = [
    { v: '--c-primary', t: 'Цвет кнопок и ссылок', type: 'color', group: 'Цвета' },
    { v: '--c-primary-ink', t: 'Текст на кнопках', type: 'color', group: 'Цвета' },
    { v: '--c-accent', t: 'Акцентный цвет', type: 'color', group: 'Цвета' },
    { v: '--c-bg', t: 'Фон страницы', type: 'color', group: 'Цвета' },
    { v: '--c-surface', t: 'Фон карточек и шапки', type: 'color', group: 'Цвета' },
    { v: '--c-surface-2', t: 'Фон вторичных блоков', type: 'color', group: 'Цвета' },
    { v: '--c-text', t: 'Цвет основного текста', type: 'color', group: 'Цвета' },
    { v: '--c-muted', t: 'Цвет второстепенного текста', type: 'color', group: 'Цвета' },
    { v: '--c-border', t: 'Цвет рамок', type: 'color', group: 'Цвета' },

    { v: '--font-base', t: 'Размер основного шрифта', type: 'num', min: 12, max: 22, step: 0.5, unit: 'px', group: 'Типографика' },
    { v: '--container', t: 'Ширина контента', type: 'num', min: 760, max: 1600, step: 20, unit: 'px', group: 'Типографика' },
    { v: '--radius', t: 'Скругление карточек', type: 'num', min: 0, max: 40, step: 1, unit: 'px', group: 'Типографика' },

    { v: '--btn-py', t: 'Кнопки: отступ сверху/снизу', type: 'num', min: 2, max: 30, step: 1, unit: 'px', group: 'Кнопки' },
    { v: '--btn-px', t: 'Кнопки: отступ слева/справа (ширина)', type: 'num', min: 4, max: 60, step: 1, unit: 'px', group: 'Кнопки' },
    { v: '--btn-radius', t: 'Кнопки: скругление', type: 'num', min: 0, max: 30, step: 1, unit: 'px', group: 'Кнопки' },
    { v: '--btn-font', t: 'Кнопки: размер текста', type: 'num', min: 11, max: 24, step: 1, unit: 'px', group: 'Кнопки' },
    { v: '--btn-weight', t: 'Кнопки: жирность', type: 'choice', options: [['400', 'Обычная'], ['500', 'Средняя'], ['600', 'Полужирная'], ['700', 'Жирная'], ['800', 'Очень жирная']], group: 'Кнопки' },
    { v: '--btn-justify', t: 'Кнопки: расположение в блоке', type: 'choice', options: [['flex-start', 'Слева'], ['center', 'По центру'], ['flex-end', 'Справа'], ['space-between', 'По краям'], ['space-around', 'Равномерно']], group: 'Кнопки' }
  ];

  var PRESETS = {
    'Светлая (по умолчанию)': {
      '--c-primary': '#2f6df6', '--c-primary-ink': '#ffffff', '--c-accent': '#12b886', '--c-bg': '#f4f6fb',
      '--c-surface': '#ffffff', '--c-surface-2': '#eef2f9', '--c-text': '#16202e', '--c-muted': '#5d6b80',
      '--c-border': '#dde4ef', '--font-base': '15px', '--container': '1200px', '--radius': '12px',
      '--btn-py': '10px', '--btn-px': '18px', '--btn-radius': '10px', '--btn-font': '15px',
      '--btn-weight': '600', '--btn-justify': 'flex-start'
    },
    'Тёмная': {
      '--c-primary': '#5b8dff', '--c-primary-ink': '#0d1420', '--c-accent': '#2ee6a8', '--c-bg': '#0f1621',
      '--c-surface': '#182231', '--c-surface-2': '#22303f', '--c-text': '#e8eef7', '--c-muted': '#9fb0c4',
      '--c-border': '#2b394b', '--font-base': '15px', '--container': '1200px', '--radius': '14px',
      '--btn-py': '11px', '--btn-px': '22px', '--btn-radius': '999px', '--btn-font': '15px',
      '--btn-weight': '600', '--btn-justify': 'flex-start'
    },
    'Вузовская классика': {
      '--c-primary': '#0b3d91', '--c-primary-ink': '#ffffff', '--c-accent': '#b8860b', '--c-bg': '#f6f4ef',
      '--c-surface': '#ffffff', '--c-surface-2': '#efeae0', '--c-text': '#1d2330', '--c-muted': '#6b6355',
      '--c-border': '#ddd4c4', '--font-base': '16px', '--container': '1180px', '--radius': '4px',
      '--btn-py': '12px', '--btn-px': '26px', '--btn-radius': '4px', '--btn-font': '16px',
      '--btn-weight': '700', '--btn-justify': 'center'
    },
    'Мягкая зелёная': {
      '--c-primary': '#0f9d58', '--c-primary-ink': '#ffffff', '--c-accent': '#f4b400', '--c-bg': '#f2f8f4',
      '--c-surface': '#ffffff', '--c-surface-2': '#e6f2ea', '--c-text': '#14251c', '--c-muted': '#557064',
      '--c-border': '#d3e6da', '--font-base': '15px', '--container': '1240px', '--radius': '18px',
      '--btn-py': '12px', '--btn-px': '24px', '--btn-radius': '999px', '--btn-font': '15px',
      '--btn-weight': '600', '--btn-justify': 'flex-start'
    }
  };

  var state = { editing: false, tab: 'theme', selected: null, data: emptyData() };

  function emptyData() { return { version: 1, tokens: {}, elements: {}, texts: {} }; }

  /* ---------- утилиты ---------- */

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toHex(color) {
    if (!color) return '#000000';
    if (color.charAt(0) === '#') return color.length === 4
      ? '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
      : color;
    var m = color.match(/rgba?\(([^)]+)\)/);
    if (!m) return '#000000';
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    if (p.length > 3 && p[3] === 0) return '';
    return '#' + [p[0], p[1], p[2]].map(function (x) {
      var s = clamp(Math.round(x), 0, 255).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }

  function cssPath(el) {
    var parts = [], cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body) {
      var i = 1, sib = cur;
      while ((sib = sib.previousElementSibling)) i++;
      parts.unshift(cur.tagName.toLowerCase() + ':nth-child(' + i + ')');
      cur = cur.parentElement;
    }
    return 'path:' + parts.join('>');
  }

  function resolvePath(key) {
    try { return document.body.querySelector(key.slice(5)); } catch (e) { return null; }
  }

  function keyOf(el) {
    if (!el || el.nodeType !== 1 || el === document.body) return null;
    return el.getAttribute('data-eid') || cssPath(el);
  }

  function findByKey(key) {
    if (!key) return null;
    if (key.indexOf('path:') === 0) return resolvePath(key);
    return document.querySelector('[data-eid="' + key.replace(/"/g, '\\"') + '"]');
  }

  function labelOf(el) {
    if (el.getAttribute('data-elabel')) return el.getAttribute('data-elabel');
    var cls = (typeof el.className === 'string' ? el.className : '').split(' ')
      .filter(function (c) { return c && c !== 'ed-selected'; })[0];
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  }

  function shortText(el) {
    var t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.length > 34 ? t.slice(0, 34) + '…' : t;
  }

  function ancestorsOf(el) {
    var chain = [], cur = el.parentElement;
    while (cur && cur !== document.body) {
      chain.push(cur);
      cur = cur.parentElement;
    }
    if (cur === document.body) chain.push(cur);
    return chain;
  }

  function kidsOf(el) {
    return Array.prototype.slice.call(el.children).filter(function (c) { return c.nodeType === 1; });
  }

  function onlyText(el) {
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 1) return false;
    }
    return el.textContent.trim().length > 0;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state.data)); }
    catch (e) { /* файловая система может запрещать localStorage */ }
  }

  function mergeInto(target, src) {
    if (!src) return target;
    ['tokens', 'elements', 'texts'].forEach(function (k) {
      Object.keys(src[k] || {}).forEach(function (key) { target[k][key] = src[k][key]; });
    });
    return target;
  }

  /* Настройки берутся в порядке: база, вшитая в скачанную копию файла → localStorage (приоритетнее) */
  function load() {
    var saved = null;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (e) { saved = null; }
    state.data = mergeInto(emptyData(), window.__BAKED_SETTINGS__);
    if (saved && typeof saved === 'object') mergeInto(state.data, saved);
  }

  function changedCount() {
    return Object.keys(state.data.tokens).length + Object.keys(state.data.elements).length + Object.keys(state.data.texts).length;
  }

  /* ---------- применение настроек ---------- */

  function applyTokens() {
    var root = document.documentElement;
    TOKENS.forEach(function (tok) {
      var val = state.data.tokens[tok.v];
      if (val === undefined || val === null || val === '') root.style.removeProperty(tok.v);
      else root.style.setProperty(tok.v, val);
    });
  }

  function applyElements() {
    Object.keys(state.data.elements).forEach(function (key) {
      var el = findByKey(key);
      if (el && state.data.elements[key]) el.style.cssText = state.data.elements[key];
    });
    Object.keys(state.data.texts).forEach(function (key) {
      var el = findByKey(key);
      if (el && typeof state.data.texts[key] === 'string') el.textContent = state.data.texts[key];
    });
  }

  function afterRender() {
    applyElements();
    if (state.selected) {
      var el = findByKey(state.selected.key);
      if (el) { el.classList.add('ed-selected'); state.selected.el = el; }
      else { state.selected = null; if (state.editing) renderPanel(); }
    }
  }

  /* ---------- панель ---------- */

  function el(id) { return document.getElementById(id); }

  function buildShell() {
    var d = document.createElement('aside');
    d.id = 'editor-panel';
    d.className = 'ed-drawer';
    d.setAttribute('data-eid', 'editor-panel');
    d.innerHTML =
      '<div class="ed-drawer__head">' +
        '<div><div class="ed-target-name">Редактор макета</div>' +
        '<div class="small muted">Изменения сохраняются автоматически</div></div>' +
        '<button class="modal__close" id="ed-close" title="Свернуть панель">×</button>' +
      '</div>' +
      '<div class="ed-drawer__tabs">' +
        '<button data-tab="theme">Тема</button>' +
        '<button data-tab="element">Элемент</button>' +
      '</div>' +
      '<div class="ed-drawer__body" id="ed-body"></div>' +
      '<div class="ed-drawer__foot">' +
        '<div class="row row--between small muted"><span>Изменений: <b id="ed-count">0</b></span>' +
        '<span id="ed-storage" class="small muted"></span></div>' +
        '<div class="btn-row">' +
          '<button class="btn btn--soft btn--sm" id="ed-export">Экспорт</button>' +
          '<button class="btn btn--soft btn--sm" id="ed-import">Импорт</button>' +
          '<button class="btn btn--soft btn--sm" id="ed-bake" title="Скачать копию макета с текущими настройками">Скачать HTML</button>' +
          '<button class="btn btn--danger btn--sm" id="ed-reset">Сбросить всё</button>' +
        '</div>' +
        '<input type="file" id="ed-file" accept="application/json" hidden>' +
        '<div class="ed-hint" id="ed-tip">Включён режим редактирования: кликните по любому блоку страницы, чтобы настроить его. Ссылки при этом не переходят.</div>' +
      '</div>';
    document.body.appendChild(d);
  }

  function renderPanel() {
    var body = el('ed-body');
    if (!body) return;
    body.innerHTML = state.tab === 'theme' ? themeHtml() : elementHtml();
    el('ed-count').textContent = changedCount();
    var tabs = document.querySelectorAll('.ed-drawer__tabs button');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-tab') === state.tab);
    }
    if (state.tab === 'element') bindElementControls();
    else bindThemeControls();
  }

  function themeHtml() {
    var groups = {}, order = [];
    TOKENS.forEach(function (t) {
      if (!groups[t.group]) { groups[t.group] = []; order.push(t.group); }
      groups[t.group].push(t);
    });
    var html = '<div class="ed-group"><h4>Готовые темы</h4><div class="btn-row">';
    Object.keys(PRESETS).forEach(function (name) {
      html += '<button class="btn btn--soft btn--sm" data-preset="' + name + '">' + name + '</button>';
    });
    html += '</div></div>';

    order.forEach(function (g) {
      html += '<div class="ed-group"><h4>' + g + '</h4>';
      groups[g].forEach(function (t) {
        var cur = state.data.tokens[t.v] || getComputedStyle(document.documentElement).getPropertyValue(t.v).trim();
        if (t.type === 'color') {
          html += '<div class="ed-field"><label>' + t.t + '</label>' +
            '<input type="color" data-token-color="' + t.v + '" value="' + (toHex(cur) || '#ffffff') + '"></div>';
        } else if (t.type === 'num') {
          var num = parseFloat(cur) || 0;
          html += '<div class="ed-field"><label>' + t.t + ', ' + (t.unit || '') + '</label>' +
            '<input class="ed-num" type="number" data-token-num="' + t.v + '" min="' + t.min + '" max="' + t.max + '" step="' + (t.step || 1) + '" value="' + num + '" data-unit="' + (t.unit || '') + '">' +
            '<input type="range" data-token-range="' + t.v + '" min="' + t.min + '" max="' + t.max + '" step="' + (t.step || 1) + '" value="' + num + '"></div>';
        } else {
          html += '<div class="ed-field"><label>' + t.t + '</label><select data-token-choice="' + t.v + '">';
          t.options.forEach(function (o) {
            html += '<option value="' + o[0] + '"' + (String(cur) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
          });
          html += '</select></div>';
        }
      });
      html += '</div>';
    });
    html += '<div class="ed-hint">Тема применяется ко всему макету сразу. Для точечных правок используйте вкладку «Элемент».</div>';
    return html;
  }

  function elementHtml() {
    if (!state.selected) {
      return '<div class="ed-group"><h4>Элемент</h4>' +
        '<div class="ed-empty">Кликните по любому месту страницы — по тексту, кнопке, заголовку, карточке — и здесь появятся настройки именно этого элемента.</div>' +
        '</div><div class="ed-hint">Выбирается самый вложенный элемент под курсором. Чтобы подняться выше — блок «Родительские блоки» внизу или кнопка «Выбрать родителя».</div>';
    }
    var el0 = findByKey(state.selected.key);
    if (!el0) { state.selected = null; return elementHtml(); }
    var cs = getComputedStyle(el0);
    var isText = onlyText(el0);
    var align = cs.alignSelf && cs.alignSelf !== 'auto' ? cs.alignSelf : (el0.style.marginLeft === 'auto' && el0.style.marginRight === 'auto' ? 'center' : 'none');

    var html = '<div class="ed-group"><h4>Выбранный элемент</h4>' +
      '<div class="ed-target-name">' + labelOf(el0) + '</div>' +
      '<div class="small muted">&lt;' + el0.tagName.toLowerCase() + '&gt; · ключ: ' + state.selected.key + '</div></div>';

    var chain = ancestorsOf(el0);
    if (chain.length) {
      html += '<div class="ed-group"><h4>Родительские блоки</h4><div class="btn-row">' +
        chain.slice(0, 6).map(function (a) {
          var k = keyOf(a);
          if (!k) return '';
          return '<button class="btn btn--soft btn--sm" data-el-ancestor="' + k.replace(/"/g, '') + '" title="' + esc(k) + '">' +
            labelOf(a) + '</button>';
        }).join('') + '</div></div>';
    }

    html += '<div class="ed-group"><h4>Цвета</h4>' +
      '<div class="ed-field"><label>Фон</label><input type="color" data-el="backgroundColor" value="' + (toHex(cs.backgroundColor) || '#ffffff') + '"></div>' +
      '<div class="ed-field"><label>Цвет текста</label><input type="color" data-el="color" value="' + (toHex(cs.color) || '#000000') + '"></div>' +
      '<div class="ed-field"><label>Цвет рамки</label><input type="color" data-el="borderColor" value="' + (toHex(cs.borderTopColor) || '#dddddd') + '"></div>' +
      '<div class="btn-row"><button class="btn btn--soft btn--sm" data-el-set="backgroundColor:transparent">Прозрачный фон</button>' +
      '<button class="btn btn--soft btn--sm" data-el-set="borderWidth:0px">Убрать рамку</button></div></div>';

    html += '<div class="ed-group"><h4>Текст и размер</h4>' +
      '<div class="ed-field"><label>Размер шрифта, px</label><input class="ed-num" type="number" min="8" max="48" step="1" data-el="fontSize" value="' + (parseFloat(cs.fontSize) || 15) + '"></div>' +
      '<div class="ed-field"><label>Жирность</label><select data-el="fontWeight">' +
        [['400', 'Обычная'], ['500', 'Средняя'], ['600', 'Полужирная'], ['700', 'Жирная'], ['800', 'Очень жирная']].map(function (o) {
          return '<option value="' + o[0] + '"' + (String(cs.fontWeight) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select></div>' +
      '<div class="ed-field"><label>Отступы внутри, px (X / Y)</label><span></span>' +
        '<input class="ed-num" type="number" min="0" max="80" step="1" data-el="paddingLeft" value="' + (parseFloat(cs.paddingLeft) || 0) + '">' +
        '<input class="ed-num" type="number" min="0" max="80" step="1" data-el="paddingTop" value="' + (parseFloat(cs.paddingTop) || 0) + '"></div>' +
      '<div class="ed-field"><label>Скругление, px</label><input class="ed-num" type="number" min="0" max="60" step="1" data-el="borderRadius" value="' + (parseFloat(cs.borderTopLeftRadius) || 0) + '"></div>' +
      '<div class="ed-field"><label>Ширина (px, %, auto)</label><input type="text" data-el="width" value="' + (el0.style.width || '') + '" placeholder="auto"></div>' +
      '<div class="ed-field"><label>Мин. высота, px</label><input class="ed-num" type="number" min="0" max="400" step="1" data-el="minHeight" value="' + (el0.style.minHeight ? parseFloat(el0.style.minHeight) : '') + '" placeholder="авто"></div>' +
      '<div class="ed-field"><label>Тень</label><select data-el-shadow="1">' +
        '<option value="">Как в макете</option><option value="none">Без тени</option>' +
        '<option value="0 6px 22px rgba(20,35,60,.08)">Мягкая</option>' +
        '<option value="0 14px 34px rgba(20,35,60,.22)">Сильная</option></select></div>' +
      '</div>';

    html += '<div class="ed-group"><h4>Расположение</h4>' +
      '<div class="ed-field"><label>Выравнивание в блоке</label><select data-el-align="' + align + '">' +
        [['none', 'Как в макете'], ['flex-start', 'Слева'], ['center', 'По центру'], ['flex-end', 'Справа'], ['stretch', 'Растянуть']].map(function (o) {
          return '<option value="' + o[0] + '"' + (align === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select></div>' +
      '<div class="ed-field"><label>Сдвиг вправо, px</label><input class="ed-num" type="number" min="-400" max="400" step="1" data-el-shift="x" value="0"></div>' +
      '<div class="ed-field"><label>Сдвиг вниз, px</label><input class="ed-num" type="number" min="-400" max="400" step="1" data-el-shift="y" value="0"></div>' +
      '<div class="btn-row"><button class="btn btn--soft btn--sm" data-el-move="-1">Выше</button>' +
      '<button class="btn btn--soft btn--sm" data-el-move="1">Ниже</button>' +
      '<button class="btn btn--soft btn--sm" data-el-parent="1">Выбрать родителя</button></div></div>';

    if (isText) {
      html += '<div class="ed-group"><h4>Текст</h4>' +
        '<textarea data-el-text="1">' + esc(el0.textContent.trim()) + '</textarea>' +
        '<div class="ed-hint">Меняется только текст этого элемента, оформление сохраняется.</div></div>';
    } else {
      var kids = kidsOf(el0);
      html += '<div class="ed-group"><h4>Текст</h4><div class="ed-hint">' +
        (kids.length ? 'В этом блоке есть вложенные элементы — выберите тот, чей текст нужно изменить:' : 'У этого элемента нет собственного текста.') +
        '</div>';
      if (kids.length) {
        html += '<div class="btn-row">' + kids.slice(0, 12).map(function (k, i) {
          var kk = keyOf(k);
          if (!kk) return '';
          return '<button class="btn btn--soft btn--sm" data-el-child="' + i + '" title="' + esc(shortText(k) || k.tagName.toLowerCase()) + '">' +
            k.tagName.toLowerCase() + (shortText(k) ? ': ' + esc(shortText(k)) : '') + '</button>';
        }).join('') + '</div>';
      }
      html += '</div>';
    }

    html += '<div class="ed-group"><div class="btn-row">' +
      '<button class="btn btn--danger btn--sm" id="ed-el-reset">Сбросить элемент</button>' +
      '<button class="btn btn--soft btn--sm" id="ed-deselect">Снять выбор</button></div></div>';
    return html;
  }

  function bindThemeControls() {
    var body = el('ed-body');
    body.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = PRESETS[b.getAttribute('data-preset')];
        Object.keys(p).forEach(function (k) { state.data.tokens[k] = p[k]; });
        applyTokens(); save(); renderPanel(); tip('Тема «' + b.getAttribute('data-preset') + '» применена');
      });
    });
    body.querySelectorAll('[data-token-color]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var v = inp.getAttribute('data-token-color');
        state.data.tokens[v] = inp.value; applyTokens(); save(); el('ed-count').textContent = changedCount();
      });
    });
    body.querySelectorAll('[data-token-num]').forEach(function (inp) {
      var v = inp.getAttribute('data-token-num');
      var range = body.querySelector('[data-token-range="' + v + '"]');
      var apply = function (val) {
        state.data.tokens[v] = val + inp.getAttribute('data-unit');
        applyTokens(); save(); el('ed-count').textContent = changedCount();
        if (range) range.value = parseFloat(val);
        inp.value = parseFloat(val);
      };
      inp.addEventListener('input', function () { apply(inp.value); });
      if (range) range.addEventListener('input', function () { apply(range.value); });
    });
    body.querySelectorAll('[data-token-choice]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        state.data.tokens[sel.getAttribute('data-token-choice')] = sel.value;
        applyTokens(); save(); el('ed-count').textContent = changedCount();
      });
    });
  }

  function currentEl() { return state.selected ? findByKey(state.selected.key) : null; }

  function persistElement(elm) {
    var key = state.selected.key;
    state.data.elements[key] = elm.style.cssText;
    save();
    el('ed-count').textContent = changedCount();
  }

  function bindElementControls() {
    var body = el('ed-body');
    var elm = currentEl();
    if (!elm) return;

    body.querySelectorAll('[data-el]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var prop = inp.getAttribute('data-el');
        var val = inp.value;
        if (prop === 'fontSize' || prop === 'paddingLeft' || prop === 'paddingTop' ||
            prop === 'borderRadius' || prop === 'minHeight') {
          if (val === '') elm.style.removeProperty(prop.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }));
          else elm.style[prop] = val + 'px';
        } else {
          elm.style[prop] = val;
        }
        if (prop === 'backgroundColor') elm.style.background = val;
        persistElement(elm);
      });
    });

    var shadow = body.querySelector('[data-el-shadow]');
    if (shadow) shadow.addEventListener('change', function () {
      if (shadow.value) elm.style.boxShadow = shadow.value;
      else elm.style.removeProperty('box-shadow');
      persistElement(elm);
    });

    var align = body.querySelector('[data-el-align]');
    if (align) align.addEventListener('change', function () {
      var v = align.value;
      elm.style.removeProperty('margin-left');
      elm.style.removeProperty('margin-right');
      elm.style.removeProperty('width');
      if (v === 'none') elm.style.removeProperty('align-self');
      else if (v === 'center') { elm.style.alignSelf = 'center'; if (elm.style.display === 'inline-flex' || elm.tagName === 'BUTTON' || elm.tagName === 'A') elm.style.marginLeft = 'auto'; }
      else if (v === 'flex-end') { elm.style.alignSelf = 'flex-end'; elm.style.marginLeft = 'auto'; }
      else if (v === 'stretch') { elm.style.alignSelf = 'stretch'; elm.style.width = '100%'; }
      else { elm.style.alignSelf = v; }
      persistElement(elm);
      tip('Выравнивание обновлено');
    });

    body.querySelectorAll('[data-el-shift]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var x = parseFloat(body.querySelector('[data-el-shift="x"]').value) || 0;
        var y = parseFloat(body.querySelector('[data-el-shift="y"]').value) || 0;
        elm.style.transform = (x || y) ? 'translate(' + x + 'px,' + y + 'px)' : '';
        if (!x && !y) elm.style.removeProperty('transform');
        persistElement(elm);
      });
    });

    body.querySelectorAll('[data-el-set]').forEach(function (b) {
      b.addEventListener('click', function () {
        var raw = b.getAttribute('data-el-set');
        var p = raw.split(':'), prop = p[0], val = p[1];
        elm.style[prop] = val;
        if (prop === 'backgroundColor') elm.style.background = val;
        persistElement(elm); renderPanel();
      });
    });

    body.querySelectorAll('[data-el-move]').forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = parseInt(b.getAttribute('data-el-move'), 10);
        var parent = elm.parentElement;
        if (!parent) return;
        if (dir < 0 && elm.previousElementSibling) parent.insertBefore(elm, elm.previousElementSibling);
        else if (dir > 0 && elm.nextElementSibling) parent.insertBefore(elm.nextElementSibling, elm);
        else { tip('Больше двигать некуда', 'warn'); return; }
        state.data.elements[state.selected.key] = elm.style.cssText;
        save(); renderPanel();
      });
    });

    var parentBtn = body.querySelector('[data-el-parent]');
    if (parentBtn) parentBtn.addEventListener('click', function () {
      select(elm.parentElement);
    });

    body.querySelectorAll('[data-el-ancestor]').forEach(function (b) {
      b.addEventListener('click', function () {
        var target = findByKey(b.getAttribute('data-el-ancestor'));
        if (target) select(target);
      });
    });

    body.querySelectorAll('[data-el-child]').forEach(function (b) {
      b.addEventListener('click', function () {
        var kids = kidsOf(elm);
        var kid = kids[parseInt(b.getAttribute('data-el-child'), 10)];
        if (kid) select(kid);
      });
    });

    var ta = body.querySelector('[data-el-text]');
    if (ta) ta.addEventListener('input', function () {
      elm.textContent = ta.value;
      state.data.texts[state.selected.key] = ta.value;
      save(); el('ed-count').textContent = changedCount();
    });

    var resetBtn = el('ed-el-reset');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      var key = state.selected.key;
      elm.style.cssText = '';
      delete state.data.elements[key];
      delete state.data.texts[key];
      save();
      window.dispatchEvent(new Event('hashchange'));
      afterRender();
      renderPanel();
      tip('Элемент возвращён к исходному виду');
    });

    var desel = el('ed-deselect');
    if (desel) desel.addEventListener('click', function () {
      if (state.selected && state.selected.el) state.selected.el.classList.remove('ed-selected');
      state.selected = null; renderPanel();
    });
  }

  function select(elm) {
    if (!elm || elm.nodeType !== 1) return;
    if (elm.closest('#editor-panel')) return;
    if (state.selected && state.selected.el) state.selected.el.classList.remove('ed-selected');
    var key = keyOf(elm);
    if (!key) return;
    state.selected = { key: key, el: elm };
    elm.classList.add('ed-selected');
    state.tab = 'element';
    openPanel(true);
    renderPanel();
  }

  function openPanel(open) {
    var p = el('editor-panel');
    if (!p) return;
    p.classList.toggle('is-open', open !== false);
  }

  function tip(text, kind) {
    if (window.toast) window.toast(text, kind);
  }

  /* ---------- включение / выключение ---------- */

  function setEditing(on) {
    state.editing = on;
    document.body.classList.toggle('editing', on);
    var btn = el('ed-toggle');
    if (btn) {
      btn.textContent = on ? 'Выйти из редактора' : 'Редактировать вид';
      btn.classList.toggle('btn--ok', on);
      btn.classList.toggle('btn--soft', !on);
    }
    var header = document.querySelector('.app-header');
    if (header) header.style.paddingRight = on && window.innerWidth > 1000 ? '344px' : '';
    var main = document.querySelector('.app-main');
    if (main) main.style.maxWidth = on && window.innerWidth > 1000 ? 'calc(var(--container) - 120px)' : '';
    var footer = document.querySelector('.app-footer__inner');
    if (footer) footer.style.paddingRight = on && window.innerWidth > 1000 ? '344px' : '';
    openPanel(on);
    if (on) {
      if (!state.selected) state.tab = 'theme';
      renderPanel();
      tip('Режим редактирования включён: кликайте по блокам страницы', 'ok');
    }
  }

  function onDocumentClick(e) {
    if (!state.editing) return;
    if (e.target.closest('#editor-panel')) return;
    var t = e.target;
    if (!t || t.nodeType !== 1) return;
    if (t === document.body || t === document.documentElement) return;
    e.preventDefault();
    e.stopPropagation();
    select(t);
  }

  function onDocumentMouseDown(e) {
    if (!state.editing) return;
    if (e.target.closest('#editor-panel')) return;
    e.preventDefault();
  }

  /* ---------- экспорт / импорт / закачка ---------- */

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function exportSettings() {
    download('cpiaz-mockup-settings.json', JSON.stringify(state.data, null, 2));
    tip('Файл настроек сохранён', 'ok');
  }

  function importSettings(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        state.data = { version: 1, tokens: parsed.tokens || {}, elements: parsed.elements || {}, texts: parsed.texts || {} };
        applyTokens(); afterRender(); renderPanel(); save();
        tip('Настройки загружены', 'ok');
      } catch (err) { tip('Не удалось прочитать файл настроек', 'warn'); }
    };
    reader.readAsText(file);
  }

  function bakeHtml() {
    var clone = document.documentElement.cloneNode(true);
    var panelClone = clone.querySelector('#editor-panel'); if (panelClone) panelClone.remove();
    ['#modal-root', '#toasts'].forEach(function (sel) {
      var n = clone.querySelector(sel); if (n) n.innerHTML = '';
    });
    ['.app-header__inner', '.app-main', '.app-footer__inner'].forEach(function (sel) {
      var n = clone.querySelector(sel); if (n) n.removeAttribute('style');
    });
    var view = clone.querySelector('#view'); if (view) view.innerHTML = '';
    var nav = clone.querySelector('#nav'); if (nav) nav.innerHTML = '';
    var attrs = clone.querySelector('#header-tools'); if (attrs) attrs.innerHTML = '';
    var bodyClone = clone.querySelector('body'); if (bodyClone) bodyClone.classList.remove('editing');

    var head = clone.querySelector('head');
    var script = document.createElement('script');
    script.textContent = 'window.__BAKED_SETTINGS__ = ' + JSON.stringify({
      tokens: state.data.tokens, elements: state.data.elements, texts: state.data.texts
    }) + ';';
    head.appendChild(script);

    var html = '<!DOCTYPE html>\n' + clone.outerHTML;
    download('index.html', html, 'text/html;charset=utf-8');
    tip('Скачана копия макета с текущими настройками', 'ok');
  }

  /* ---------- инициализация ---------- */

  function init() {
    load();
    buildShell();
    applyTokens();
    applyElements();

    var p = el('editor-panel');
    p.querySelectorAll('.ed-drawer__tabs button').forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); renderPanel(); });
    });
    el('ed-close').addEventListener('click', function () { openPanel(false); });
    el('ed-reset').addEventListener('click', function () {
      if (!confirm('Сбросить все визуальные изменения и вернуть исходный вид макета?')) return;
      state.data = emptyData(); state.selected = null;
      try { localStorage.removeItem(KEY); } catch (e) {}
      document.documentElement.removeAttribute('style');
      applyTokens();
      window.dispatchEvent(new Event('hashchange'));
      afterRender(); renderPanel();
      tip('Все изменения сброшены', 'ok');
    });
    el('ed-export').addEventListener('click', exportSettings);
    el('ed-import').addEventListener('click', function () { el('ed-file').click(); });
    el('ed-file').addEventListener('change', function () {
      if (this.files && this.files[0]) importSettings(this.files[0]);
      this.value = '';
    });
    el('ed-bake').addEventListener('click', bakeHtml);

    renderPanel();

    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('mousedown', onDocumentMouseDown, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.editing) {
        if (state.selected && state.selected.el) state.selected.el.classList.remove('ed-selected');
        state.selected = null; renderPanel();
      }
    });

    try {
      localStorage.setItem('cpiaz-probe', '1');
      localStorage.removeItem('cpiaz-probe');
      el('ed-storage').textContent = 'автосохранение включено';
    } catch (e) {
      el('ed-storage').textContent = 'браузер блокирует автосохранение';
      setTimeout(function () { tip('Браузер запретил автосохранение. Используйте кнопки «Скачать HTML» или «Экспорт».', 'warn'); }, 1200);
    }
  }

  return {
    init: init,
    afterRender: afterRender,
    setEditing: setEditing,
    isEditing: function () { return state.editing; },
    select: select
  };
})();
