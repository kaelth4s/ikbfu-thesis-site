/*
 * Логика демонстрационного макета «Центр поддержки и заявок».
 * Без сервера: кнопки меняют состояние интерфейса и пишут событие в историю.
 * Персистентность — localStorage, ключ mockup-state.
 */
'use strict';

(function () {
  var DATA = window.MOCKUP_DATA;
  var STORAGE_KEY = 'mockup-state';
  var STATE_VERSION = 3;

  /* Каналы получения документа: как бумага попадает в дело. */
  var CHANNELS = {
    is: 'данные из ИС',
    request: 'запрос подразделению',
    upload: 'загружает студент',
    original: 'бумажный оригинал'
  };

  /* Состояния требования: что происходит сейчас. */
  var STATES = {
    done: { label: 'получено', cls: 'ok' },
    requested: { label: 'запрос отправлен', cls: 'info' },
    need: { label: 'нужно действие', cls: 'act' },
    original: { label: 'донести оригинал', cls: 'wait' }
  };

  var appById = {};
  DATA.applications.forEach(function (app) { appById[app.id] = app; });

  var serviceById = {};
  DATA.services.forEach(function (svc) { serviceById[svc.id] = svc; });

  var nav = document.getElementById('nav');
  var view = document.getElementById('view');
  var toastEl = document.getElementById('toast');
  var resetBtn = document.getElementById('reset');
  var toastTimer = 0;
  var storageBlocked = false;

  var state = loadState();

  /* ------------------------------------------------------------ состояние */

  function emptyState() {
    var base = { version: STATE_VERSION, apps: {} };
    DATA.applications.forEach(function (app) {
      var docs = {};
      app.documents.forEach(function (doc) { docs[doc.id] = doc.state; });
      base.apps[app.id] = {
        status: app.status,
        tone: app.tone,
        step: app.step,
        submitted: app.submitted,
        docs: docs,
        asks: {},
        events: []
      };
    });
    return base;
  }

  function normalize(raw, base) {
    if (!raw || typeof raw !== 'object' || !raw.apps || raw.version !== STATE_VERSION) { return base; }
    Object.keys(base.apps).forEach(function (id) {
      var saved = raw.apps[id];
      if (!saved || typeof saved !== 'object') { return; }
      var target = base.apps[id];
      if (typeof saved.status === 'string' && saved.status) { target.status = saved.status; }
      if (typeof saved.tone === 'string' && saved.tone) { target.tone = saved.tone; }
      if (typeof saved.step === 'number' && isFinite(saved.step)) {
        target.step = Math.max(0, Math.min(Math.floor(saved.step), appById[id].steps.length));
      }
      if (typeof saved.submitted === 'boolean') { target.submitted = saved.submitted; }
      if (saved.docs && typeof saved.docs === 'object') {
        Object.keys(target.docs).forEach(function (docId) {
          var chip = saved.docs[docId];
          if (typeof chip === 'string' && STATES[chip]) { target.docs[docId] = chip; }
        });
      }
      if (saved.asks && typeof saved.asks === 'object') {
        appById[id].documents.forEach(function (doc) {
          if (!doc.ask) { return; }
          var choice = saved.asks[doc.id];
          if (choice === 'no' || choice === 'yes' || choice === 'uploaded') { target.asks[doc.id] = choice; }
        });
      }
      if (Array.isArray(saved.events)) {
        target.events = saved.events.filter(function (ev) {
          return ev && typeof ev.text === 'string' && typeof ev.time === 'string';
        }).slice(0, 50);
      }
    });
    return base;
  }

  function loadState() {
    var base = emptyState();
    var raw = null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (err) { storageBlocked = true; }
    if (!raw) { return base; }
    try { return normalize(JSON.parse(raw), base); } catch (err) { return base; }
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      storageBlocked = true;
    }
  }

  function pushEvent(appState, text) {
    appState.events.unshift({ time: 'только что', text: text });
  }

  /* -------------------------------------------------------------- утилиты */

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2800);
  }

  function hintHtml() {
    return '<p class="hint-line">' + esc(DATA.notices.channels) + '</p>';
  }

  /* Уточняющий вопрос к документу из ИС: пока ответ «нет» — is/done. */
  function askChoice(st, doc) {
    var value = st.asks ? st.asks[doc.id] : '';
    return value === 'yes' || value === 'uploaded' ? value : 'no';
  }

  function currentAppState(id) {
    var base = appById[id];
    var s = state.apps[id];
    if (!base || !s) { return null; }
    var docs = base.documents.map(function (doc) {
      var channel = doc.channel;
      var docState = s.docs[doc.id] || doc.state;
      var note = doc.note;
      var choice = '';
      if (doc.ask) {
        choice = askChoice(s, doc);
        if (choice === 'yes') {
          channel = doc.ask.changedChannel;
          docState = doc.ask.changedState;
          note = doc.ask.changedNote;
        } else if (choice === 'uploaded') {
          channel = doc.ask.changedChannel;
          docState = 'done';
          note = doc.ask.uploadedNote;
        } else {
          channel = doc.channel;
          docState = doc.state;
          note = doc.note;
        }
      }
      return {
        id: doc.id,
        title: doc.title,
        channel: channel,
        note: note,
        state: docState,
        ask: doc.ask || null,
        choice: choice
      };
    });
    return { app: base, st: s, docs: docs };
  }

  /* -------------------------------------------------------------- маршрут */

  function currentSection() {
    var hash = window.location.hash || '';
    var parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    return { section: parts[0] || 'applications', id: parts[1] || '' };
  }

  function setNav(section) {
    var items = [
      { key: 'applications', label: 'Мои обращения', href: '#/applications' },
      { key: 'catalog', label: 'Каталог услуг', href: '#/catalog' },
      { key: 'notifications', label: 'Уведомления', href: '#/notifications' }
    ];
    nav.innerHTML = items.map(function (item) {
      var active = section === item.key || (section === 'card' && item.key === 'applications');
      return '<a href="' + item.href + '"' + (active ? ' class="is-active" aria-current="page"' : '') + '>' + esc(item.label) + '</a>';
    }).join('');
  }

  function render() {
    var route = currentSection();
    setNav(route.section);

    if (route.section === 'card' && route.id) {
      renderCard(route.id);
    } else if (route.section === 'catalog') {
      view.innerHTML = catalogHtml();
    } else if (route.section === 'notifications') {
      view.innerHTML = notificationsHtml();
    } else {
      view.innerHTML = listHtml();
    }
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------- «мои обращения» */

  function statusLabel(entry) {
    return entry.st ? entry.st.status : entry.app.status;
  }

  function toneOf(entry) {
    return (entry.st && entry.st.tone) || entry.app.tone || 'muted';
  }

  function stepLabel(entry) {
    var total = entry.app.steps.length;
    if (!entry.st.submitted) { return 'черновик · ' + total + ' этапов'; }
    var pos = Math.min(entry.st.step + 1, total);
    return 'этап ' + pos + ' из ' + total;
  }

  function listHtml() {
    var rows = DATA.applications.map(function (app) {
      var entry = currentAppState(app.id);
      return '' +
        '<li class="app-item">' +
          '<div class="app-item__head">' +
            '<div style="flex:1 1 320px">' +
              '<h2 class="app-item__title"><a href="#/card/' + encodeURIComponent(app.id) + '">' + esc(app.title) + '</a></h2>' +
              '<div class="app-item__meta">код обращения ' + esc(app.code) + ' · ' + esc(stepLabel(entry)) + '</div>' +
            '</div>' +
            '<span class="badge badge--' + esc(toneOf(entry)) + '">' + esc(statusLabel(entry)) + '</span>' +
          '</div>' +
          '<div class="app-item__body">' +
            '<div><div class="label">Срок</div><div class="value">' + esc(app.deadline) + '</div></div>' +
            '<div><div class="label">Что дальше</div><div class="value">' + esc(app.nextStep) + '</div></div>' +
          '</div>' +
          '<div class="app-item__foot">' +
            '<a class="btn btn--primary btn--sm" href="#/card/' + encodeURIComponent(app.id) + '">Открыть карточку</a>' +
          '</div>' +
        '</li>';
    }).join('');

    return '' +
      '<div class="page-head">' +
        '<h1 class="page-title">Мои обращения</h1>' +
        '<p class="page-lead">' + esc(DATA.notices.intake) + ' ' + esc(DATA.notices.publish) + '</p>' +
        hintHtml() +
      '</div>' +
      '<ul class="apps">' + rows + '</ul>';
  }

  /* ---------------------------------------------------- карточка обращения */

  function stepperHtml(app, st) {
    var total = app.steps.length;
    var allDone = st.step >= total;
    var items = app.steps.map(function (step, index) {
      var cls = 'todo';
      if (allDone) { cls = 'done'; }
      else if (index < st.step) { cls = 'done'; }
      else if (index === st.step) { cls = 'current'; }
      return '' +
        '<li class="step step--' + cls + '">' +
          '<div class="step__title">' + esc(step.title) + '</div>' +
          '<div class="step__meta">' + esc(step.meta) + '</div>' +
        '</li>';
    }).join('');
    return '<ol class="steps">' + items + '</ol>';
  }

  function docsHtml(entry) {
    var docs = entry.docs;
    if (!docs.length) { return '<p class="empty">Требований нет.</p>'; }
    var appId = entry.app.id;
    var items = docs.map(function (doc) {
      var chip = STATES[doc.state] || STATES.need;
      var ask = '';
      if (doc.ask) {
        var q = doc.ask;
        var changed = doc.choice !== 'no';
        ask = '' +
          '<div class="doc__ask">' +
            '<div class="doc__ask-q">' + esc(q.question) + '</div>' +
            '<div class="seg" role="group" aria-label="' + esc(q.question) + '">' +
              '<button type="button" class="seg__btn" data-app="' + esc(appId) + '" data-action="ask-no" data-doc="' + esc(doc.id) + '" aria-pressed="' + (changed ? 'false' : 'true') + '">' + esc(q.noLabel) + '</button>' +
              '<button type="button" class="seg__btn" data-app="' + esc(appId) + '" data-action="ask-yes" data-doc="' + esc(doc.id) + '" aria-pressed="' + (changed ? 'true' : 'false') + '">' + esc(q.yesLabel) + '</button>' +
            '</div>' +
          '</div>';
        if (doc.choice === 'yes') {
          ask += '<div class="doc__upload"><button class="btn btn--primary btn--sm" type="button" data-app="' + esc(appId) + '" data-action="ask-upload" data-doc="' + esc(doc.id) + '">' + esc(q.uploadLabel) + '</button></div>';
        }
      }
      return '' +
        '<li class="doc">' +
          '<div class="doc__main">' +
            '<div class="doc__title">' + esc(doc.title) + '</div>' +
            '<div class="doc__channel">' + esc(CHANNELS[doc.channel] || '') + '</div>' +
            (doc.note ? '<div class="doc__note">' + esc(doc.note) + '</div>' : '') +
            ask +
          '</div>' +
          '<span class="badge badge--' + chip.cls + '">' + chip.label + '</span>' +
        '</li>';
    }).join('');
    return '<ul class="docs">' + items + '</ul>';
  }

  function requestsHtml(requests) {
    if (!requests.length) {
      return '<p class="empty">Запросы подразделениям не требуются: документы получены из ИС или загружены студентом.</p>';
    }
    var rows = requests.map(function (req) {
      return '' +
        '<tr>' +
          '<td>' + esc(req.unit) + '</td>' +
          '<td class="col-source">' + esc(req.doc) + '</td>' +
          '<td class="result--' + esc(req.tone) + '">' + esc(req.status) + '</td>' +
          '<td class="col-time">' + esc(req.time) + '</td>' +
        '</tr>';
    }).join('');
    return '' +
      '<table class="checks">' +
        '<thead><tr><th>Подразделение</th><th>Что запрошено</th><th>Статус</th><th>Время</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '<p class="hint-line hint-line--tight">Подтверждённые справки существуют как электронные документы в деле и подписаны ЭП — бумага не нужна.</p>';
  }

  function checksHtml(checks) {
    if (!checks.length) {
      return '<p class="empty">Автопроверки запустятся после подачи заявления.</p>';
    }
    var rows = checks.map(function (check) {
      return '' +
        '<tr>' +
          '<td>' + esc(check.title) + '</td>' +
          '<td class="col-source">' + esc(check.source) + '</td>' +
          '<td class="result--' + esc(check.tone) + '">' + esc(check.result) + '</td>' +
          '<td class="col-time">' + esc(check.time) + '</td>' +
        '</tr>';
    }).join('');
    return '' +
      '<table class="checks">' +
        '<thead><tr><th>Проверка</th><th>Источник</th><th>Результат</th><th>Время</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';
  }

  function historyHtml(app, st) {
    var events = st.events.concat(app.history);
    if (!events.length) { return '<p class="empty">Событий пока нет.</p>'; }
    var newCount = st.events.length;
    var items = events.map(function (event, index) {
      return '' +
        '<li' + (index < newCount ? ' class="timeline__item--new"' : '') + '>' +
          '<div class="time">' + esc(event.time) + '</div>' +
          '<div class="text">' + esc(event.text) + '</div>' +
        '</li>';
    }).join('');
    return '<ul class="timeline">' + items + '</ul>';
  }

  function renderCard(id) {
    var entry = currentAppState(id);
    if (!entry) {
      view.innerHTML = '<p class="empty">Обращение не найдено. <a href="#/applications">Вернуться к списку</a>.</p>';
      return;
    }
    var app = entry.app;
    var st = entry.st;

    var canSubmit = !st.submitted;
    var canOriginal = entry.docs.some(function (doc) { return doc.state === 'original'; });
    var canStatement = st.submitted;

    var actions = '' +
      '<div class="actions">' +
        '<button class="btn btn--primary" type="button" data-app="' + esc(app.id) + '" data-action="submit"' +
          (canSubmit ? '' : ' disabled') + '>' + (canSubmit ? 'Подписать и подать' : 'Заявление подано') + '</button>' +
        '<button class="btn" type="button" data-app="' + esc(app.id) + '" data-action="original"' +
          (canOriginal ? '' : ' disabled') + '>Донести оригинал</button>' +
        '<button class="btn btn--ghost" type="button" data-app="' + esc(app.id) + '" data-action="statement"' +
          (canStatement ? '' : ' disabled') + '>Скачать выписку</button>' +
      '</div>';

    view.innerHTML = '' +
      '<a class="back" href="#/applications">← Все обращения</a>' +
      '<section class="card-head">' +
        '<div class="card-head__row">' +
          '<h1 class="card-head__title">' + esc(app.title) + '</h1>' +
          '<span class="badge badge--' + esc(toneOf(entry)) + '">' + esc(statusLabel(entry)) + '</span>' +
        '</div>' +
        '<div class="card-head__meta">код обращения ' + esc(app.code) + ' · ' + esc(stepLabel(entry)) + '</div>' +
        '<div class="card-head__note">' +
          '<div><div class="label">Срок</div><div>' + esc(app.deadline) + '</div></div>' +
          '<div><div class="label">Что дальше</div><div>' + esc(app.nextStep) + '</div></div>' +
        '</div>' +
        actions +
      '</section>' +
      hintHtml() +
      '<div class="layout">' +
        '<div class="layout__col">' +
          '<section class="card"><h2 class="card__title">Этапы</h2>' + stepperHtml(app, st) + '</section>' +
          '<section class="card"><h2 class="card__title">Документы и требования</h2>' + docsHtml(entry) + '</section>' +
        '</div>' +
        '<div class="layout__col">' +
          '<section class="card"><h2 class="card__title">Запросы подразделениям</h2>' + requestsHtml(app.requests || []) + '</section>' +
          '<section class="card"><h2 class="card__title">Автопроверки</h2>' + checksHtml(app.checks) + '</section>' +
          '<section class="card"><h2 class="card__title">История</h2>' + historyHtml(app, st) + '</section>' +
        '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------- каталог */

  function catalogHtml() {
    var cards = DATA.services.map(function (svc) {
      var docs = svc.docs.map(function (doc) {
        return '<li><span class="checklist__text">' + esc(doc.title) +
          '<span class="note">' + esc(doc.desc || (CHANNELS[doc.channel] || '')) +
          (doc.note ? ' · ' + esc(doc.note) : '') + '</span></span></li>';
      }).join('');
      var linked = appById[svc.id];
      return '' +
        '<article class="service">' +
          '<h2 class="service__title">' + esc(svc.title) + '</h2>' +
          '<p class="service__lead">' + esc(svc.lead) + '</p>' +
          '<div class="service__facts">' +
            '<div><div class="label">Сроки приёма документов</div><div class="value">' + esc(svc.deadline) + '</div></div>' +
            '<div><div class="label">Решение</div><div class="value">' + esc(svc.decision) + '</div></div>' +
          '</div>' +
          '<ul class="checklist">' + docs + '</ul>' +
          '<div class="service__foot">' +
            '<span class="muted">Оригиналы: ' + esc(svc.originals) + '</span>' +
            (linked ? '<a class="btn btn--sm" href="#/card/' + encodeURIComponent(linked.id) + '">Открыть обращение</a>' : '') +
          '</div>' +
        '</article>';
    }).join('');

    return '' +
      '<div class="page-head">' +
        '<h1 class="page-title">Каталог услуг</h1>' +
        '<p class="page-lead">' + esc(DATA.notices.intake) + ' ' + esc(DATA.notices.commission) + ' ' +
          esc(DATA.notices.paidToFree) + ' ' + esc(DATA.notices.publish) + '</p>' +
        hintHtml() +
      '</div>' +
      '<div class="catalog">' + cards + '</div>';
  }

  /* --------------------------------------------------------- уведомления */

  function notificationsHtml() {
    var items = DATA.notifications.map(function (note) {
      var app = appById[note.appId];
      var link = app
        ? '<a class="notif__link" href="#/card/' + encodeURIComponent(app.id) + '">Обращение ' + esc(app.code) + ' →</a>'
        : '';
      return '' +
        '<li class="notif">' +
          '<div class="notif__head">' +
            '<h2 class="notif__title">' + esc(note.title) + '</h2>' +
            '<span class="notif__time">' + esc(note.time) + '</span>' +
          '</div>' +
          '<p class="notif__text">' + esc(note.text) + '</p>' +
          link +
        '</li>';
    }).join('');
    return '' +
      '<div class="page-head">' +
        '<h1 class="page-title">Уведомления</h1>' +
        '<p class="page-lead">События по обращениям: подставленные данные, автопроверки, запросы подразделениям, требования донести оригиналы.</p>' +
      '</div>' +
      '<ul class="notifs">' + items + '</ul>';
  }

  /* -------------------------------------------------------------- действия */

  function syncStatusOnProgress(appId) {
    var entry = currentAppState(appId);
    if (!entry) { return; }
    var st = entry.st;
    var needs = entry.docs.filter(function (doc) { return doc.state === 'need'; }).length;
    if (needs) {
      st.status = 'Требует действия';
      st.tone = 'act';
    } else if (st.submitted) {
      st.status = 'На проверке документов';
      st.tone = 'wait';
    }
  }

  function applyAction(appId, action, docId) {
    var app = appById[appId];
    var st = state.apps[appId];
    if (!app || !st) { return; }

    if (action === 'submit') {
      if (st.submitted) { return; }
      st.submitted = true;
      st.step = Math.min(st.step + 1, app.steps.length - 1);
      pushEvent(st, 'Заявление подписано и подано электронно');
      syncStatusOnProgress(appId);
      toast('Заявление подано (демо): событие добавлено в историю.');
    } else if (action === 'original') {
      var delivered = 0;
      app.documents.forEach(function (doc) {
        if (st.docs[doc.id] === 'original') {
          st.docs[doc.id] = 'done';
          delivered += 1;
        }
      });
      if (!delivered) { return; }
      pushEvent(st, 'Бумажный оригинал донесён в университет');
      syncStatusOnProgress(appId);
      toast('Оригинал отмечен как донесённый (демо).');
    } else if (action === 'statement') {
      if (!st.submitted) { return; }
      pushEvent(st, 'Выписка по обращению сформирована для скачивания');
      toast('Демо: файл не формируется, событие добавлено в историю.');
    } else if (action === 'ask-no' || action === 'ask-yes' || action === 'ask-upload') {
      var doc = null;
      app.documents.forEach(function (item) {
        if (item.id === docId && item.ask) { doc = item; }
      });
      if (!doc) { return; }
      if (action === 'ask-upload') {
        if (askChoice(st, doc) !== 'yes') { return; }
        st.asks[doc.id] = 'uploaded';
        pushEvent(st, doc.ask.uploadedEvent);
        toast('Демо: новый документ отмечен загруженным.');
      } else if (action === 'ask-yes') {
        if (askChoice(st, doc) === 'yes') { return; }
        st.asks[doc.id] = 'yes';
        pushEvent(st, doc.ask.changedEvent);
      } else {
        if (askChoice(st, doc) === 'no') { return; }
        st.asks[doc.id] = 'no';
      }
    } else {
      return;
    }

    saveState();
    render();
  }

  /* --------------------------------------------------------------- события */

  view.addEventListener('click', function (event) {
    var target = event.target;
    var button = target && target.closest ? target.closest('[data-action]') : null;
    if (!button || button.disabled) { return; }
    applyAction(
      button.getAttribute('data-app'),
      button.getAttribute('data-action'),
      button.getAttribute('data-doc')
    );
  });

  resetBtn.addEventListener('click', function () {
    state = emptyState();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      storageBlocked = true;
    }
    toast('Демо сброшено к исходному состоянию.');
    render();
  });

  window.addEventListener('hashchange', render);

  if (storageBlocked) {
    window.setTimeout(function () {
      toast('Браузер блокирует localStorage — изменения не сохранятся.');
    }, 400);
  }

  render();
})();
