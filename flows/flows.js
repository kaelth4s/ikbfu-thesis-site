/* flows.js — схемы процессов перевода.
   Читает window.FLOWS_DATA (flows-data.js) и рисует две зоны-канваса:
   «Сейчас» (asIs) и «С системой» (toBe) с блоками этапов и CSS-стрелками.
   Без зависимостей и сборки. Правка на месте, localStorage, импорт/экспорт JSON. */
(function () {
  'use strict';

  var BASE = window.FLOWS_DATA;
  var STORAGE_KEY = 'flows-data-v1';
  var DEFAULT_SHOWN = 3;

  var POVS = [
    { id: 'top', label: 'Сверху' },
    { id: 'student', label: 'Студент' },
    { id: 'staff', label: 'Сотрудник' }
  ];

  var DOC_TYPES = {
    paper: 'бумага',
    digital: 'цифровой',
    auto: 'авто'
  };

  var ZONES = {
    asIs: { title: 'Сейчас', sub: 'действующий порядок' },
    toBe: { title: 'С системой', sub: 'целевой порядок с цифровым сервисом' }
  };

  var EL = {};

  var state = {
    data: null,
    proc: 0,
    pov: 'top',
    shown: DEFAULT_SHOWN,
    sel: null,
    editing: false,
    printing: false,
    fromStorage: false,
    dirty: false,
    message: null
  };

  /* ------------------------------------------------------------ утилиты */

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function str(value) {
    if (typeof value === 'string') return value;
    return value == null ? '' : String(value);
  }

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function currentProc() {
    return state.data.processes[state.proc];
  }

  function stagesOf(kind) {
    var proc = currentProc();
    return proc && Array.isArray(proc[kind]) ? proc[kind] : [];
  }

  function maxStep() {
    return Math.max(stagesOf('asIs').length, stagesOf('toBe').length);
  }

  function visibleFor(len) {
    return state.printing ? len : Math.min(state.shown, len);
  }

  // Список этапов зоны после фильтра точки зрения, с исходными индексами:
  // индекс нужен для выбора этапа и правок, позиция — для порядка стрелок.
  function povList(kind) {
    var byPov = state.pov !== 'top' && !state.editing && !state.printing;
    var list = [];
    stagesOf(kind).forEach(function (stage, index) {
      if (!byPov || roleFocused(stage.actor, state.pov)) {
        list.push({ stage: stage, index: index });
      }
    });
    return list;
  }

  function pluralStages(n) {
    var m10 = n % 10;
    var m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'этап';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'этапа';
    return 'этапов';
  }

  function countText(list) {
    var total = list.length;
    if (!total) return 'этапов нет';
    var visible = visibleFor(total);
    if (visible >= total) return total === 1 ? 'всего 1 этап' : 'все ' + total + ' ' + pluralStages(total);
    return 'этап ' + visible + ' из ' + total;
  }

  function clampShown() {
    var max = Math.max(1, maxStep());
    state.shown = Math.min(Math.max(1, state.shown), max);
  }

  function setByPath(root, path, value) {
    var parts = path.split('.');
    var node = root;
    for (var i = 0; i < parts.length - 1; i += 1) {
      if (node == null) return false;
      node = node[parts[i]];
    }
    if (node == null) return false;
    node[parts[parts.length - 1]] = value;
    return true;
  }

  function renumber(list) {
    list.forEach(function (stage, i) { stage.n = i + 1; });
  }

  /* ------------------------------------------------------------ нормализация и проверка */

  function normalizeStage(stage, index) {
    var src = isPlainObject(stage) ? stage : {};
    var text = isPlainObject(src.text) ? src.text : {};
    var docs = (Array.isArray(src.docs) ? src.docs : []).map(function (doc) {
      var d = isPlainObject(doc) ? doc : {};
      return {
        name: str(d.name),
        from: str(d.from),
        to: str(d.to),
        type: DOC_TYPES[d.type] ? d.type : 'paper'
      };
    });
    var result = {
      n: index + 1,
      title: str(src.title),
      actor: str(src.actor),
      where: str(src.where),
      text: { top: str(text.top), student: str(text.student), staff: str(text.staff) },
      docs: docs,
      exit: str(src.exit)
    };
    if (typeof src.gain === 'string') result.gain = src.gain;
    return result;
  }

  function normalizeData(raw) {
    var src = isPlainObject(raw) ? raw : {};
    var meta = isPlainObject(src.meta) ? src.meta : {};
    var baseMeta = BASE && isPlainObject(BASE.meta) ? BASE.meta : {};
    var data = {
      meta: {
        title: str(meta.title) || str(baseMeta.title) || 'Схемы процессов',
        subtitle: str(meta.subtitle) || str(baseMeta.subtitle),
        updated: str(meta.updated) || str(baseMeta.updated)
      },
      processes: []
    };
    (Array.isArray(src.processes) ? src.processes : []).forEach(function (proc, i) {
      var p = isPlainObject(proc) ? proc : {};
      var fallback = 'Процесс ' + (i + 1);
      data.processes.push({
        id: str(p.id) || 'process-' + (i + 1),
        short: str(p.short) || str(p.title) || fallback,
        title: str(p.title) || str(p.short) || fallback,
        subtitle: str(p.subtitle),
        basis: str(p.basis),
        actors: (Array.isArray(p.actors) ? p.actors : []).map(str).filter(Boolean),
        asIs: (Array.isArray(p.asIs) ? p.asIs : []).map(normalizeStage),
        toBe: (Array.isArray(p.toBe) ? p.toBe : []).map(normalizeStage)
      });
    });
    return data;
  }

  function validateData(raw) {
    var errors = [];
    if (!isPlainObject(raw)) return { ok: false, errors: ['корень файла должен быть объектом'] };
    if (raw.meta != null && !isPlainObject(raw.meta)) errors.push('meta должен быть объектом');
    if (!Array.isArray(raw.processes)) {
      errors.push('нет массива processes');
      return { ok: false, errors: errors };
    }
    if (!raw.processes.length) errors.push('processes пуст');

    raw.processes.forEach(function (proc, i) {
      var at = 'processes[' + i + ']';
      if (!isPlainObject(proc)) {
        errors.push(at + ' — не объект');
        return;
      }
      ['id', 'short', 'title'].forEach(function (key) {
        if (typeof proc[key] !== 'string' || !proc[key].trim()) {
          errors.push(at + '.' + key + ' — не заполнено');
        }
      });
      ['asIs', 'toBe'].forEach(function (key) {
        if (!Array.isArray(proc[key])) {
          errors.push(at + '.' + key + ' — не массив');
          return;
        }
        proc[key].forEach(function (stage, j) {
          var sat = at + '.' + key + '[' + j + ']';
          if (!isPlainObject(stage)) {
            errors.push(sat + ' — не объект');
            return;
          }
          if (typeof stage.title !== 'string') errors.push(sat + '.title — не строка');
          if (stage.text != null && !isPlainObject(stage.text)) errors.push(sat + '.text — не объект');
          if (stage.docs == null) return;
          if (!Array.isArray(stage.docs)) {
            errors.push(sat + '.docs — не массив');
            return;
          }
          stage.docs.forEach(function (doc, k) {
            if (!isPlainObject(doc)) {
              errors.push(sat + '.docs[' + k + '] — не объект');
            } else if (doc.type != null && !DOC_TYPES[doc.type]) {
              errors.push(sat + '.docs[' + k + '].type — неизвестный тип «' + str(doc.type) + '»');
            }
          });
        });
      });
    });

    return { ok: errors.length === 0, errors: errors };
  }

  function loadStored() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var check = validateData(parsed);
      if (!check.ok) {
        try { window.localStorage.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
        state.message = { text: 'Сохранённая версия повреждена и удалена — показаны исходные данные.', kind: 'err' };
        return null;
      }
      return normalizeData(parsed);
    } catch (err) {
      return null;
    }
  }

  /* ------------------------------------------------------------ роли и POV */

  function roleFocused(actor, pov) {
    if (pov === 'top') return true;
    var text = str(actor).toLowerCase();
    if (!text) return true;
    var isStudent = text.indexOf('студент') !== -1;
    if (pov === 'student') return isStudent;
    // «сотрудник»: важно всё, где в роли есть кто-то кроме студента
    // (составные роли вида «Студент · дирекция · бухгалтерия» тоже относятся к сотруднику)
    return text.replace(/студент[а-яё]*/g, '').replace(/[\s·,+/]/g, '') !== '';
  }

  /* ------------------------------------------------------------ разметка */

  function editableAttr(path) {
    if (!state.editing) return '';
    return ' contenteditable="true" spellcheck="false" data-path="' + esc(path) + '"';
  }

  function nodeHtml(stage, kind, index, ghost) {
    var cls = 'node';
    if (ghost) {
      cls += ' is-ghost';
    } else {
      if (state.sel && state.sel.kind === kind && state.sel.index === index) cls += ' is-active';
    }
    var disabled = ghost ? ' disabled tabindex="-1" aria-hidden="true"' : ' aria-expanded="' + !!(state.sel && state.sel.kind === kind && state.sel.index === index) + '"';
    return '<button type="button" class="' + cls + '" data-kind="' + kind + '" data-index="' + index + '"' + disabled + '>' +
        '<span class="node-main"><span class="node-num">' + esc(stage.n) + '</span>' +
          '<span class="node-title">' + esc(stage.title) + '</span></span>' +
        '<span class="node-role">' + esc(stage.actor || 'роль не указана') + '</span>' +
      '</button>';
  }

  function trackHtml(kind) {
    var list = povList(kind);
    var visible = visibleFor(list.length);
    var html = list.map(function (entry, pos) {
      var ghost = pos >= visible;
      var block = nodeHtml(entry.stage, kind, entry.index, ghost);
      if (pos === 0) return block;
      var arrowCls = ghost ? 'arrow is-ghost' : 'arrow';
      return '<span class="' + arrowCls + '" aria-hidden="true"></span>' + block;
    }).join('');
    if (!list.length) {
      html = '<p class="d-empty">' + (state.editing
        ? 'Этапов пока нет — добавьте кнопкой «+ этап».'
        : (state.pov === 'top'
          ? 'Этапов нет.'
          : 'По этой точке зрения в этой схеме этапов нет — переключитесь на «Сверху».')) + '</p>';
    }
    return html;
  }

  function docsHtml(stage, base) {
    var docs = Array.isArray(stage.docs) ? stage.docs : [];
    if (!docs.length) return '<p class="d-empty">документов нет</p>';
    return '<ul class="d-docs">' + docs.map(function (doc, i) {
      var type = DOC_TYPES[doc.type] ? doc.type : 'paper';
      var name = state.editing
        ? '<span class="d-doc-name"' + editableAttr(base + '.docs.' + i + '.name') + '>' + esc(doc.name) + '</span>'
        : '<span class="d-doc-name">' + esc(doc.name) + '</span>';
      return '<li>' +
          '<span class="doc-type">' + esc(DOC_TYPES[type]) + '</span>' + name +
          '<span class="d-doc-route">' + esc(doc.from) + ' &rarr; ' + esc(doc.to) + '</span>' +
        '</li>';
    }).join('') + '</ul>';
  }

  function detailHtml() {
    if (!state.sel) return '';
    var kind = state.sel.kind;
    var index = state.sel.index;
    var stages = stagesOf(kind);
    var stage = stages[index];
    if (!stage) return '';
    var base = 'processes.' + state.proc + '.' + kind + '.' + index;
    var zone = ZONES[kind];

    var title = state.editing
      ? '<h3 class="d-title"' + editableAttr(base + '.title') + '>' + esc(stage.title) + '</h3>'
      : '<h3 class="d-title">' + esc(stage.title) + '</h3>';

    var actor = state.editing
      ? '<dd><span' + editableAttr(base + '.actor') + '>' + esc(stage.actor || '—') + '</span></dd>'
      : '<dd>' + esc(stage.actor || '—') + '</dd>';

    var where = state.editing
      ? '<dd><span' + editableAttr(base + '.where') + '>' + esc(stage.where || '—') + '</span></dd>'
      : '<dd>' + esc(stage.where || '—') + '</dd>';

    var povHtml;
    if (state.editing) {
      povHtml = POVS.map(function (pov) {
        return '<div class="d-pov' + (pov.id === state.pov ? ' is-current' : '') + '">' +
            '<div class="d-label">' + esc(pov.label) + '</div>' +
            '<p class="d-text"' + editableAttr(base + '.text.' + pov.id) + '>' +
              esc(stage.text[pov.id] || '') +
            '</p>' +
          '</div>';
      }).join('');
    } else {
      povHtml = '<p class="d-text">' + esc(stage.text[state.pov] || '—') + '</p>';
    }

    var povLabel = state.editing
      ? 'Текст по точкам зрения'
      : 'Взгляд: ' + esc((POVS.filter(function (p) { return p.id === state.pov; })[0] || {}).label || '');

    var footLabel = kind === 'toBe' ? 'что меняется' : 'выход';
    var footValue = kind === 'toBe' ? (stage.gain || '') : (stage.exit || '');
    var foot = state.editing
      ? '<p class="d-text"' + editableAttr(base + (kind === 'toBe' ? '.gain' : '.exit')) + '>' + esc(footValue) + '</p>'
      : '<p class="d-text">' + esc(footValue || '—') + '</p>';

    return title +
      '<dl class="d-meta">' +
        '<div><dt>роль</dt>' + actor + '</div>' +
        '<div><dt>место</dt>' + where + '</div>' +
      '</dl>' +
      '<section class="d-block"><h4>Документы</h4>' + docsHtml(stage, base) + '</section>' +
      '<section class="d-block"><h4>' + povLabel + '</h4>' + povHtml + '</section>' +
      '<div class="d-foot"><span class="d-foot-label">' + esc(footLabel) + '</span>' + foot + '</div>';
  }

  /* ------------------------------------------------------------ отрисовка */

  function renderHead() {
    var meta = state.data.meta;
    EL.pageTitle.textContent = meta.title;
    EL.pageSubtitle.textContent = meta.subtitle;
    EL.updated.textContent = meta.updated ? 'данные от ' + meta.updated : '';
    document.title = meta.title + ' — схемы процессов';
  }

  function renderTabs() {
    EL.tabs.innerHTML = state.data.processes.map(function (proc, i) {
      return '<button type="button" role="tab" data-proc="' + i + '"' +
        ' aria-selected="' + (i === state.proc) + '"' +
        ' title="' + esc(proc.title) + '">' + esc(proc.short) + '</button>';
    }).join('');
  }

  function renderPov() {
    EL.povSwitch.innerHTML = POVS.map(function (pov) {
      return '<button type="button" data-pov="' + pov.id + '"' +
        ' aria-pressed="' + (state.pov === pov.id) + '">' + esc(pov.label) + '</button>';
    }).join('');
  }

  function renderTrack(el, kind) {
    var list = povList(kind);
    el.innerHTML = trackHtml(kind);
    // много узких блоков — чуть уменьшаем шрифт, чтобы не резать заголовки
    el.classList.toggle('is-dense', list.length >= 7);
  }

  function renderTracks() {
    renderTrack(EL.trackAsIs, 'asIs');
    renderTrack(EL.trackToBe, 'toBe');
    var aList = povList('asIs');
    var tList = povList('toBe');
    EL.countAsIs.textContent = countText(aList);
    EL.countToBe.textContent = countText(tList);
  }

  function renderDetail() {
    if (!state.sel) {
      EL.detail.hidden = true;
      EL.detailBody.innerHTML = '';
      EL.detailKicker.textContent = '';
      return;
    }
    var stage = stagesOf(state.sel.kind)[state.sel.index];
    if (!stage) {
      state.sel = null;
      renderDetail();
      return;
    }
    EL.detail.hidden = false;
    EL.detailKicker.textContent = ZONES[state.sel.kind].title + ' · этап ' + stage.n;
    EL.detailBody.innerHTML = detailHtml();
  }

  function renderEditState() {
    EL.editToggle.textContent = state.editing ? 'Готово' : 'Редактировать';
    EL.editToggle.setAttribute('aria-pressed', String(state.editing));
    EL.editbar.hidden = !state.editing;
    EL.toolsAsIs.hidden = !state.editing;
    EL.toolsToBe.hidden = !state.editing;
    document.body.classList.toggle('is-editing', state.editing);
  }

  function renderStepper() {
    var max = maxStep();
    EL.stepLabel.textContent = max ? 'этапов ' + Math.min(state.shown, max) + ' из ' + max : 'этапов нет';
    EL.prevStep.disabled = state.shown <= 1 || !max;
    EL.nextStep.disabled = !max || state.shown >= max;
    EL.showAll.disabled = !max || state.shown >= max;
  }

  function renderProcLine() {
    var proc = currentProc();
    EL.printHead.innerHTML = '<h2>' + esc(proc.title) + '</h2>' +
      (proc.subtitle ? '<p>' + esc(proc.subtitle) + '</p>' : '') +
      (proc.basis ? '<p>Основание: ' + esc(proc.basis) + '</p>' : '');
  }

  function renderStatus() {
    var changed = state.fromStorage || state.dirty;
    EL.note.hidden = !changed;
    EL.note.textContent = changed ? 'изменённая версия' : '';
    if (state.message) {
      EL.message.textContent = state.message.text;
      EL.message.setAttribute('data-kind', state.message.kind || 'info');
    } else {
      EL.message.textContent = '';
      EL.message.removeAttribute('data-kind');
    }
  }

  function renderAll() {
    clampShown();
    syncSelection();
    renderHead();
    renderTabs();
    renderPov();
    renderEditState();
    renderStepper();
    renderTracks();
    renderDetail();
    renderProcLine();
    renderStatus();
  }

  function setMessage(text, kind) {
    state.message = { text: text, kind: kind || 'info' };
    renderStatus();
  }

  /* ------------------------------------------------------------ действия */

  function syncSelection() {
    if (!state.sel) return;
    var list = povList(state.sel.kind);
    var pos = -1;
    list.forEach(function (entry, i) {
      if (entry.index === state.sel.index) pos = i;
    });
    if (pos < 0 || pos >= visibleFor(list.length)) state.sel = null;
  }

  function setShown(value) {
    var max = Math.max(1, maxStep());
    state.shown = Math.min(Math.max(1, value), max);
    syncSelection();
    renderStepper();
    renderTracks();
    renderDetail();
  }

  function stepShown(delta) {
    if (!maxStep()) return;
    setShown(state.shown + delta);
  }

  function selectNode(kind, index) {
    if (state.sel && state.sel.kind === kind && state.sel.index === index) {
      state.sel = null;
    } else {
      state.sel = { kind: kind, index: index };
    }
    renderTracks();
    renderDetail();
    if (state.sel) {
      var node = (kind === 'toBe' ? EL.trackToBe : EL.trackAsIs)
        .querySelector('.node[data-index="' + index + '"]');
      if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function addStage(kind) {
    var proc = currentProc();
    var list = proc[kind];
    if (!Array.isArray(list)) list = proc[kind] = [];
    var stage = {
      n: list.length + 1,
      title: 'Новый этап',
      actor: '',
      where: '',
      text: { top: '', student: '', staff: '' },
      docs: [],
      exit: ''
    };
    if (kind === 'toBe') stage.gain = '';
    list.push(stage);
    renumber(list);
    state.dirty = true;
    state.shown = Math.max(state.shown, list.length);
    state.sel = { kind: kind, index: list.length - 1 };
    renderAll();

    var editable = EL.detailBody.querySelector('[data-path="' + 'processes.' + state.proc + '.' + kind + '.' + (list.length - 1) + '.title' + '"]');
    var node = (kind === 'toBe' ? EL.trackToBe : EL.trackAsIs)
      .querySelector('.node[data-index="' + (list.length - 1) + '"]');
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (editable && editable.focus) editable.focus();
  }

  function removeStage(kind) {
    var list = currentProc()[kind];
    if (!Array.isArray(list) || !list.length) {
      setMessage('В этой зоне нет этапов для удаления.', 'err');
      return;
    }
    list.pop();
    renumber(list);
    if (state.sel && state.sel.kind === kind && state.sel.index >= list.length) state.sel = null;
    state.dirty = true;
    clampShown();
    renderAll();
  }

  function saveData() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    } catch (err) {
      setMessage('Сохранить не удалось: браузер запретил localStorage. Используйте экспорт JSON.', 'err');
      return;
    }
    state.fromStorage = true;
    state.dirty = false;
    setMessage('Сохранено в браузере (ключ ' + STORAGE_KEY + '). Версия применится при следующем открытии.', 'ok');
  }

  function resetData() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
    state.data = normalizeData(clone(BASE));
    state.proc = Math.min(state.proc, state.data.processes.length - 1);
    state.shown = DEFAULT_SHOWN;
    state.sel = null;
    state.fromStorage = false;
    state.dirty = false;
    state.message = null;
    renderAll();
    setMessage('Возвращены исходные данные из flows-data.js.', 'ok');
  }

  function exportData() {
    var payload = JSON.stringify(state.data, null, 2);
    var blob = new Blob([payload], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'flows-data.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setMessage('Файл flows-data.json скачан: полная структура FLOWS_DATA.', 'ok');
  }

  function handleImport(file) {
    var reader = new FileReader();

    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (err) {
        setMessage('Импорт не выполнен: файл не является корректным JSON.', 'err');
        return;
      }

      var check = validateData(parsed);
      if (!check.ok) {
        var shown = check.errors.slice(0, 3).join('; ');
        var rest = check.errors.length > 3 ? ' (и ещё ' + (check.errors.length - 3) + ')' : '';
        setMessage('Импорт не выполнен: ' + shown + rest, 'err');
        return;
      }

      state.data = normalizeData(parsed);
      state.proc = Math.min(state.proc, state.data.processes.length - 1);
      state.shown = DEFAULT_SHOWN;
      state.sel = null;
      state.dirty = true;
      state.fromStorage = false;
      state.message = null;
      renderAll();
      setMessage('Импортировано процессов: ' + state.data.processes.length + '. Нажмите «Сохранить», чтобы запомнить.', 'ok');
    };

    reader.onerror = function () {
      setMessage('Импорт не выполнен: файл не удалось прочитать.', 'err');
    };

    reader.readAsText(file, 'utf-8');
  }

  /* ------------------------------------------------------------ события */

  function closest(target, selector) {
    return target && target.closest ? target.closest(selector) : null;
  }

  function bindTrack(track, kind) {
    track.addEventListener('click', function (event) {
      var node = closest(event.target, '.node');
      if (!node || node.disabled || node.classList.contains('is-ghost')) return;
      var index = Number(node.getAttribute('data-index'));
      if (!Number.isFinite(index)) return;
      selectNode(kind, index);
    });
  }

  function bindEvents() {
    EL.tabs.addEventListener('click', function (event) {
      var button = closest(event.target, 'button[data-proc]');
      if (!button) return;
      var index = Number(button.getAttribute('data-proc'));
      if (!Number.isFinite(index)) return;
      if (index < 0 || index >= state.data.processes.length) return;
      state.proc = index;
      state.sel = null;
      clampShown();
      renderAll();
    });

    EL.povSwitch.addEventListener('click', function (event) {
      var button = closest(event.target, 'button[data-pov]');
      if (!button) return;
      state.pov = button.getAttribute('data-pov');
      syncSelection();
      renderPov();
      renderTracks();
      renderDetail();
    });

    EL.editToggle.addEventListener('click', function () {
      state.editing = !state.editing;
      if (state.editing) state.message = null;
      renderAll();
    });

    EL.prevStep.addEventListener('click', function () { stepShown(-1); });
    EL.nextStep.addEventListener('click', function () { stepShown(1); });

    EL.showAll.addEventListener('click', function () {
      var max = maxStep();
      if (!max) return;
      setShown(max);
    });

    EL.btnSave.addEventListener('click', saveData);
    EL.btnReset.addEventListener('click', resetData);
    EL.btnExport.addEventListener('click', exportData);
    EL.btnImport.addEventListener('click', function () { EL.importFile.click(); });

    EL.importFile.addEventListener('change', function () {
      var file = EL.importFile.files && EL.importFile.files[0];
      EL.importFile.value = '';
      if (file) handleImport(file);
    });

    EL.zones.addEventListener('click', function (event) {
      var addButton = closest(event.target, '[data-add]');
      if (addButton) {
        addStage(addButton.getAttribute('data-add'));
        return;
      }
      var delButton = closest(event.target, '[data-del]');
      if (delButton) removeStage(delButton.getAttribute('data-del'));
    });

    EL.detail.addEventListener('click', function (event) {
      var close = closest(event.target, '#detail-close');
      if (close) {
        state.sel = null;
        renderTracks();
        renderDetail();
      }
    });

    // Правки в contenteditable сразу попадают в модель: перерисовка
    // панели на каждом символе потеряла бы каретку.
    EL.detail.addEventListener('input', function (event) {
      var target = event.target;
      if (!target || target.nodeType !== 1) return;
      var path = target.getAttribute('data-path');
      if (!path) return;
      var value = (target.innerText || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\n+$/, '');
      if (setByPath(state.data, path, value)) {
        state.dirty = true;
        renderStatus();
        if (/\.(title|actor)$/.test(path)) renderTracks();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && state.sel) {
        state.sel = null;
        renderTracks();
        renderDetail();
        return;
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      var target = event.target;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      stepShown(event.key === 'ArrowRight' ? 1 : -1);
    });
  }

  /* ------------------------------------------------------------ печать */

  // На печати показываем все этапы обеих зон: фильтр точки зрения и
  // степпер раскрытия не должны влиять на документ.
  function setPrintMode(on) {
    if (state.printing === on) return;
    state.printing = on;
    renderTracks();
  }

  function bindPrint() {
    window.addEventListener('beforeprint', function () { setPrintMode(true); });
    window.addEventListener('afterprint', function () { setPrintMode(false); });
    if (!window.matchMedia) return;
    var mq = window.matchMedia('print');
    var onChange = function () { setPrintMode(!!mq.matches); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  function cacheEls() {
    EL.pageTitle = document.getElementById('page-title');
    EL.pageSubtitle = document.getElementById('page-subtitle');
    EL.tabs = document.getElementById('tabs');
    EL.povSwitch = document.getElementById('pov-switch');
    EL.editToggle = document.getElementById('edit-toggle');
    EL.note = document.getElementById('note');
    EL.message = document.getElementById('message');
    EL.updated = document.getElementById('updated');
    EL.printHead = document.getElementById('print-head');
    EL.trackAsIs = document.getElementById('track-asis');
    EL.trackToBe = document.getElementById('track-tobe');
    EL.countAsIs = document.getElementById('count-asis');
    EL.countToBe = document.getElementById('count-tobe');
    EL.toolsAsIs = document.getElementById('tools-asis');
    EL.toolsToBe = document.getElementById('tools-tobe');
    EL.zones = document.querySelector('.zones');
    EL.stepper = document.getElementById('stepper');
    EL.prevStep = document.getElementById('prev-step');
    EL.stepLabel = document.getElementById('step-label');
    EL.nextStep = document.getElementById('next-step');
    EL.showAll = document.getElementById('show-all');
    EL.editbar = document.getElementById('editbar');
    EL.btnSave = document.getElementById('btn-save');
    EL.btnReset = document.getElementById('btn-reset');
    EL.btnExport = document.getElementById('btn-export');
    EL.btnImport = document.getElementById('btn-import');
    EL.importFile = document.getElementById('import-file');
    EL.detail = document.getElementById('detail');
    EL.detailKicker = document.getElementById('detail-kicker');
    EL.detailBody = document.getElementById('detail-body');
  }

  /* ------------------------------------------------------------ запуск */

  function init() {
    cacheEls();

    if (!BASE || !Array.isArray(BASE.processes) || !BASE.processes.length) {
      EL.trackAsIs.innerHTML = '<p class="fatal">Не удалось прочитать данные: window.FLOWS_DATA пуст. ' +
        'Проверьте, что файл flows-data.js лежит рядом со страницей.</p>';
      EL.trackToBe.innerHTML = '';
      EL.stepper.hidden = true;
      EL.showAll.hidden = true;
      EL.editToggle.hidden = true;
      return;
    }

    var stored = loadStored();
    state.data = stored || normalizeData(clone(BASE));
    state.fromStorage = !!stored;
    state.proc = 0;
    state.shown = DEFAULT_SHOWN;

    bindTrack(EL.trackAsIs, 'asIs');
    bindTrack(EL.trackToBe, 'toBe');
    bindEvents();
    bindPrint();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
