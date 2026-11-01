/* ============================================================
   ЦПиЗ — кликабельный макет. Роутер на hash + отрисовка страниц.
   Никакой реальной логики: формы, фильтры и кнопки имитируют работу.
   ============================================================ */
(function () {
  'use strict';

  var DB = window.MOCK;
  var state = {
    role: 'student',
    appsQuery: '',
    appsCat: 'all',
    faqQuery: '',
    ticketFilter: 'new',
    constructor: null,
    ctorSelected: 0
  };

  var NAV = {
    student: [
      { to: '#/home', t: 'Главная' },
      { to: '#/applications', t: 'Заявки' },
      { to: '#/support', t: 'Поддержка' },
      { to: '#/faq', t: 'Вопросы' },
      { to: '#/directory', t: 'Справочник' },
      { to: '#/my', t: 'Мои обращения' }
    ],
    operator: [
      { to: '#/admin/tickets', t: 'Тикеты' },
      { to: '#/admin/metrics', t: 'Метрики' },
      { to: '#/admin/users', t: 'Пользователи' },
      { to: '#/directory', t: 'Справочник' },
      { to: '#/admin/audit', t: 'Аудит' }
    ],
    admin: [
      { to: '#/home', t: 'Главная' },
      { to: '#/admin/tickets', t: 'Тикеты' },
      { to: '#/admin/metrics', t: 'Метрики' },
      { to: '#/admin/constructor', t: 'Конструктор' },
      { to: '#/admin/users', t: 'Пользователи' },
      { to: '#/admin/roles', t: 'Роли и права' },
      { to: '#/admin/audit', t: 'Аудит' },
      { to: '#/admin/integrations', t: 'Интеграции' },
      { to: '#/profile', t: 'Профиль' }
    ]
  };

  /* ---------- вспомогательное ---------- */

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function statusClass(s) {
    if (/Решён|Готово|Активен|Подключено/.test(s)) return 'chip--ok';
    if (/В работе|Настройка|Передан/.test(s)) return 'chip--primary';
    if (/Ожидает|Очереди|Новый|План/.test(s)) return 'chip--warn';
    if (/Заблокирован|Отклон|Просрочен/.test(s)) return 'chip--danger';
    return '';
  }

  function chip(text, cls) { return '<span class="chip ' + (cls || statusClass(text)) + '">' + esc(text) + '</span>'; }

  function stepper(steps, current, eid) {
    return '<ol class="stepper"' + (eid ? ' data-eid="' + eid + '" data-elabel="Этапы"' : '') + '>' + steps.map(function (s, i) {
      var cls = i + 1 < current ? 'is-done' : (i + 1 === current ? 'is-current' : '');
      var num = i + 1 < current ? '✓' : (i + 1);
      return '<li class="' + cls + '"><span class="stepper__dot">' + num + '</span>' +
        '<span><span class="stepper__title">' + esc(s) + '</span>' +
        (i + 1 === current ? '<div class="stepper__note">текущий этап</div>' : '') + '</span></li>';
    }).join('') + '</ol>';
  }

  function appCard(a, idx) {
    return '<article class="card app-card" data-eid="app-card-' + a.id + '" data-elabel="Карточка заявки ' + esc(a.title) + '">' +
      '<div class="app-card__head"><h3 style="margin:0">' + esc(a.title) + '</h3>' +
      (a.hot ? chip('Популярное', 'chip--primary') : '') + '</div>' +
      '<p class="muted small" style="margin:0">' + esc(a.summary) + '</p>' +
      '<div class="app-card__tags">' + a.tags.map(function (t) { return chip('#' + t, ''); }).join('') + '</div>' +
      '<div class="app-card__meta"><span>Срок: ' + esc(a.duration) + '</span><span>Ответственный: ' + esc(a.owner) + '</span>' +
      '<span>Этапов: ' + a.steps.length + '</span><span>Документов: ' + a.docs.length + '</span></div>' +
      '<div class="btn-row"><a class="btn btn--sm" href="#/application/' + a.id + '" data-go="#/application/' + a.id + '">Описание и подача</a>' +
      '<button class="btn btn--soft btn--sm" data-modal="apply:' + a.id + '">Подать заявку</button></div>' +
      '</article>';
  }

  function appById(id) { return DB.applications.filter(function (a) { return a.id === id; })[0]; }

  /* ---------- каркас ---------- */

  function renderHeader() {
    var nav = NAV[state.role] || NAV.student;
    document.getElementById('nav').innerHTML = nav.map(function (n) {
      var active = location.hash.indexOf(n.to) === 0 ? ' class="is-active"' : '';
      return '<a href="' + n.to + '" data-go="' + n.to + '"' + active + '>' + esc(n.t) + '</a>';
    }).join('');

    document.getElementById('header-tools').innerHTML =
      '<div class="role-switch"><span>Роль:</span><select id="role-select" data-eid="role-select" data-elabel="Переключатель роли">' +
        [['student', 'Студент'], ['operator', 'Оператор поддержки'], ['admin', 'Администратор']].map(function (o) {
          return '<option value="' + o[0] + '"' + (state.role === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select></div>' +
      '<a class="btn btn--soft btn--sm bell" href="#/notifications" data-go="#/notifications" data-eid="bell" data-elabel="Колокольчик уведомлений">Уведомления' +
        '<span class="bell__count">' + DB.notifications.length + '</span></a>' +
      '<button class="btn btn--soft btn--sm" id="ed-toggle" data-eid="edit-toggle" data-elabel="Кнопка «Редактировать вид»">Редактировать вид</button>';
  }

  /* ---------- страницы ---------- */

  function pageHome() {
    return '' +
      '<section class="hero section" data-eid="hero" data-elabel="Главный блок (герой)">' +
        '<h1>Единая точка входа в вуз</h1>' +
        '<p>Центр поддержки и заявок объединяет подачу заявлений, отслеживание статусов, поддержку по вопросам и коммуникацию с подразделениями. Меньше бумаги, звонков и личных визитов — больше прозрачности.</p>' +
        '<div class="btn-row" style="margin-top:14px">' +
          '<a class="btn" href="#/applications" data-go="#/applications" data-eid="hero-cta-1" data-elabel="Кнопка «Каталог заявок»">Каталог заявок</a>' +
          '<a class="btn btn--soft" href="#/support" data-go="#/support" data-eid="hero-cta-2" data-elabel="Кнопка «Задать вопрос»">Задать вопрос</a>' +
          '<a class="btn btn--soft" href="#/faq" data-go="#/faq">База знаний</a>' +
        '</div>' +
      '</section>' +

      '<section class="section"><div class="grid grid--4">' +
        tile('Заявки', 'Электронная подача по каталогу: этапы, документы, чек-листы и трекинг.', '#/applications', 'app') +
        tile('Поддержка', 'Тикеты с маршрутизацией на подразделение или сотрудника, переписка и файлы.', '#/support', 'ticket') +
        tile('База знаний', 'FAQ и пошаговые инструкции — часть вопросов решается без обращения.', '#/faq', 'faq') +
        tile('Справочник', 'Подразделения, контакты, графики работы, кабинеты и зоны ответственности.', '#/directory', 'dir') +
      '</div></section>' +

      '<section class="section" data-eid="problems" data-elabel="Блок «Проблема → решение»">' +
        '<div class="section__head"><h2>Какую проблему решает система</h2><span class="muted small">из концепции проекта</span></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Проблема сегодня</th><th>Решение в ЦПиЗ</th></tr></thead><tbody>' +
        DB.problems.map(function (p) {
          return '<tr><td style="white-space:normal">' + esc(p.problem) + '</td><td class="muted" style="white-space:normal">' + esc(p.solution) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
      '</section>' +

      '<section class="section" data-eid="scenarios" data-elabel="Блок сценариев">' +
        '<div class="section__head"><h2>Сценарии использования</h2><span class="muted small">демонстрация пути пользователя</span></div>' +
        '<div class="grid grid--3">' + DB.scenarios.map(function (s) {
          return '<article class="tile" data-eid="scenario-' + esc(s.title) + '" data-elabel="Сценарий: ' + esc(s.title) + '">' +
            '<div class="row row--between">' + chip(s.role, 'chip--primary') + '</div>' +
            '<div class="tile__title">' + esc(s.title) + '</div>' +
            '<p class="small muted" style="margin:0">' + esc(s.text) + '</p>' +
            '<a class="tile__link small" href="' + s.to + '" data-go="' + s.to + '">Посмотреть раздел →</a></article>';
        }).join('') + '</div>' +
      '</section>' +

      '<section class="section"><div class="grid grid--4">' +
        DB.metrics.tiles.slice(0, 4).map(function (m) {
          return '<div class="metric-tile" data-eid="home-metric-' + esc(m.label) + '" data-elabel="Плитка метрики">' +
            '<div class="small muted">' + esc(m.label) + '</div>' +
            '<div class="metric-tile__value">' + esc(m.value) + '</div>' +
            '<div class="small">' + chip(m.delta, '') + '</div></div>';
        }).join('') + '</div></section>' +

      '<section class="section"><div class="card" data-eid="home-about" data-elabel="Блок «Что даёт вузу»">' +
        '<h2>Что даёт вузу</h2><div class="grid grid--2"><ul class="data-list">' +
        ['Снижение нагрузки: меньше звонков, писем и визитов',
         'Прозрачность процессов для студентов',
         'Единая точка входа вместо метаний между подразделениями'].map(function (t) { return '<li><span>' + t + '</span></li>'; }).join('') +
        '</ul><ul class="data-list">' +
        ['Автоматизация рутины и меньше ошибок',
         'Аналитика: где задержки и перегрузки',
         'Новые типы заявок настраиваются без программиста'].map(function (t) { return '<li><span>' + t + '</span></li>'; }).join('') +
        '</ul></div></div></section>';
  }

  function tile(title, text, to, id) {
    return '<article class="tile" data-eid="tile-' + id + '" data-elabel="Плитка «' + title + '»">' +
      '<div class="tile__icon">◆</div>' +
      '<div class="tile__title">' + esc(title) + '</div>' +
      '<p class="small muted" style="margin:0">' + esc(text) + '</p>' +
      '<a class="tile__link small" href="' + to + '" data-go="' + to + '">Открыть →</a></article>';
  }

  function pageApplications() {
    return '<div class="section__head"><h2>Сервис заявок</h2>' +
      '<span class="muted small">каталог типов заявок: описание, этапы, документы, электронная подача</span></div>' +
      '<div class="filterbar" data-eid="apps-filter" data-elabel="Панель фильтров заявок">' +
        '<input type="search" id="apps-search" placeholder="Поиск по названию, тегу, подразделению" value="' + esc(state.appsQuery) + '">' +
        '<div class="segmented" id="apps-cats">' +
          '<button data-cat="all" class="' + (state.appsCat === 'all' ? 'is-active' : '') + '">Все</button>' +
          DB.categories.map(function (c) {
            return '<button data-cat="' + c.id + '" class="' + (state.appsCat === c.id ? 'is-active' : '') + '">' + esc(c.name) + '</button>';
          }).join('') + '</div>' +
        '<span class="muted small" id="apps-count"></span>' +
      '</div>' +
      '<div class="grid grid--2" id="apps-list" style="margin-top:16px"></div>';
  }

  function renderAppList() {
    var list = document.getElementById('apps-list');
    if (!list) return;
    var q = state.appsQuery.trim().toLowerCase();
    var items = DB.applications.filter(function (a) {
      var okCat = state.appsCat === 'all' || a.category === state.appsCat;
      var hay = (a.title + ' ' + a.summary + ' ' + a.tags.join(' ') + ' ' + a.owner).toLowerCase();
      return okCat && (!q || hay.indexOf(q) !== -1);
    });
    list.innerHTML = items.length ? items.map(appCard).join('')
      : '<div class="card muted" data-eid="apps-empty">Ничего не найдено. Попробуйте изменить запрос.</div>';
    var cnt = document.getElementById('apps-count');
    if (cnt) cnt.textContent = 'найдено: ' + items.length + ' из ' + DB.applications.length;
    if (window.Editor) window.Editor.afterRender();
  }

  function pageApplication(id) {
    var a = appById(id);
    if (!a) return '<div class="card">Заявка не найдена. <a href="#/applications" data-go="#/applications">Каталог заявок</a></div>';
    var cat = DB.categories.filter(function (c) { return c.id === a.category; })[0];
    return '<div class="section small muted"><a href="#/applications" data-go="#/applications">← Все заявки</a></div>' +
      '<div class="grid grid--sidebar">' +
      '<div class="stack">' +
        '<article class="card" data-eid="app-head" data-elabel="Заголовок заявки">' +
          '<div class="row row--between">' + chip(cat ? cat.name : 'Прочее', 'chip--primary') + chip(a.duration, '') + '</div>' +
          '<h1 style="margin-top:8px">' + esc(a.title) + '</h1>' +
          '<p class="muted">' + esc(a.summary) + '</p>' +
          '<div class="btn-row"><button class="btn" data-modal="apply:' + a.id + '" data-eid="btn-apply" data-elabel="Кнопка «Подать заявку»">Подать заявку электронно</button>' +
          '<button class="btn btn--soft" data-action="Черновик сохранён (демонстрация)">Сохранить черновик</button></div>' +
        '</article>' +
        '<article class="card" data-eid="app-steps" data-elabel="Этапы заявки"><h2>Этапы обработки</h2>' + stepper(a.steps, 0) + '</article>' +
        '<article class="card" data-eid="app-docs" data-elabel="Список документов"><h2>Какие документы понадобятся</h2>' +
          '<ul class="data-list">' + a.docs.map(function (d, i) {
            return '<li><span>' + esc(d) + '</span><span class="muted small">' + (i < 2 ? 'обязательно' : 'при наличии') + '</span></li>';
          }).join('') + '</ul>' +
          '<div class="ed-hint" style="margin-top:10px">Система проверяет комплектность и подсвечивает недостающие документы до отправки — это снижает возвраты на доработку.</div>' +
        '</article>' +
        '<article class="card" data-eid="app-faq" data-elabel="Блок похожих вопросов"><h2>Похожие вопросы</h2>' +
          '<ul class="data-list">' + DB.faq.slice(0, 3).map(function (f) {
            return '<li><a href="#/faq" data-go="#/faq">' + esc(f.q) + '</a></li>';
          }).join('') + '</ul></article>' +
      '</div>' +
      '<aside class="stack">' +
        '<div class="card" data-eid="app-side" data-elabel="Карточка ответственного">' +
          '<h3>Ответственное подразделение</h3>' +
          '<div class="row">' + chip(a.owner, 'chip--primary') + '</div>' +
          '<dl class="kv" style="margin-top:10px">' +
            '<dt>Срок</dt><dd>' + esc(a.duration) + '</dd>' +
            '<dt>Категория</dt><dd>' + esc(cat ? cat.name : '—') + '</dd>' +
            '<dt>Теги</dt><dd>' + a.tags.map(esc).join(', ') + '</dd>' +
            '<dt>Уведомления</dt><dd>email, push</dd>' +
          '</dl></div>' +
        '<div class="card" data-eid="app-history" data-elabel="История изменений"><h3>Прозрачность</h3>' +
          '<p class="small muted">Каждое действие сотрудника фиксируется в аудите: кто, когда и что изменил в вашей заявке.</p></div>' +
      '</aside></div>';
  }

  function pageMy() {
    return '<div class="section__head"><h2>Мои обращения</h2><span class="muted small">заявки и тикеты в одном списке</span></div>' +
      '<div class="grid">' + DB.myApplications.map(function (m) {
        return '<article class="card" data-eid="my-app-' + m.id + '" data-elabel="Моя заявка ' + m.id + '">' +
          '<div class="row row--between"><div><b>' + esc(m.title) + '</b> <span class="muted small">№ ' + m.id + '</span></div>' +
          '<div class="row">' + chip(m.status) + '</div></div>' +
          '<div class="progress ' + (/Готово/.test(m.status) ? 'progress--ok' : '') + '" style="margin:10px 0"><span style="width:' + (m.step / m.steps.length * 100) + '%"></span></div>' +
          '<div class="row row--between small muted"><span>Этап ' + m.step + ' из ' + m.steps.length + ': ' + esc(m.steps[Math.min(m.step, m.steps.length) - 1]) + '</span>' +
          '<span>Обновлено ' + esc(m.updated) + '</span></div>' +
          '<details style="margin-top:10px"><summary class="small">Показать историю и этапы</summary>' +
            '<div style="margin-top:10px">' + stepper(m.steps, m.step) + '</div>' +
            '<ul class="data-list small">' + m.history.map(function (h) {
              return '<li><span>' + esc(h.text) + '</span><span class="muted">' + esc(h.date) + '</span></li>';
            }).join('') + '</ul>' +
            '<div class="small muted">Ответственный: ' + esc(m.owner) + '</div>' +
          '</details>' +
          '<div class="btn-row" style="margin-top:10px"><button class="btn btn--soft btn--sm" data-action="Открыт чат по заявке (демонстрация)">Уточнить</button>' +
          '<button class="btn btn--soft btn--sm" data-action="Скачивание документов будет доступно в рабочей версии">Скачать документы</button></div>' +
        '</article>';
      }).join('') +
      '<article class="card" data-eid="my-tickets" data-elabel="Мои тикеты"><h2>Тикеты поддержки</h2>' +
      DB.tickets.map(function (t) {
        return '<div class="ticket-row"><div><a href="#/ticket/' + t.id + '" data-go="#/ticket/' + t.id + '"><b>' + esc(t.subject) + '</b></a>' +
          '<div class="small muted">№ ' + t.id + ' · ' + esc(t.assignee) + ' · обновлён ' + esc(t.updated) + '</div></div>' +
          '<div class="row">' + chip(t.status) + '</div></div>';
      }).join('') + '</article></div>';
  }

  function pageSupport() {
    return '<div class="grid grid--sidebar"><div class="stack">' +
      '<div class="section__head"><h2>Сервис поддержки</h2><span class="muted small">тикеты: вопрос, адресат, переписка, статус</span></div>' +
      '<div class="card" data-eid="support-new" data-elabel="Карточка создания обращения">' +
        '<div class="row row--between"><h3 style="margin:0">Создать обращение</h3>' + chip('Гибридная маршрутизация', 'chip--primary') + '</div>' +
        '<p class="small muted">Не знаете, куда обратиться — отправьте в общий пул: оператор направит вопрос нужному подразделению. Знаете адресата — выберите его сразу.</p>' +
        '<div class="btn-row"><button class="btn" data-modal="new-ticket" data-eid="btn-new-ticket" data-elabel="Кнопка «Новое обращение»">Новое обращение</button>' +
        '<a class="btn btn--soft" href="#/faq" data-go="#/faq">Сначала поискать в базе знаний</a></div>' +
      '</div>' +
      '<div class="card" data-eid="support-list" data-elabel="Мои тикеты"><h2>Мои тикеты</h2>' +
        DB.tickets.map(function (t) {
          return '<div class="ticket-row"><div><a href="#/ticket/' + t.id + '" data-go="#/ticket/' + t.id + '"><b>' + esc(t.subject) + '</b></a>' +
            '<div class="small muted">№ ' + t.id + ' · ' + esc(t.pool) + ' · ' + esc(t.assignee) + '</div></div>' +
            '<div class="row">' + (t.unread ? '<span class="ed-badge">' + t.unread + '</span>' : '') + chip(t.status) + '</div></div>';
        }).join('') + '</div>' +
      '</div>' +
      '<aside class="stack">' +
        '<div class="card" data-eid="support-routing" data-elabel="Блок маршрутизации"><h3>Как маршрутизируется тикет</h3>' +
          stepper(['Обращение в общий пул', 'Оператор определяет подразделение', 'Сотрудник отвечает', 'Вы уведомлены'], 2) + '</div>' +
        '<div class="card" data-eid="support-faq" data-elabel="Популярные вопросы"><h3>Частые вопросы</h3>' +
          '<ul class="data-list small">' + DB.faq.slice(0, 4).map(function (f) { return '<li><a href="#/faq" data-go="#/faq">' + esc(f.q) + '</a></li>'; }).join('') + '</ul></div>' +
      '</aside></div>';
  }

  function pageTicket(id) {
    var t = DB.tickets.filter(function (x) { return x.id === id; })[0];
    if (!t) return '<div class="card">Тикет не найден. <a href="#/support" data-go="#/support">К поддержке</a></div>';
    return '<div class="section small muted"><a href="#/support" data-go="#/support">← Все обращения</a></div>' +
      '<div class="grid grid--sidebar"><div class="stack">' +
      '<div class="card" data-eid="ticket-head" data-elabel="Заголовок тикета">' +
        '<div class="row row--between"><h2 style="margin:0">' + esc(t.subject) + '</h2>' + chip(t.status) + '</div>' +
        '<div class="small muted">№ ' + t.id + ' · создан ' + esc(t.updated) + ' · приоритет: ' + esc(t.priority) + '</div>' +
      '</div>' +
      '<div class="card" data-eid="ticket-chat" data-elabel="Переписка по тикету"><h3>Переписка</h3>' +
        '<div class="chat">' + t.messages.map(function (m) {
          return '<div class="msg ' + (m.from === 'me' ? 'msg--me' : m.from === 'system' ? 'msg--system' : '') + '">' +
            '<div class="msg__meta">' + esc(m.author) + ' · ' + esc(m.date) + '</div>' + esc(m.text) + '</div>';
        }).join('') + '</div>' +
        '<div class="field" style="margin-top:14px"><label>Ваш ответ</label>' +
        '<textarea placeholder="Напишите сообщение... (в макете отправка не подключена)"></textarea></div>' +
        '<div class="btn-row"><button class="btn" data-action="Сообщение отправлено (демонстрация)">Отправить</button>' +
        '<button class="btn btn--soft" data-action="Файл прикреплён (демонстрация)">Прикрепить файл</button></div>' +
      '</div></div>' +
      '<aside class="stack"><div class="card" data-eid="ticket-side" data-elabel="Сведения о тикете"><h3>Сведения</h3>' +
        '<dl class="kv"><dt>Статус</dt><dd>' + chip(t.status) + '</dd>' +
        '<dt>Ответственный</dt><dd>' + esc(t.assignee) + '</dd>' +
        '<dt>Маршрут</dt><dd>' + esc(t.pool) + '</dd>' +
        '<dt>Приоритет</dt><dd>' + esc(t.priority) + '</dd></dl>' +
        '<div class="btn-row" style="margin-top:10px"><button class="btn btn--soft btn--sm" data-action="Тикет закрыт (демонстрация)">Закрыть тикет</button></div>' +
      '</div></aside></div>';
  }

  function pageFaq() {
    return '<div class="section__head"><h2>База знаний и FAQ</h2><span class="muted small">самообслуживание: часть вопросов решается без тикета</span></div>' +
      '<div class="filterbar" data-eid="faq-filter" data-elabel="Поиск по базе знаний">' +
        '<input type="search" id="faq-search" placeholder="Поиск по вопросам и инструкциям" value="' + esc(state.faqQuery) + '">' +
        '<span class="muted small" id="faq-count"></span></div>' +
      '<div class="grid grid--2" id="faq-list" style="margin-top:16px"></div>';
  }

  function renderFaqList() {
    var list = document.getElementById('faq-list');
    if (!list) return;
    var q = state.faqQuery.trim().toLowerCase();
    var items = DB.faq.filter(function (f) {
      return !q || (f.q + ' ' + f.a + ' ' + f.cat).toLowerCase().indexOf(q) !== -1;
    });
    var cats = {};
    items.forEach(function (f) { (cats[f.cat] = cats[f.cat] || []).push(f); });
    list.innerHTML = Object.keys(cats).map(function (c) {
      return '<article class="card" data-eid="faq-cat-' + esc(c) + '" data-elabel="Категория FAQ ' + esc(c) + '">' +
        '<div class="row row--between"><h3 style="margin:0">' + esc(c) + '</h3>' + chip(cats[c].length + ' материала(ов)', '') + '</div>' +
        cats[c].map(function (f) {
          return '<details style="margin-top:8px"><summary>' + esc(f.q) + '</summary>' +
            '<p class="small muted" style="margin:8px 0 4px">' + esc(f.a) + '</p>' +
            '<a class="small" href="' + f.link + '" data-go="' + f.link + '">Перейти к разделу →</a></details>';
        }).join('') + '</article>';
    }).join('') || '<div class="card muted">Ничего не найдено.</div>';
    var cnt = document.getElementById('faq-count');
    if (cnt) cnt.textContent = 'материалов: ' + items.length;
    if (window.Editor) window.Editor.afterRender();
  }

  function pageDirectory() {
    return '<div class="section__head"><h2>Справочник подразделений и сотрудников</h2>' +
      '<span class="muted small">контакты, графики работы, кабинеты и зоны ответственности</span></div>' +
      '<div class="grid grid--cards">' + DB.departments.map(function (d) {
        return '<article class="card" data-eid="dept-' + d.id + '" data-elabel="Подразделение ' + esc(d.name) + '">' +
          '<h3 style="margin-bottom:4px">' + esc(d.name) + '</h3>' +
          '<div class="small muted">' + esc(d.head) + '</div>' +
          '<dl class="kv kv--compact small" style="margin-top:10px"><dt>Кабинет</dt><dd>' + esc(d.room) + '</dd>' +
          '<dt>Телефон</dt><dd>' + esc(d.phone) + '</dd>' +
          '<dt>Почта</dt><dd>' + esc(d.email) + '</dd>' +
          '<dt>График</dt><dd>' + esc(d.hours) + '</dd>' +
          '<dt>Отвечает за</dt><dd>' + esc(d.zone) + '</dd></dl>' +
          '<div class="btn-row" style="margin-top:10px"><button class="btn btn--soft btn--sm" data-modal="ticket-to:' + d.id + '">Написать обращение</button></div>' +
        '</article>';
      }).join('') + '</div>' +
      '<div class="section__head" style="margin-top:24px"><h2>Сотрудники</h2><span class="muted small">к кому идти по конкретному вопросу</span></div>' +
      '<div class="table-wrap" data-eid="employees-table" data-elabel="Таблица сотрудников"><table><thead><tr>' +
      '<th>Сотрудник</th><th>Подразделение</th><th>Должность</th><th>Зона ответственности</th><th>Кабинет</th><th>Приём</th></tr></thead><tbody>' +
      DB.employees.map(function (e) {
        return '<tr><td><b>' + esc(e.name) + '</b><div class="small muted">' + esc(e.email) + '</div></td>' +
          '<td>' + esc(e.dept) + '</td><td>' + esc(e.role) + '</td><td style="white-space:normal">' + esc(e.zone) + '</td>' +
          '<td>' + esc(e.room) + '</td><td>' + esc(e.hours) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function pageProfile() {
    var u = DB.user, n = u.notifications;
    return '<div class="section__head"><h2>Профиль пользователя</h2><span class="muted small">данные, статус, история, уведомления</span></div>' +
      '<div class="grid grid--sidebar"><div class="stack">' +
      '<div class="card" data-eid="profile-data" data-elabel="Карточка профиля">' +
        '<div class="row"><div class="tile__icon" style="width:56px;height:56px;font-size:1.1em">' + esc(u.initials) + '</div>' +
        '<div><div class="tile__title">' + esc(u.name) + '</div><div class="small muted">' + esc(u.status) + ' · ' + esc(u.group) + ' · ' + esc(u.unit) + '</div></div></div>' +
        '<dl class="kv" style="margin-top:14px"><dt>Email</dt><dd>' + esc(u.email) + '</dd>' +
        '<dt>Телефон</dt><dd>' + esc(u.phone) + '</dd>' +
        '<dt>СНИЛС</dt><dd>' + esc(u.snilsMasked) + ' <span class="small muted">(хранится в зашифрованном виде)</span></dd>' +
        '<dt>Статус</dt><dd>' + chip('Подтверждён', 'chip--ok') + '</dd></dl>' +
        '<div class="btn-row" style="margin-top:12px"><button class="btn btn--soft btn--sm" data-action="Редактирование профиля (демонстрация)">Изменить данные</button>' +
        '<button class="btn btn--soft btn--sm" data-action="Смена пароля (демонстрация)">Сменить пароль</button></div>' +
      '</div>' +
      '<div class="card" data-eid="profile-notify" data-elabel="Настройки уведомлений"><h3>Уведомления</h3>' +
        [['email', 'Email — статусы заявок и ответы'], ['push', 'Push — срочные события'],
         ['messenger', 'Мессенджеры — переписка по тикетам'], ['digest', 'Дайджест раз в неделю'],
         ['deadlines', 'Напоминания о сроках']].map(function (o) {
          return '<div class="switch-row"><span>' + esc(o[1]) + '</span>' +
            '<label class="check"><input type="checkbox" ' + (n[o[0]] ? 'checked' : '') + ' data-action="Настройка сохранена (демонстрация)"><span class="small muted">вкл</span></label></div>';
        }).join('') + '</div>' +
      '<div class="card" data-eid="profile-history" data-elabel="История обращений"><h3>История обращений</h3>' +
        '<ul class="data-list small">' + DB.myApplications.concat(DB.tickets).map(function (x) {
          return '<li><span>' + esc(x.title || x.subject) + '</span><span class="muted">' + esc(x.updated || '') + '</span></li>';
        }).join('') + '</ul></div>' +
      '</div>' +
      '<aside class="stack"><div class="card" data-eid="profile-security" data-elabel="Блок безопасности"><h3>Безопасность</h3>' +
        '<ul class="data-list small"><li><span>Вход по логину и паролю</span>' + chip('включено', 'chip--ok') + '</li>' +
        '<li><span>SSO / LDAP вуза</span>' + chip('в плане', 'chip--warn') + '</li>' +
        '<li><span>Двухфакторная аутентификация</span>' + chip('опция', '') + '</li>' +
        '<li><span>Шифрование канала (HTTPS)</span>' + chip('включено', 'chip--ok') + '</li>' +
        '<li><span>Журнал входов</span>' + chip('ведение', 'chip--primary') + '</li></ul></div>' +
      '<div class="card" data-eid="profile-roles" data-elabel="Блок ролей"><h3>Мои роли</h3>' + chip('Студент', 'chip--primary') +
      '<p class="small muted" style="margin-top:8px">Права выдаются ролями и атрибутами (RBAC + ABAC) и настраиваются администратором без изменения кода.</p></div></aside></div>';
  }

  function pageNotifications() {
    return '<div class="section__head"><h2>Уведомления</h2><span class="muted small">email, push и мессенджеры</span></div>' +
      '<div class="filterbar" data-eid="notify-channels" data-elabel="Фильтр каналов уведомлений">' +
        '<div class="segmented"><button class="is-active">Все</button><button>Email</button><button>Push</button><button>Мессенджеры</button></div>' +
        '<button class="btn btn--soft btn--sm" data-action="Все уведомления отмечены прочитанными (демонстрация)">Отметить прочитанными</button></div>' +
      '<div class="card" style="margin-top:16px" data-eid="notify-list" data-elabel="Список уведомлений">' +
        DB.notifications.map(function (x) {
          return '<div class="ticket-row"><div><b>' + esc(x.title) + '</b><div class="small muted">' + esc(x.text) + '</div></div>' +
            '<div class="row">' + chip(x.channel, 'chip--primary') + '<span class="small muted">' + esc(x.date) + '</span></div></div>';
        }).join('') + '</div>';
  }

  /* ---------- админ ---------- */

  function pageAdminTickets() {
    var list = DB.adminTickets.filter(function (t) {
      if (state.ticketFilter === 'new') return t.status === 'Новый';
      if (state.ticketFilter === 'work') return t.status === 'В работе';
      if (state.ticketFilter === 'archive') return t.status === 'Решён';
      return true;
    });
    return '<div class="section__head"><h2>Панель тикетов</h2><span class="muted small">распределение по ролям и сотрудникам, контроль SLA</span></div>' +
      '<div class="filterbar" data-eid="admin-tickets-filter" data-elabel="Фильтр панели тикетов">' +
        '<div class="segmented" id="ticket-tabs">' +
          [['new', 'Новые'], ['work', 'В работе'], ['archive', 'Архив'], ['all', 'Все']].map(function (o) {
            return '<button data-tf="' + o[0] + '" class="' + (state.ticketFilter === o[0] ? 'is-active' : '') + '">' + o[1] + '</button>';
          }).join('') + '</div>' +
        '<select style="max-width:220px"><option>Все подразделения</option>' + DB.departments.map(function (d) { return '<option>' + esc(d.name) + '</option>'; }).join('') + '</select>' +
        '<input type="search" placeholder="Поиск по тикету, автору" style="max-width:240px">' +
      '</div>' +
      '<div class="table-wrap" style="margin-top:16px" data-eid="admin-tickets-table" data-elabel="Таблица тикетов"><table><thead><tr>' +
      '<th>Тикет</th><th>Автор</th><th>Статус</th><th>Приоритет</th><th>Ответственный</th><th>Создан</th><th>SLA</th><th>Действие</th></tr></thead><tbody>' +
      (list.length ? list.map(function (t) {
        return '<tr><td><b>' + esc(t.id) + '</b><div class="small muted">' + esc(t.subject) + '</div></td>' +
          '<td>' + esc(t.author) + '</td><td>' + chip(t.status) + '</td>' +
          '<td>' + chip(t.priority, /Высокий/.test(t.priority) ? 'chip--danger' : '') + '</td>' +
          '<td>' + esc(t.assignee) + '</td><td>' + esc(t.created) + '</td>' +
          '<td>' + chip(t.sla, /^[0-3] ч/.test(t.sla) ? 'chip--warn' : '') + '</td>' +
          '<td><button class="btn btn--soft btn--sm" data-modal="route:' + t.id + '">Распределить</button></td></tr>';
      }).join('') : '<tr><td colspan="8" class="muted">В этой вкладке пусто.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="grid grid--4" style="margin-top:16px">' +
        ['Нераспределённых: 3', 'Просрочено SLA: 1', 'Среднее время ответа: 3 ч 20 мин', 'Закрыто за сутки: 12'].map(function (t) {
          return '<div class="metric-tile" data-eid="admin-ticket-metric-' + esc(t) + '" data-elabel="Показатель панели тикетов"><div class="small muted">' + esc(t.split(':')[0]) + '</div><div class="metric-tile__value">' + esc(t.split(':')[1].trim()) + '</div></div>';
        }).join('') + '</div>';
  }

  function pageAdminMetrics() {
    var m = DB.metrics;
    return '<div class="section__head"><h2>Метрики и аналитика</h2><span class="muted small">нагрузка, сроки, узкие места процессов</span></div>' +
      '<div class="grid grid--3">' + m.tiles.map(function (t) {
        return '<div class="metric-tile" data-eid="metric-' + esc(t.label) + '" data-elabel="Метрика ' + esc(t.label) + '">' +
          '<div class="small muted">' + esc(t.label) + '</div><div class="metric-tile__value">' + esc(t.value) + '</div>' + chip(t.delta, '') + '</div>';
      }).join('') + '</div>' +
      '<div class="grid grid--2" style="margin-top:16px">' +
        '<div class="card" data-eid="metrics-types" data-elabel="Заявки по типам"><h3>Заявки по типам, %</h3>' +
          m.byType.map(function (b) { return bar(b.label, b.value, b.value + '%', ''); }).join('') + '</div>' +
        '<div class="card" data-eid="metrics-load" data-elabel="Нагрузка подразделений"><h3>Нагрузка подразделений</h3>' +
          m.load.map(function (b) { return bar(b.label, b.load, b.value + ' шт', 'accent'); }).join('') + '</div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px" data-eid="metrics-bottlenecks" data-elabel="Узкие места"><h3>Узкие места</h3>' +
        '<div class="table-wrap"><table><thead><tr><th>Этап</th><th>Среднее время</th><th>Причина</th><th>Влияние</th></tr></thead><tbody>' +
        m.bottlenecks.map(function (b) {
          return '<tr><td>' + esc(b.label) + '</td><td>' + esc(b.value) + '</td><td>' + esc(b.note) + '</td><td>' + chip('высокое', 'chip--danger') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
  }

  function bar(label, value, text, mod) {
    return '<div class="bar"><span class="bar__label">' + esc(label) + '</span>' +
      '<span class="bar__track"><span class="bar__fill' + (mod ? ' bar__fill--' + mod : '') + '" style="width:' + value + '%"></span></span>' +
      '<span class="bar__value">' + esc(text) + '</span></div>';
  }

  function pageConstructor() {
    var draft = state.constructor;
    return '<div class="section__head"><h2>Конструктор заявок</h2>' +
      '<span class="muted small">визуальный редактор + JSON: новые типы заявок без программиста</span></div>' +
      '<div class="constructor">' +
        '<div class="card" data-eid="ctor-palette" data-elabel="Палитра блоков"><h3>Блоки</h3><div class="palette">' +
          DB.constructorBlocks.map(function (b) {
            return '<button class="palette__item" draggable="true" data-kind="' + b.kind + '"><b>' + esc(b.title) + '</b>' +
              '<div class="small muted">' + esc(b.hint) + '</div></button>';
          }).join('') + '</div>' +
          '<div class="ed-hint" style="margin-top:10px">Перетащите блок на холст или кликните по нему.</div></div>' +

        '<div class="card"><h3>Холст заявки «Заселение в общежитие»</h3>' +
          '<div class="canvas" id="ctor-canvas" data-eid="ctor-canvas" data-elabel="Холст конструктора">' +
            draft.map(function (b, i) {
              return '<div class="canvas__item ' + (i === state.ctorSelected ? 'is-selected' : '') + '" data-idx="' + i + '" draggable="true">' +
                '<span><b>' + esc(b.title) + '</b><div class="small muted">' + esc(b.meta) + '</div></span>' +
                '<span class="row"><span class="chip">' + esc(b.kind) + '</span>' +
                '<button class="btn btn--danger btn--sm" data-del="' + i + '">×</button></span></div>';
            }).join('') + '</div>' +
          '<div class="btn-row" style="margin-top:12px">' +
            '<button class="btn" data-action="Конфигурация сохранена в JSON (демонстрация)">Сохранить конфигурацию</button>' +
            '<button class="btn btn--soft" id="ctor-publish" data-action="Тип заявки опубликован и доступен студентам (демонстрация)">Опубликовать</button>' +
            '<button class="btn btn--soft" id="ctor-clear" data-action="Черновик очищен (демонстрация)">Очистить холст</button></div>' +
        '</div>' +

        '<div class="card" data-eid="ctor-inspector" data-elabel="Инспектор блока"><h3>Свойства блока</h3>' +
          (draft[state.ctorSelected] ?
            '<div class="field"><label>Название</label><input type="text" id="ctor-title" value="' + esc(draft[state.ctorSelected].title) + '"></div>' +
            '<div class="field"><label>Параметры</label><input type="text" id="ctor-meta" value="' + esc(draft[state.ctorSelected].meta) + '"></div>' +
            '<div class="field"><label>Тип</label><input type="text" value="' + esc(draft[state.ctorSelected].kind) + '" disabled></div>' +
            '<div class="btn-row"><button class="btn btn--danger btn--sm" id="ctor-del">Удалить блок</button></div>'
            : '<div class="ed-empty">Выберите блок на холсте.</div>') +
        '</div></div>' +
      '<div class="card" style="margin-top:16px" data-eid="ctor-json" data-elabel="JSON конфигурации">' +
        '<div class="row row--between"><h3 style="margin:0">JSON конфигурации</h3>' + chip('версионирование', 'chip--primary') + '</div>' +
        '<p class="small muted">Один и тот же тип заявки можно править визуально или текстом JSON — это и есть гибридный подход из ТЗ.</p>' +
        '<pre class="code">' + esc(ctorJson()) + '</pre></div>' +
      '</div>';
  }

  function ctorJson() {
    var draft = state.constructor;
    var doc = {
      id: 'dorm-v3',
      title: 'Заселение в общежитие',
      category: 'dorm',
      version: 3,
      blocks: draft.map(function (b, i) { return { order: i + 1, kind: b.kind, title: b.title, meta: b.meta }; })
    };
    return JSON.stringify(doc, null, 2);
  }

  function pageAdminUsers() {
    return '<div class="section__head"><h2>Управление пользователями</h2><span class="muted small">роли, блокировки, привязка к подразделениям</span></div>' +
      '<div class="filterbar" data-eid="users-filter" data-elabel="Фильтр пользователей">' +
        '<input type="search" placeholder="Поиск по ФИО, почте, подразделению" style="max-width:320px">' +
        '<select style="max-width:220px"><option>Все роли</option>' + DB.roles.map(function (r) { return '<option>' + esc(r.name) + '</option>'; }).join('') + '</select>' +
        '<button class="btn btn--sm" data-modal="invite" data-eid="btn-invite" data-elabel="Кнопка «Добавить пользователя»">Добавить пользователя</button>' +
        '<button class="btn btn--soft btn--sm" data-action="Импорт из кадровой системы (демонстрация)">Импорт из LDAP</button></div>' +
      '<div class="table-wrap" style="margin-top:16px" data-eid="users-table" data-elabel="Таблица пользователей"><table><thead><tr>' +
      '<th>Пользователь</th><th>Роль</th><th>Подразделение / группа</th><th>Статус</th><th>Последний вход</th><th>Действия</th></tr></thead><tbody>' +
      DB.users.map(function (u) {
        return '<tr><td><b>' + esc(u.name) + '</b><div class="small muted">' + esc(u.email) + '</div></td>' +
          '<td>' + chip(u.role, 'chip--primary') + '</td><td>' + esc(u.unit) + '</td><td>' + chip(u.status) + '</td>' +
          '<td>' + esc(u.last) + '</td><td><button class="btn btn--soft btn--sm" data-action="Карточка пользователя (демонстрация)">Открыть</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="grid grid--3" style="margin-top:16px">' + DB.roles.map(function (r) {
        return '<div class="metric-tile" data-eid="role-count-' + r.id + '" data-elabel="Роль ' + esc(r.name) + '"><div class="small muted">' + esc(r.name) + '</div>' +
          '<div class="metric-tile__value">' + r.users + '</div><div class="small muted">пользователей</div></div>';
      }).join('') + '</div>';
  }

  function pageAdminRoles() {
    return '<div class="section__head"><h2>Роли и права</h2><span class="muted small">динамические роли и разрешения на объекты (RBAC + ABAC)</span></div>' +
      '<div class="row" style="margin-bottom:12px"><button class="btn btn--sm" data-modal="role" data-eid="btn-add-role" data-elabel="Кнопка «Новая роль»">Новая роль</button>' +
      '<button class="btn btn--soft btn--sm" data-action="Права сохранены (демонстрация)">Сохранить матрицу</button></div>' +
      '<div class="table-wrap" data-eid="roles-matrix" data-elabel="Матрица прав"><table><thead><tr><th>Право</th>' +
      DB.roles.map(function (r) { return '<th>' + esc(r.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      DB.rights.map(function (right) {
        return '<tr><td>' + esc(right.name) + '<div class="small muted">' + esc(right.id) + '</div></td>' +
          DB.roles.map(function (r) {
            var on = r.rights.indexOf('*') !== -1 || r.rights.indexOf(right.id) !== -1;
            return '<td><input type="checkbox" ' + (on ? 'checked' : '') + ' data-action="Право изменено (демонстрация)"></td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="card" style="margin-top:16px" data-eid="abac" data-elabel="Блок ABAC"><h3>Атрибуты доступа (ABAC)</h3>' +
        '<p class="small muted">Помимо роли доступ может зависеть от атрибутов: подразделение, категория заявки, статус, принадлежность экземпляра.</p>' +
        '<div class="grid grid--3"><div class="card card--flat"><b class="small">Правило 1</b><div class="small muted">Сотрудник видит заявки только своего подразделения</div></div>' +
        '<div class="card card--flat"><b class="small">Правило 2</b><div class="small muted">Смена статуса — только у назначенного ответственного</div></div>' +
        '<div class="card card--flat"><b class="small">Правило 3</b><div class="small muted">Администратор видит все объекты, действия пишутся в аудит</div></div></div></div>';
  }

  function pageAdminAudit() {
    return '<div class="section__head"><h2>Аудит и логи</h2><span class="muted small">кто, что и когда сделал в системе</span></div>' +
      '<div class="filterbar" data-eid="audit-filter" data-elabel="Фильтр аудита">' +
        '<input type="search" placeholder="Поиск по пользователю или объекту" style="max-width:300px">' +
        '<select style="max-width:220px"><option>Все действия</option><option>Заявки</option><option>Тикеты</option><option>Права</option><option>Интеграции</option></select>' +
        '<button class="btn btn--soft btn--sm" data-action="Выгрузка журнала (демонстрация)">Выгрузить CSV</button></div>' +
      '<div class="table-wrap" style="margin-top:16px" data-eid="audit-table" data-elabel="Журнал аудита"><table><thead><tr>' +
      '<th>Дата и время</th><th>Пользователь</th><th>Действие</th><th>Объект</th><th>IP</th></tr></thead><tbody>' +
      DB.audit.map(function (a) {
        return '<tr><td>' + esc(a.date) + '</td><td>' + esc(a.actor) + '</td><td>' + esc(a.action) + '</td>' +
          '<td style="white-space:normal">' + esc(a.object) + '</td><td class="muted">' + esc(a.ip) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function pageAdminIntegrations() {
    return '<div class="section__head"><h2>Интеграции и шаблоны</h2><span class="muted small">1С, база вуза, уведомления, документы</span></div>' +
      '<div class="grid grid--2">' + DB.integrations.map(function (i) {
        return '<article class="card" data-eid="integration-' + esc(i.name) + '" data-elabel="Интеграция ' + esc(i.name) + '">' +
          '<div class="row row--between"><h3 style="margin:0">' + esc(i.name) + '</h3>' + chip(i.status) + '</div>' +
          '<div class="small muted">Тип: ' + esc(i.type) + '</div>' +
          '<p class="small" style="margin:8px 0 0">' + esc(i.desc) + '</p></article>';
      }).join('') + '</div>' +
      '<div class="card" style="margin-top:16px" data-eid="templates" data-elabel="Шаблоны документов"><h3>Шаблоны документов</h3>' +
        '<div class="table-wrap"><table><thead><tr><th>Шаблон</th><th>Формат</th><th>Обновлён</th><th>Действия</th></tr></thead><tbody>' +
        DB.docTemplates.map(function (t) {
          return '<tr><td>' + esc(t.name) + '</td><td>' + esc(t.format) + '</td><td>' + esc(t.updated) + '</td>' +
            '<td><button class="btn btn--soft btn--sm" data-action="Редактор шаблона (демонстрация)">Открыть</button></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="ed-hint" style="margin-top:12px">Документы генерируются из шаблонов (PDF/Word), версии хранятся, сканы прикладываются к заявке. В перспективе — электронная подпись.</div></div>';
  }

  /* ---------- модальные окна ---------- */

  var MODALS = {
    'apply': function (arg) {
      var a = appById(arg);
      if (!a) return null;
      return {
        title: 'Подача заявки: ' + a.title,
        body: '<div class="field"><label>ФИО заявителя</label><input type="text" value="' + esc(DB.user.name) + '"></div>' +
          '<div class="field"><label>Группа / подразделение</label><input type="text" value="' + esc(DB.user.group) + '"></div>' +
          '<div class="field"><label>Комментарий к заявке</label><textarea placeholder="Необязательно"></textarea></div>' +
          '<div class="field"><label>Обязательные документы</label><ul class="data-list small">' +
            a.docs.map(function (d) { return '<li><span>' + esc(d) + '</span>' + chip('прикрепить', 'chip--warn') + '</li>'; }).join('') +
          '</ul><button class="btn btn--soft btn--sm" data-action="Файл выбран (демонстрация)">Прикрепить файлы</button></div>' +
          '<div class="ed-hint">Форма демонстрационная: после отправки заявка появится в разделе «Мои обращения», а уведомления будут приходить на email и push.</div>',
        ok: 'Отправить заявку',
        after: function () { go('#/my'); toast('Заявка отправлена (демонстрация). Отслеживайте этапы в «Мои обращения»', 'ok'); }
      };
    },
    'new-ticket': function () {
      return {
        title: 'Новое обращение в поддержку',
        body: '<div class="field"><label>Тема</label><input type="text" placeholder="Кратко о вопросе"></div>' +
          '<div class="field"><label>Кому адресовать</label><select><option>Общий пул (оператор направит)</option>' +
            DB.departments.map(function (d) { return '<option>' + esc(d.name) + '</option>'; }).join('') +
            '<option>Конкретному сотруднику</option></select></div>' +
          '<div class="field"><label>Описание</label><textarea placeholder="Опишите ситуацию, приложите детали"></textarea></div>' +
          '<div class="field"><label>Вложение</label><button class="btn btn--soft btn--sm" data-action="Файл выбран (демонстрация)">Прикрепить файл</button></div>' +
          '<div class="ed-hint">Пока вы печатаете, система предложила бы похожие материалы базы знаний — это снижает число тикетов.</div>',
        ok: 'Создать обращение',
        after: function () { toast('Обращение создано (демонстрация), передано в общий пул', 'ok'); go('#/support'); }
      };
    },
    'ticket-to': function (id) {
      var d = DB.departments.filter(function (x) { return x.id === id; })[0] || { name: id };
      return {
        title: 'Обращение в ' + d.name,
        body: '<div class="field"><label>Тема</label><input type="text" placeholder="Тема обращения"></div>' +
          '<div class="field"><label>Описание</label><textarea></textarea></div>' +
          '<div class="ed-hint">Адресат: <b>' + esc(d.name) + '</b>. Тикет сразу попадёт в панель подразделения.</div>',
        ok: 'Отправить', after: function () { toast('Обращение направлено в ' + d.name + ' (демонстрация)', 'ok'); }
      };
    },
    'route': function (id) {
      return {
        title: 'Распределение тикета ' + id,
        body: '<div class="field"><label>Подразделение</label><select>' + DB.departments.map(function (d) { return '<option>' + esc(d.name) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>Сотрудник</label><select>' + DB.employees.map(function (e) { return '<option>' + esc(e.name) + ' — ' + esc(e.role) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>Приоритет</label><select><option>Обычный</option><option>Высокий</option><option>Низкий</option></select></div>' +
          '<div class="field"><label>Комментарий для сотрудника</label><textarea></textarea></div>' +
          '<div class="ed-hint">Тикет появится в панели выбранного сотрудника, автор получит уведомление и увидит ответственного.</div>',
        ok: 'Назначить', after: function () { toast('Тикет ' + id + ' назначен (демонстрация)', 'ok'); }
      };
    },
    'invite': function () {
      return {
        title: 'Добавить пользователя',
        body: '<div class="field"><label>ФИО</label><input type="text"></div>' +
          '<div class="field"><label>Email</label><input type="email"></div>' +
          '<div class="field"><label>Роль</label><select>' + DB.roles.map(function (r) { return '<option>' + esc(r.name) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>Подразделение</label><select>' + DB.departments.map(function (d) { return '<option>' + esc(d.name) + '</option>'; }).join('') + '</select></div>' +
          '<div class="check"><input type="checkbox" checked><span>Отправить приглашение на почту</span></div>',
        ok: 'Добавить', after: function () { toast('Пользователь добавлен (демонстрация)', 'ok'); }
      };
    },
    'role': function () {
      return {
        title: 'Новая роль',
        body: '<div class="field"><label>Название роли</label><input type="text" placeholder="Например: Специалист по общежитиям"></div>' +
          '<div class="field"><label>Права</label><div class="grid grid--2">' +
            DB.rights.map(function (r) { return '<label class="check"><input type="checkbox"><span class="small">' + esc(r.name) + '</span></label>'; }).join('') +
          '</div></div>' +
          '<div class="ed-hint">Роль можно ограничить конкретными объектами или экземплярами — как в системах контроля доступа на основе ролей и атрибутов.</div>',
        ok: 'Создать роль', after: function () { toast('Роль создана (демонстрация)', 'ok'); }
      };
    }
  };

  function openModal(name, arg) {
    var cfg = MODALS[name] ? MODALS[name](arg) : null;
    if (!cfg) { toast('Окно недоступно в макете', 'warn'); return; }
    var root = document.getElementById('modal-root');
    root.innerHTML = '<div class="modal-backdrop" data-eid="modal-backdrop" data-elabel="Модальное окно">' +
      '<div class="modal" role="dialog" aria-modal="true" data-eid="modal" data-elabel="Окно: ' + esc(cfg.title) + '">' +
        '<div class="modal__head"><h3 style="margin:0">' + esc(cfg.title) + '</h3><button class="modal__close" data-close="1">×</button></div>' +
        '<div class="modal__body">' + cfg.body + '</div>' +
        '<div class="modal__foot"><button class="btn btn--soft" data-close="1">Отмена</button>' +
        '<button class="btn" data-confirm="1">' + esc(cfg.ok || 'Готово') + '</button></div>' +
      '</div></div>';
    if (window.Editor) window.Editor.afterRender();
    root.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
    var confirm = root.querySelector('[data-confirm]');
    if (confirm) confirm.addEventListener('click', function () { closeModal(); if (cfg.after) cfg.after(); });
    root.querySelector('.modal-backdrop').addEventListener('click', function (e) {
      if (e.target === root.querySelector('.modal-backdrop')) closeModal();
    });
  }

  function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

  function toast(text, kind) {
    var box = document.getElementById('toasts');
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' toast--' + kind : '');
    t.textContent = text;
    box.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  window.toast = toast;

  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  /* ---------- роутер ---------- */

  function render() {
    var hash = location.hash || '#/home';
    var parts = hash.replace(/^#\/?/, '').split('/');
    var page = parts[0] || 'home';
    var arg = parts[1] || '';
    var view = document.getElementById('view');
    var html = '';

    switch (page) {
      case 'home': html = pageHome(); break;
      case 'applications': html = pageApplications(); break;
      case 'application': html = pageApplication(arg); break;
      case 'my': html = pageMy(); break;
      case 'support': html = pageSupport(); break;
      case 'ticket': html = pageTicket(arg); break;
      case 'faq': html = pageFaq(); break;
      case 'directory': html = pageDirectory(); break;
      case 'profile': html = pageProfile(); break;
      case 'notifications': html = pageNotifications(); break;
      case 'admin':
        switch (arg) {
          case 'tickets': html = pageAdminTickets(); break;
          case 'metrics': html = pageAdminMetrics(); break;
          case 'constructor': html = pageConstructor(); break;
          case 'users': html = pageAdminUsers(); break;
          case 'roles': html = pageAdminRoles(); break;
          case 'audit': html = pageAdminAudit(); break;
          case 'integrations': html = pageAdminIntegrations(); break;
          default: html = pageAdminTickets();
        }
        break;
      default: html = pageHome();
    }

    view.innerHTML = html;
    renderHeader();
    bindPage(page, arg);
    if (window.Editor) window.Editor.afterRender();
    window.scrollTo(0, 0);
  }

  function bindPage(page, arg) {
    if (page === 'applications') {
      renderAppList();
      var s = document.getElementById('apps-search');
      s.addEventListener('input', function () { state.appsQuery = s.value; renderAppList(); });
      document.getElementById('apps-cats').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-cat]');
        if (!b) return;
        state.appsCat = b.getAttribute('data-cat');
        document.querySelectorAll('#apps-cats button').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        renderAppList();
      });
    }
    if (page === 'faq') {
      renderFaqList();
      var f = document.getElementById('faq-search');
      f.addEventListener('input', function () { state.faqQuery = f.value; renderFaqList(); });
    }
    if (page === 'admin' && arg === 'tickets') {
      document.getElementById('ticket-tabs').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-tf]');
        if (!b) return;
        state.ticketFilter = b.getAttribute('data-tf');
        render();
      });
    }
    if (page === 'admin' && arg === 'constructor') bindConstructor();
  }

  function bindConstructor() {
    if (!state.constructor) state.constructor = DB.constructorDraft.map(function (b) { return { kind: b.kind, title: b.title, meta: b.meta }; });

    function refresh() { render(); }

    var canvas = document.getElementById('ctor-canvas');
    document.querySelectorAll('.palette__item').forEach(function (b) {
      b.addEventListener('click', function () {
        var kind = b.getAttribute('data-kind');
        var block = DB.constructorBlocks.filter(function (x) { return x.kind === kind; })[0];
        state.constructor.push({ kind: kind, title: block.title, meta: 'новый блок' });
        state.ctorSelected = state.constructor.length - 1;
        toast('Блок «' + block.title + '» добавлен (демонстрация)');
        refresh();
      });
      b.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', 'new:' + b.getAttribute('data-kind')); });
    });

    if (canvas) {
      canvas.addEventListener('dragover', function (e) { e.preventDefault(); canvas.classList.add('is-over'); });
      canvas.addEventListener('dragleave', function () { canvas.classList.remove('is-over'); });
      canvas.addEventListener('drop', function (e) {
        e.preventDefault(); canvas.classList.remove('is-over');
        var data = e.dataTransfer.getData('text/plain') || '';
        if (data.indexOf('new:') === 0) {
          var kind = data.slice(4);
          var block = DB.constructorBlocks.filter(function (x) { return x.kind === kind; })[0];
          state.constructor.push({ kind: kind, title: block.title, meta: 'перетащен на холст' });
          toast('Блок добавлен на холст (демонстрация)');
        }
        refresh();
      });
      canvas.addEventListener('click', function (e) {
        if (e.target.closest('[data-del]')) return;
        var item = e.target.closest('.canvas__item');
        if (item) { state.ctorSelected = parseInt(item.getAttribute('data-idx'), 10); refresh(); }
      });
    }

    document.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        state.constructor.splice(parseInt(b.getAttribute('data-del'), 10), 1);
        state.ctorSelected = 0;
        refresh();
      });
    });

    var t = document.getElementById('ctor-title');
    if (t) t.addEventListener('input', function () {
      state.constructor[state.ctorSelected].title = t.value;
      document.querySelector('.canvas__item[data-idx="' + state.ctorSelected + '"] b').textContent = t.value;
      var pre = document.querySelector('.code');
      if (pre) pre.textContent = ctorJson();
    });
    var m = document.getElementById('ctor-meta');
    if (m) m.addEventListener('input', function () {
      state.constructor[state.ctorSelected].meta = m.value;
      var pre = document.querySelector('.code');
      if (pre) pre.textContent = ctorJson();
    });
    var del = document.getElementById('ctor-del');
    if (del) del.addEventListener('click', function () {
      state.constructor.splice(state.ctorSelected, 1);
      state.ctorSelected = 0;
      refresh();
    });
    var clr = document.getElementById('ctor-clear');
    if (clr) clr.addEventListener('click', function () {
      state.constructor = [];
      state.ctorSelected = 0;
      refresh();
    });
  }

  /* ---------- глобальные обработчики ---------- */

  function bindGlobal() {
    document.addEventListener('click', function (e) {
      if (window.Editor && window.Editor.isEditing()) return;
      var goEl = e.target.closest('[data-go]');
      if (goEl) { e.preventDefault(); go(goEl.getAttribute('data-go')); return; }
      var modalEl = e.target.closest('[data-modal]');
      if (modalEl) {
        e.preventDefault();
        var raw = modalEl.getAttribute('data-modal');
        var p = raw.split(':');
        openModal(p[0], p[1]);
        return;
      }
      var actEl = e.target.closest('[data-action]');
      if (actEl) {
        e.preventDefault();
        if (actEl.tagName === 'INPUT') return;
        toast(actEl.getAttribute('data-action'));
      }
    });

    document.addEventListener('change', function (e) {
      if (e.target.id === 'role-select') {
        state.role = e.target.value;
        toast('Роль переключена: ' + e.target.options[e.target.selectedIndex].text);
        render();
        return;
      }
      if (e.target.matches('input[type="checkbox"][data-action]')) {
        toast(e.target.getAttribute('data-action'));
      }
    });

    document.addEventListener('click', function (e) {
      var toggle = e.target.closest('#ed-toggle');
      if (toggle && window.Editor) {
        e.preventDefault();
        window.Editor.setEditing(!window.Editor.isEditing());
      }
    });

    window.addEventListener('hashchange', render);
  }

  /* ---------- старт ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    if (window.Editor) window.Editor.init();
    bindGlobal();
    if (!location.hash) location.hash = '#/home';
    render();
  });
})();
