import {categories, districts, guides} from './data.js';
import {freshState, STORE_KEY, allInitiatives, getInitiative, join, leave, toggleSaved, toggleTask, metrics, filterInitiatives, validateDraft, createInitiative, importState, safeText, escapeHtml as e} from './domain.js';
import {icon, logo, art} from './visuals.js';

let state = freshState();
let storageWarning = '';
try {
  const stored = localStorage.getItem(STORE_KEY);
  if (stored) state = importState(stored);
} catch {
  storageWarning = 'Сохранённые данные недоступны или повреждены. Открыто чистое демо-пространство.';
}
const app = document.getElementById('app');
let activeTab = 'joined';
let calendarMonth = 9;
let calendarYear = 2026;
let calendarDay = '';
let mapCategory = 'all';
let selectedMap = 'green-weekend';
let formDraft = {title:'',summary:'',category:'nature',district:state.profile.district,date:'2026-10-24',time:'10:00',duration:2};
let formErrors = {};
let createdId = '';
let dialogAction = null;
let dialogPreviousFocus = null;
let toastTimer;

const category = id => categories.find(c=>c.id===id) || categories[0];
const fmtDate = (date,options={day:'numeric',month:'long'}) => new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU',options);
const route = () => location.hash.replace(/^#\/?/,'').split('/');
const initials = () => state.profile.name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
const button = (label,href,kind='primary',ic='arrow') => `<a class="btn btn-${kind}" href="#/${href}">${label}${ic?icon(ic,15):''}</a>`;
function persist() {
  try { localStorage.setItem(STORE_KEY,JSON.stringify(state)); }
  catch { toast('Браузер не разрешил сохранение. Данные доступны до закрытия страницы.'); }
}
function toast(message) {
  const el=document.getElementById('toast');
  el.textContent=message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),3600);
}
function navLink(id,label,ic) {
  const current=route()[0]||'home';
  const active=current===id||(id==='initiatives'&&current==='initiative')||(id==='guides'&&current==='guide');
  return `<a href="#/${id}" class="${active?'active':''}" ${active?'aria-current="page"':''}>${icon(ic,18)}${label}</a>`;
}
function shell(content) {
  return `<div class="app-shell">
    <aside class="sidebar" id="sidebar" aria-label="Основная навигация">
      <a class="brand" href="#/home">${logo}<div>Qamqor<span>city · город заботы</span></div></a>
      <div class="nav-label">Ваш город</div>
      <nav class="nav">${navLink('home','Обзор','grid')}${navLink('initiatives','Инициативы','leaf')}${navLink('map','Карта добрых дел','map')}${navLink('calendar','Календарь','calendar')}</nav>
      <div class="nav-label">Ваше участие</div>
      <nav class="nav">${navLink('participation','Мои дела','heart')}${navLink('impact','Мой вклад','chart')}${navLink('guides','Полезное','book')}${navLink('profile','Профиль','settings')}</nav>
      <div class="sidebar-bottom"><div class="side-callout">${icon('spark',23)}<strong>Есть идея для города?</strong>Каждое большое дело начинается с маленького шага.<a href="#/create">Создать инициативу ${icon('plus',15)}</a></div>
      <a class="sidebar-profile" href="#/profile"><div class="avatar">${e(initials())}</div><div><b>${e(state.profile.name)}</b><small>Моё пространство</small></div>${icon('chevron',13)}</a></div>
    </aside>
    <div class="main-shell"><header class="topbar"><button class="mobile-menu" data-action="menu" aria-label="Открыть меню" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button><div class="location">${icon('pin',16)}Алматы<span class="muted">· мой город</span></div><div class="topbar-right"><form class="top-search" id="quick-search">${icon('search',16)}<input name="q" type="search" aria-label="Найти инициативу" placeholder="Найти доброе дело…" maxlength="100"></form><span class="demo-chip"><i class="dot"></i>Демо-пространство</span><a href="#/profile" class="avatar" aria-label="Мой профиль">${e(initials())}</a></div></header>
    <main class="content" id="page-content" tabindex="-1">${storageWarning?`<div class="inline-notice orange">${icon('info',17)}${e(storageWarning)}</div>`:''}${content}<footer class="footer"><span>© 2026 Qamqor City · Сделано для добрых перемен</span><span>Изменения на этом устройстве · <a href="#/profile">Данные и настройки</a></span></footer></main></div>
  </div>`;
}
function heading(kicker,title,subtitle,action='') {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`;
}
function categoryTag(item) {
  const c=category(item.category);
  return `<span class="tag ${c.color}">${icon(c.icon,11)}${c.name}</span>`;
}
function initiativeCard(item) {
  const saved=state.saved.includes(item.id);
  return `<article class="initiative-card"><div class="card-art"><a href="#/initiative/${e(item.id)}" aria-label="${e(item.title)}">${art(item.art)}</a>${categoryTag(item)}<button class="icon-btn ${saved?'saved':''}" data-action="save" data-id="${e(item.id)}" aria-label="${saved?'Убрать из сохранённого':'Сохранить инициативу'}" aria-pressed="${saved}">${icon('bookmark',15)}</button></div><div class="card-body"><h3><a href="#/initiative/${e(item.id)}">${e(item.title)}</a></h3><p>${e(item.summary)}</p><div class="meta-row"><span>${icon('pin',12)}${e(item.district)}</span><span>${icon('calendar',12)}${fmtDate(item.date,{day:'numeric',month:'short'})}</span><span>${icon('clock',12)}${item.duration} ч</span></div><div class="card-bottom"><span class="sample-note">${item.sample?'Пример инициативы':'Ваша инициатива'}</span><a class="small-link" href="#/initiative/${e(item.id)}">Подробнее ${icon('arrow',14)}</a></div></div></article>`;
}
function statCards() {
  const m=metrics(state);
  return `<div class="stats-grid">${[['leaf',allInitiatives(state).length,'идей в каталоге'],['heart',m.joined,'дел в вашем плане'],['check',m.done,'задач выполнено'],['bookmark',m.saved,'в сохранённом']].map(([ic,num,label])=>`<div class="stat-card"><div class="stat-icon">${icon(ic,21)}</div><div><b>${num}</b><span>${label}</span></div></div>`).join('')}</div>`;
}
function eventRow(item) {
  return `<a class="event-row" href="#/initiative/${e(item.id)}"><div class="date-box"><b>${fmtDate(item.date,{day:'numeric'})}</b><span>${fmtDate(item.date,{month:'short'}).replace('.','')}</span></div><div><h3>${e(item.title)}</h3><div class="meta-row"><span>${icon('clock',11)}${item.time}</span><span>${icon('pin',11)}${e(item.district)}</span></div></div>${icon('arrow',15)}</a>`;
}
function empty(title,text,cta='Найти своё дело',href='initiatives') {
  return `<div class="empty"><div class="empty-icon">${icon('leaf',27)}</div><h2>${title}</h2><p>${text}</p>${button(cta,href)}</div>`;
}
function homePage() {
  const m=metrics(state);
  const upcoming=allInitiatives(state).slice().sort((a,b)=>a.date.localeCompare(b.date));
  return `${heading('Вместе меняем город','Город начинается с нас.','Находите близкие по духу инициативы и делайте первый шаг.',button('Предложить идею','create','light','plus'))}
    <section class="hero"><div class="hero-copy"><div class="hero-kicker">${icon('leaf',13)}Маленькие действия. Большой смысл.</div><h2>Чуть больше заботы.<br>Чуть лучше город.</h2><p>Чистый парк, разговор с соседом, новое знание. Найдите дело, в котором нужен именно ваш вклад.</p>${button('Найти своё дело','initiatives','primary')}</div><div class="hero-art">${art('park')}</div></section>
    ${statCards()}
    <div class="section-heading"><h2>Идеи рядом с вами</h2><a class="btn-plain" href="#/initiatives">Все инициативы ${icon('arrow',16)}</a></div><div class="card-grid home-cards">${allInitiatives(state).slice(0,3).map(initiativeCard).join('')}</div>
    <div class="two-columns"><section class="panel"><div class="section-heading"><h2>В календаре</h2><a class="btn-plain" href="#/calendar">Смотреть всё ${icon('arrow',14)}</a></div>${upcoming.slice(0,3).map(eventRow).join('')}</section>
    <section class="panel impact-mini">${icon('leaf',100)}<div><span class="eyebrow">Ваш личный вклад</span><h2>Каждый шаг<br>имеет значение.</h2><p>Собирайте личный план, отмечайте задачи и наблюдайте за своим прогрессом.</p></div><div><div class="impact-line"><span>Выполнено задач</span><b>${m.done} из ${m.total}</b></div><div class="progress"><span style="width:${m.percent}%"></span></div><a class="btn-plain mt-20" href="#/impact">Мой вклад ${icon('arrow',15)}</a></div></section></div>
    <div class="inline-notice">${icon('info',16)}Это рабочий прототип: инициативы и даты — примеры для знакомства с сервисом. Ваш план, заметки и отметки сохраняются только в этом браузере.</div>`;
}
function catalogPage() {
  const items=filterInitiatives(allInitiatives(state),state.filters);
  return `${heading('Хорошие перемены рядом','Найдите своё доброе дело','Выберите тему, которая вам близка. Начните с небольшого шага.',button('Создать инициативу','create','primary','plus'))}<div class="pill-row">${categories.map(c=>`<button class="pill ${state.filters.category===c.id?'active':''}" data-action="filter-category" data-id="${c.id}" aria-pressed="${state.filters.category===c.id}">${icon(c.icon,15)}${c.name}</button>`).join('')}</div>
    <form id="catalog-filters" class="filters"><div class="search-box">${icon('search',18)}<input class="input" type="search" name="query" value="${e(state.filters.query)}" placeholder="Название, тема или район" aria-label="Поиск инициатив" maxlength="100"></div><select name="district" aria-label="Район"><option value="all">Все районы</option>${districts.map(d=>`<option ${state.filters.district===d?'selected':''}>${d}</option>`).join('')}</select><button class="btn btn-primary">Найти</button>${state.filters.query||state.filters.category!=='all'||state.filters.district!=='all'?'<button type="button" class="btn btn-light" data-action="clear-filters">Сбросить</button>':''}</form>
    <div class="results-count">Найдено: ${items.length} · ${state.created.length?'включая ваши локальные идеи':'Все инициативы — демонстрационные примеры'}</div><div class="card-grid">${items.length?items.map(initiativeCard).join(''):empty('Здесь пока тихо','Измените направление или район. Возможно, ваше доброе дело чуть ближе, чем кажется.','Сбросить поиск','initiatives-reset')}</div>`;
}
function detailPage(id) {
  const item=getInitiative(state,id);
  if(!item)return notFound();
  const joined=state.joined.includes(id),saved=state.saved.includes(id);
  const completed=item.tasks.filter(t=>state.completed.includes(t.id)).length;
  return `<a class="back-link" href="#/initiatives">${icon('arrowLeft',15)}К инициативам</a><div class="detail-layout"><div class="detail-copy">${categoryTag(item)}<h1 class="detail-title">${e(item.title)}</h1><div class="meta-row"><span>${icon('pin',14)}Алматы, ${e(item.district)}</span><span>${icon('calendar',14)}${fmtDate(item.date)}</span><span>${item.sample?'Пример инициативы':'Локальная инициатива'}</span></div><div class="detail-art">${art(item.art)}</div><h2>О чём эта инициатива</h2><p>${e(item.summary)}</p><div class="inline-notice">${icon('info',17)}${item.sample?'Это пример сценария участия. Реальное мероприятие не организовано, запись никому не отправляется.':'Это ваша локальная идея. Она видна только на этом устройстве и не опубликована для других людей.'}</div><h2>Ваш план действий</h2><p>${joined?'Отмечайте выполненные шаги — они появятся в вашем личном вкладе.':'Добавьте инициативу в план, чтобы отмечать шаги и вести личные заметки.'}</p>${item.tasks.map(t=>`<button class="task-row ${state.completed.includes(t.id)?'done':''}" data-action="task" data-id="${e(id)}" data-task="${e(t.id)}" ${joined?'':'disabled'} aria-pressed="${state.completed.includes(t.id)}"><span class="task-box">${state.completed.includes(t.id)?icon('check',14):''}</span><span>${e(t.title)}</span></button>`).join('')}<h2>Подготовьтесь с заботой о себе</h2><p>Начните с небольшого посильного шага. Для реального участия отдельно уточните организатора, условия и безопасность. Не добавляйте чужие личные данные в заметки.</p><a class="btn-plain" href="#/guide/safe-volunteering">Открыть памятку участника ${icon('arrow',15)}</a></div><aside class="panel details-side"><div class="eyebrow">Место в вашем плане</div><h2>${joined?'Вы сделали первый шаг':'Начните с одного дела'}</h2><div class="info-list"><div class="info-item">${icon('calendar',20)}<div><span>${item.sample?'Пример даты':'Плановая дата'}</span><b>${fmtDate(item.date,{day:'numeric',month:'long',year:'numeric'})}</b></div></div><div class="info-item">${icon('clock',20)}<div><span>Начало и плановая длительность</span><b>${item.time} · ${item.duration} ч</b></div></div><div class="info-item">${icon('pin',20)}<div><span>Район</span><b>${e(item.district)}</b></div></div></div>${joined?`<button class="btn btn-soft full" disabled>${icon('check',15)}Добавлено в план</button>${button('Перейти к моим делам','participation','primary')}<div class="impact-line"><span>Выполнено задач</span><b>${completed}/${item.tasks.length}</b></div><div class="progress"><span style="width:${completed/item.tasks.length*100}%"></span></div><button class="btn btn-light full" data-action="leave" data-id="${e(id)}">Убрать из плана</button>`:`<button class="btn btn-primary full" data-action="join" data-id="${e(id)}">${icon('plus',15)}Добавить в мой план</button>`}<button class="btn btn-light full" data-action="save" data-id="${e(id)}">${icon('bookmark',15)}${saved?'В сохранённом':'Сохранить на потом'}</button><p class="subtitle">План сохраняется на этом устройстве. Это личная отметка интереса.</p></aside></div>`;
}
function participationPage() {
  const items=allInitiatives(state).filter(i=>activeTab==='joined'?state.joined.includes(i.id):activeTab==='saved'?state.saved.includes(i.id):!i.sample);
  return `${heading('Небольшие шаги каждый день','Мои добрые дела','Ваш план, любимые инициативы и заметки — в одном месте.',button('Найти новое дело','initiatives','light','plus'))}<div class="pill-row">${[['joined','Мой план',state.joined.length],['saved','Сохранённое',state.saved.length],['created','Мои инициативы',state.created.length]].map(([id,label,n])=>`<button class="pill ${activeTab===id?'active':''}" data-action="participation-tab" data-id="${id}" aria-pressed="${activeTab===id}">${label}<span>${n}</span></button>`).join('')}</div>${!items.length?empty(activeTab==='joined'?'Ваш первый шаг впереди':activeTab==='saved'?'Сохраните то, что откликается':'Здесь появится ваша идея',activeTab==='joined'?'Выберите инициативу и добавьте её в личный план. Здесь появятся задачи и место для заметок.':activeTab==='saved'?'Нажмите значок закладки на любой карточке, чтобы вернуться к ней позже.':'Сформулируйте маленькую перемену, которую хотите попробовать в своём районе.',activeTab==='created'?'Создать инициативу':'Найти своё дело',activeTab==='created'?'create':'initiatives'):activeTab==='joined'?items.map(i=>`<section class="participation-card"><div class="participation-head"><div>${categoryTag(i)}<h3><a href="#/initiative/${e(i.id)}">${e(i.title)}</a></h3></div><div class="meta-row"><span>${icon('calendar',13)}${fmtDate(i.date)}</span><button class="btn btn-light" data-action="leave" data-id="${e(i.id)}">Убрать из плана</button></div></div><div class="mini-stats"><span>${i.tasks.filter(t=>state.completed.includes(t.id)).length} из ${i.tasks.length} задач выполнено</span><span>План: ${i.duration} ч</span></div>${i.tasks.map(t=>`<button class="task-row ${state.completed.includes(t.id)?'done':''}" data-action="task" data-id="${e(i.id)}" data-task="${e(t.id)}" aria-pressed="${state.completed.includes(t.id)}"><span class="task-box">${state.completed.includes(t.id)?icon('check',14):''}</span><span>${e(t.title)}</span></button>`).join('')}<label class="notes-label" for="note-${e(i.id)}">Личная заметка</label><textarea id="note-${e(i.id)}" data-note="${e(i.id)}" maxlength="2000" placeholder="Что получилось? Какой следующий шаг?">${e(state.notes[i.id]||'')}</textarea><small class="muted">Сохраняется после выхода из поля · без чужих личных данных</small></section>`).join(''):`<div class="card-grid">${items.map(initiativeCard).join('')}</div>`}`;
}
function mapPage() {
  const items=allInitiatives(state).filter(i=>mapCategory==='all'||i.category===mapCategory);
  let selected=items.find(i=>i.id===selectedMap)||items[0];
  const roads=`<svg viewBox="0 0 600 550" preserveAspectRatio="none" aria-hidden="true"><rect width="600" height="550" fill="#e9eddf"/><g fill="#d5dec9"><rect x="22" y="24" width="92" height="73" rx="13"/><rect x="152" y="27" width="100" height="74" rx="12"/><rect x="290" y="25" width="95" height="76" rx="12"/><rect x="423" y="30" width="138" height="63" rx="14"/><rect x="32" y="148" width="81" height="120" rx="13"/><rect x="154" y="140" width="92" height="106" rx="14"/><rect x="286" y="142" width="105" height="106" rx="13"/><rect x="443" y="138" width="118" height="102" rx="14"/><rect x="19" y="314" width="106" height="112" rx="11"/><rect x="162" y="294" width="77" height="130" rx="12"/><rect x="282" y="292" width="97" height="131" rx="12"/><rect x="419" y="292" width="138" height="131" rx="14"/></g><g stroke="#fdfdf7" stroke-width="21" fill="none"><path d="M130 0v550M268 0v550M408 0v550M0 120h600M0 270h600M0 447h600"/></g><path d="M578 0c-96 140 35 233-13 326S405 480 506 550" stroke="#bbd8d2" stroke-width="35" fill="none"/><path d="m0 485 187-13 128 51 117-14 83 41H0" fill="#bfd0a6"/><g fill="#a3bb8b"><circle cx="50" cy="369" r="21"/><circle cx="89" cy="384" r="25"/><circle cx="54" cy="410" r="20"/><circle cx="323" cy="183" r="19"/><circle cx="350" cy="209" r="25"/><circle cx="314" cy="218" r="16"/></g><g fill="#9fae92" font-size="11" font-family="Arial"><text x="60" y="286">улица Соседей</text><text x="160" y="115">проспект Добрых дел</text><text x="426" y="265">Зелёный квартал</text><text x="18" y="500">Городской парк</text></g></svg>`;
  return `${heading('Посмотрите вокруг','Карта добрых дел','Найдите идею в разных районах демонстрационного города.')}<div class="pill-row">${categories.map(c=>`<button class="pill ${mapCategory===c.id?'active':''}" data-action="map-category" data-id="${c.id}">${icon(c.icon,15)}${c.name}</button>`).join('')}</div><div class="map-layout"><div class="city-map" aria-label="Схематическая карта инициатив">${roads}${items.map(i=>`<button class="map-pin ${category(i.category).color} ${selected?.id===i.id?'active':''}" style="left:${i.x}%;top:${i.y}%" data-action="map-select" data-id="${e(i.id)}" aria-label="${e(i.title)}, ${e(i.district)}" aria-pressed="${selected?.id===i.id}">${icon(category(i.category).icon,16)}</button>`).join('')}<div class="map-key">${icon('info',12)} Схематическая иллюстрация. Метки условные, для навигации не подходит.</div></div><div class="map-selection"><div><h3>Выбранная инициатива</h3>${selected?initiativeCard(selected):'<p>Нет инициатив в этом направлении.</p>'}<p class="map-caption">Нажмите на метку, чтобы узнать больше. Районы указаны в карточках; размещение на схеме условное.</p></div><div class="panel"><div class="eyebrow">От идеи к действию</div><h3>Не нашли свою тему?</h3><p class="subtitle">Предложите собственную инициативу и добавьте её в личное пространство.</p>${button('Добавить идею','create','soft','plus')}</div></div></div><div class="legend">${categories.slice(1).map(c=>`<span><i class="${c.color}"></i>${c.name}</span>`).join('')}</div>`;
}
function calendarPage() {
  const first=new Date(calendarYear,calendarMonth,1),days=new Date(calendarYear,calendarMonth+1,0).getDate();
  const offset=(first.getDay()+6)%7;
  const monthKey=`${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}`;
  const items=allInitiatives(state).filter(i=>i.date.startsWith(monthKey)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const shown=calendarDay?items.filter(i=>i.date===calendarDay):items;
  return `${heading('Время для добрых перемен','Календарь города','Соберите свой ритм участия. Все даты в каталоге — примеры.')}<div class="calendar-layout"><section class="panel"><div class="calendar-toolbar"><h2>${first.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</h2><div class="button-row"><button class="icon-btn" data-action="calendar-prev" aria-label="Предыдущий месяц">${icon('arrowLeft',16)}</button><button class="icon-btn" data-action="calendar-next" aria-label="Следующий месяц">${icon('arrow',16)}</button></div></div><div class="calendar-grid">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>`<div class="weekday">${d}</div>`).join('')}${Array.from({length:offset},()=>'<div class="day blank"></div>').join('')}${Array.from({length:days},(_,idx)=>{const d=`${monthKey}-${String(idx+1).padStart(2,'0')}`,count=items.filter(i=>i.date===d).length;return `<button class="day ${count?'has-events':''} ${calendarDay===d?'selected':''}" data-action="calendar-day" data-id="${d}" aria-label="${fmtDate(d)}, инициатив: ${count}" aria-pressed="${calendarDay===d}">${idx+1}${count?'<span class="date-dot"></span>':''}</button>`;}).join('')}</div><p class="subtitle">Дни с точкой — даты примеров инициатив. Нажмите на день для фильтрации.</p></section><section class="panel calendar-list"><div class="section-heading"><h2>${calendarDay?fmtDate(calendarDay):'В этом месяце'}</h2>${calendarDay?'<button class="calendar-clear" data-action="calendar-clear">Весь месяц</button>':''}</div>${shown.length?shown.map(eventRow).join(''):`<p class="subtitle">На ${calendarDay?'этот день':'этот месяц'} пока нет инициатив. Можно предложить свою.</p>${button('Предложить идею','create','soft','plus')}`}</section></div><div class="highlight-band"><div><h3>Ваш план всегда под рукой</h3><p>Добавьте инициативу в план на странице события и отмечайте выполненные шаги.</p></div>${button('Мои добрые дела','participation','primary')}</div>`;
}
function createPage() {
  if(createdId){const item=getInitiative(state,createdId);return `<section class="panel create-success"><div class="empty-icon">${icon('check',30)}</div><div class="eyebrow">Первый шаг сделан</div><h1>У вашей идеи теперь есть план.</h1><p>«${e(item.title)}» появилась в локальном каталоге. Она сохранена на этом устройстве; другим пользователям ничего не отправлено.</p><div class="button-row" style="justify-content:center">${button('Открыть инициативу',`initiative/${e(createdId)}`)}<button class="btn btn-light" data-action="new-draft">Создать ещё одну</button></div></section>`;}
  const field=(name,label,html,hint='')=>`<div class="field"><label for="${name}">${label}</label>${html}${formErrors[name]?`<div class="field-error" id="${name}-error">${formErrors[name]}</div>`:''}${hint?`<span class="hint">${hint}</span>`:''}</div>`;
  const input=(name,type,extra='')=>`<input class="input" id="${name}" name="${name}" type="${type}" value="${e(formDraft[name])}" ${extra} aria-invalid="${!!formErrors[name]}" ${formErrors[name]?`aria-describedby="${name}-error"`:''}>`;
  return `${heading('От мысли к первому шагу','У города есть ваша идея','Опишите небольшое полезное действие. Мы поможем собрать план.')}<div class="form-layout"><form id="create-form" class="panel form-panel" novalidate><h2>Расскажите об инициативе</h2>${field('title','Название инициативы',input('title','text','maxlength="80" placeholder="Например: Книжная полка нашего двора"'),'От 6 до 80 символов — коротко и понятно.')}<div class="form-row">${field('category','Направление',`<select id="category" name="category">${categories.slice(1).map(c=>`<option value="${c.id}" ${formDraft.category===c.id?'selected':''}>${c.name}</option>`).join('')}</select>`)}${field('district','Район',`<select id="district" name="district">${districts.map(d=>`<option ${formDraft.district===d?'selected':''}>${d}</option>`).join('')}</select>`)}</div>${field('summary','Что вы хотите сделать?',`<textarea id="summary" name="summary" maxlength="1500" placeholder="Какую задачу решает ваша идея? С чего можно начать?" aria-invalid="${!!formErrors.summary}" ${formErrors.summary?'aria-describedby="summary-error"':''}>${e(formDraft.summary)}</textarea>`,'От 40 до 1500 символов. Не указывайте личные данные других людей.')}<div class="form-row">${field('date','Плановая дата',input('date','date','min="2020-01-01" max="2100-12-31"'))}${field('time','Время начала',input('time','time'))}</div>${field('duration','Плановая длительность, часов',input('duration','number','min="0.5" max="12" step="0.5"'))}<div class="inline-notice">${icon('info',17)}Идея сохранится в вашем браузере. Это планирование, без публичной публикации и приглашения участников.</div><button class="btn btn-primary full" type="submit">${icon('plus',15)}Сохранить инициативу</button></form><aside class="preview-area"><div class="preview-label">Так будет выглядеть ваша карточка</div><div id="draft-preview">${draftPreview()}</div><div class="panel mt-20"><div class="eyebrow">Хорошая идея — понятная идея</div><h3>Начните с малого</h3><p class="subtitle">Опишите конкретный первый результат. Одно действие во дворе может стать началом полезной привычки.</p><a href="#/guide/organize" class="btn-plain mt-20">Как спланировать инициативу ${icon('arrow',15)}</a></div></aside></div>`;
}
function draftPreview() {
  const c=category(formDraft.category);
  return `<article class="initiative-card"><div class="card-art">${art('city')}<span class="tag ${c.color}">${icon(c.icon,11)}${c.name}</span></div><div class="card-body"><h3>${e(formDraft.title||'Название вашей инициативы')}</h3><p>${e(formDraft.summary||'Здесь появится история вашей идеи: кому она поможет и с чего начнётся первый шаг.')}</p><div class="meta-row"><span>${icon('pin',12)}${e(formDraft.district)}</span><span>${icon('clock',12)}${e(formDraft.duration||'—')} ч</span></div><div class="card-bottom"><span class="sample-note">Ваша локальная идея</span>${icon('arrow',15)}</div></div></article>`;
}
function impactPage() {
  const m=metrics(state),max=Math.max(1,...m.byCategory.map(c=>c.done));
  return `${heading('Важен каждый маленький шаг','Ваш вклад в добрые перемены','Прозрачный обзор ваших личных отметок. Всё начинается с первого действия.',`<button class="btn btn-light" data-action="export">${icon('download',15)}Экспорт данных</button>`)}${statCards()}<div class="two-columns"><section class="panel"><h2>В каких темах вы участвуете</h2><p class="subtitle">Выполненные задачи по направлениям</p><div class="impact-chart">${m.byCategory.map(c=>`<div class="bar-col"><b>${c.done}</b><div class="bar-fill" style="height:${c.done/max*145}px"></div></div>`).join('')}</div><div class="chart-labels">${m.byCategory.map(c=>`<span>${c.name}</span>`).join('')}</div></section><section class="panel"><h2>Шаг за шагом</h2><p class="subtitle">Завершённость личного плана</p><div class="impact-total"><div class="ring" style="--percent:${m.percent}%"><div class="ring-inner"><b>${m.percent}%</b><span>${m.done} из ${m.total} задач</span></div></div></div></section></div><div class="section-heading"><h2>Знаки вашего движения</h2><span class="tag">Личные достижения</span></div><div class="badges">${[['spark','Первый шаг','Добавьте одну инициативу в свой план.',m.joined>=1],['check','Дело сделано','Завершите все задачи одной инициативы.',m.finished>=1],['globe','Широкий кругозор','Добавьте инициативы из трёх направлений.',m.byCategory.filter(c=>c.count).length>=3]].map(([ic,title,text,on])=>`<div class="badge-card ${on?'unlocked':''}">${icon(ic,32)}<strong>${title} ${on?'✓':''}</strong><p>${text}</p></div>`).join('')}</div><div class="inline-notice">${icon('info',18)}Как считаем: задачи — ваши отметки, завершённые дела — планы со всеми отмеченными задачами. ${m.plannedHours} ч — суммарная плановая длительность выбранных инициатив, а не подтверждённые часы. Достижения не являются сертификатами и не доказывают общественный эффект.</div>${m.joined===0?`<div class="highlight-band"><div><h3>Самый важный шаг — первый</h3><p>Выберите небольшое дело, которое вам по силам.</p></div>${button('Посмотреть инициативы','initiatives')}</div>`:''}`;
}
function guidesPage() {
  return `${heading('Полезное рядом','Участие с пониманием','Понятные памятки для первых шагов, хороших встреч и честных результатов.')}<div class="guide-grid">${guides.map(g=>`<a class="guide-card" href="#/guide/${g.id}"><div class="guide-icon">${icon(g.icon,23)}</div><div class="eyebrow">${g.category}</div><h3>${g.title}</h3><p>${g.intro}</p><div class="card-bottom"><span>${icon('clock',12)} ${g.duration}</span><span>Читать ${icon('arrow',15)}</span></div></a>`).join('')}</div><div class="inline-notice">${icon('book',17)}Материалы — вводные памятки проекта. Для реальных мероприятий уточняйте местные условия, правила организатора и необходимость профессионального сопровождения.</div>`;
}
function guidePage(id) {
  const g=guides.find(g=>g.id===id);if(!g)return notFound();
  return `<article class="article"><a class="back-link" href="#/guides">${icon('arrowLeft',15)}К полезным материалам</a><div class="eyebrow">${g.category} · ${g.duration}</div><h1>${g.title}</h1><p class="lead">${g.intro}</p>${g.sections.map(([title,text],i)=>`<section><h2><span class="number-circle">${i+1}</span>${title}</h2><p>${text}</p></section>`).join('')}<div class="highlight-band"><div><h3>Попробуйте на небольшом деле</h3><p>Выберите подходящую инициативу для своего плана.</p></div>${button('К инициативам','initiatives')}</div><div class="section-heading"><h2>Читайте дальше</h2></div>${guides.filter(x=>x.id!==g.id).slice(0,2).map(x=>`<a class="event-row" href="#/guide/${x.id}"><div class="guide-icon">${icon(x.icon,20)}</div><div><h3>${x.title}</h3><small class="muted">${x.duration}</small></div>${icon('arrow',15)}</a>`).join('')}</article>`;
}
function profilePage() {
  return `${heading('Ваше пространство','Профиль и настройки','Управляйте своим именем, районом и локальными данными.')}<div class="settings-layout"><form class="panel form-panel" id="profile-form"><div class="profile-big"><div class="avatar">${e(initials())}</div><div><h2>${e(state.profile.name)}</h2><p>Локальный профиль · без регистрации</p></div></div><div class="field"><label for="profile-name">Как к вам обращаться?</label><input class="input" id="profile-name" name="name" value="${e(state.profile.name)}" maxlength="60" required></div><div class="field"><label for="profile-district">Ваш район</label><select id="profile-district" name="district">${districts.map(d=>`<option ${state.profile.district===d?'selected':''}>${d}</option>`).join('')}</select></div><button class="btn btn-primary" type="submit">Сохранить профиль ${icon('check',15)}</button><div class="inline-notice">${icon('shield',17)}Профиль существует в этом браузере. Контакты, пароль и документы не нужны.</div></form><section class="panel"><h2>Ваши данные — под контролем</h2><div class="setting-row"><div><h3>Сохранить резервную копию</h3><p>JSON-файл с профилем, планами, заметками и вашими инициативами.</p></div><button class="btn btn-light" data-action="export">${icon('download',15)}Экспорт</button></div><div class="setting-row"><div><h3>Восстановить из файла</h3><p>Импорт заменяет текущее пространство. Формат и данные проверяются перед сохранением.</p></div><button class="btn btn-light" data-action="import">${icon('upload',15)}Импорт</button><input class="visually-hidden" id="import-file" type="file" accept="application/json,.json" aria-label="Выберите резервную копию"></div><div class="setting-row"><div><h3>Начать с чистого листа</h3><p>Удалить локальные отметки, профиль и созданные идеи. Примеры останутся.</p></div><button class="btn btn-danger" data-action="reset">Сбросить</button></div></section></div><section class="panel mt-20"><div class="eyebrow">О проекте</div><h2>Qamqor значит «заботливый»</h2><p class="subtitle">Qamqor City — самостоятельный демонстрационный проект о гражданском участии. Каталог содержит ${allInitiatives(state).filter(i=>i.sample).length} примеров инициатив. Приложение помогает исследовать сценарии и вести личный план; организаторов, действующих партнёров и публичных заявок здесь нет. Исходный код подготовлен с помощью ИИ и предназначен для дальнейшей самостоятельной доработки.</p><div class="button-row mt-20">${button('Как измеряем вклад','guide/honest-impact','soft','chart')}${button('Памятка участника','guide/first-step','light','book')}</div></section>`;
}
function notFound(){return empty('Эта страница не найдена','Возможно, ссылка устарела или инициатива была удалена из локального пространства.','На главную','home');}
function render() {
  const [page,id]=route();
  if(page==='initiatives-reset'){state.filters=freshState().filters;persist();location.hash='/initiatives';return;}
  const pages={home:homePage,initiatives:catalogPage,initiative:()=>detailPage(id),participation:participationPage,map:mapPage,calendar:calendarPage,create:createPage,impact:impactPage,guides:guidesPage,guide:()=>guidePage(id),profile:profilePage};
  const selectedPage=page||'home';
  app.innerHTML=shell((Object.hasOwn(pages,selectedPage)?pages[selectedPage]:notFound)());
  const title=app.querySelector('h1')?.textContent||'Город начинается с нас';
  document.title=`${title} · Qamqor City`;
}
function showDialog(title,text,confirmLabel,action) {
  dialogPreviousFocus=document.activeElement;
  dialogAction=()=>{action();document.getElementById('page-content')?.focus({preventScroll:true});};
  app.insertAdjacentHTML('beforeend',`<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><h2 id="dialog-title">${e(title)}</h2><p>${e(text)}</p><div class="button-row"><button class="btn btn-light" data-action="dialog-cancel">Отмена</button><button class="btn btn-primary" data-action="dialog-confirm">${e(confirmLabel)}</button></div></section></div>`);
  app.querySelector('[data-action="dialog-cancel"]').focus();
}
function closeDialog(){app.querySelector('.dialog-backdrop')?.remove();dialogAction=null;if(dialogPreviousFocus?.isConnected)dialogPreviousFocus.focus();dialogPreviousFocus=null;}
document.addEventListener('keydown',event=>{
  const dialog=app.querySelector('.dialog');
  if(!dialog)return;
  if(event.key==='Escape'){closeDialog();return;}
  if(event.key==='Tab'){const buttons=[...dialog.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
app.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');if(!target)return;
  const {action,id,task}=target.dataset;
  if(action==='menu'){const open=document.getElementById('sidebar').classList.toggle('open');target.setAttribute('aria-expanded',String(open));return;}
  if(action==='save'){state=toggleSaved(state,id);persist();render();toast(state.saved.includes(id)?'Инициатива сохранена':'Инициатива убрана из сохранённого');}
  if(action==='join'){state=join(state,id);persist();render();toast('Добавлено в ваш локальный план');}
  if(action==='leave')showDialog('Убрать инициативу из плана?','Отметки выполненных задач этой инициативы будут удалены. Личная заметка сохранится.','Убрать из плана',()=>{state=leave(state,id);persist();render();toast('Инициатива убрана из плана');});
  if(action==='task'){state=toggleTask(state,id,task);persist();render();toast(state.completed.includes(task)?'Ещё один шаг выполнен':'Отметка задачи снята');}
  if(action==='filter-category'){state.filters.category=id;persist();render();}
  if(action==='clear-filters'){state.filters=freshState().filters;persist();render();}
  if(action==='participation-tab'){activeTab=id;render();}
  if(action==='map-category'){mapCategory=id;render();}
  if(action==='map-select'){selectedMap=id;render();}
  if(action==='calendar-prev'||action==='calendar-next'){const d=new Date(calendarYear,calendarMonth+(action==='calendar-next'?1:-1),1);if(d.getFullYear()<2020||d.getFullYear()>2100)return;calendarYear=d.getFullYear();calendarMonth=d.getMonth();calendarDay='';render();}
  if(action==='calendar-day'){calendarDay=calendarDay===id?'':id;render();}
  if(action==='calendar-clear'){calendarDay='';render();}
  if(action==='new-draft'){createdId='';formDraft={title:'',summary:'',category:'nature',district:state.profile.district,date:'2026-10-24',time:'10:00',duration:2};formErrors={};render();}
  if(action==='export'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='qamqor-city-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Резервная копия подготовлена');}
  if(action==='import')document.getElementById('import-file').click();
  if(action==='reset')showDialog('Начать с чистого листа?','Будут удалены ваши локальные инициативы, заметки, профиль и отметки. Это действие нельзя отменить без резервной копии.','Удалить локальные данные',()=>{state=freshState();createdId='';persist();render();toast('Пространство сброшено');});
  if(action==='dialog-cancel')closeDialog();
  if(action==='dialog-confirm'){const run=dialogAction;closeDialog();run?.();}
});
app.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target,values=Object.fromEntries(new FormData(form));
  if(form.id==='quick-search'){state.filters={query:values.q,category:'all',district:'all'};persist();location.hash='/initiatives';render();}
  if(form.id==='catalog-filters'){state.filters={...state.filters,query:values.query,district:values.district};persist();render();}
  if(form.id==='profile-form'){const name=values.name.trim();if(!name||!safeText(name,60)){toast('Укажите имя от 1 до 60 символов');return;}state.profile={name,district:values.district};persist();render();toast('Профиль сохранён на этом устройстве');}
  if(form.id==='create-form'){
    formDraft=values;formErrors=validateDraft(formDraft);
    if(Object.keys(formErrors).length){render();document.getElementById(Object.keys(formErrors)[0])?.focus();toast('Проверьте отмеченные поля');return;}
    try{const id=`local-${crypto.randomUUID()}`;state=createInitiative(state,formDraft,id);createdId=id;persist();render();window.scrollTo({top:0});toast('Ваша идея сохранена');}catch(error){toast(error.message);}
  }
});
app.addEventListener('input',event=>{
  if(event.target.closest('#create-form')){formDraft={...formDraft,[event.target.name]:event.target.value};document.getElementById('draft-preview').innerHTML=draftPreview();}
});
app.addEventListener('change',async event=>{
  if(event.target.dataset.note){state.notes[event.target.dataset.note]=event.target.value;persist();toast('Заметка сохранена');}
  if(event.target.id==='import-file'){
    const file=event.target.files[0];if(!file)return;
    if(file.size>500000){toast('Максимальный размер файла — 500 КБ');event.target.value='';return;}
    try{const next=importState(await file.text());showDialog('Восстановить пространство?','Текущие локальные данные будут заменены содержимым выбранного файла. При необходимости сначала сделайте экспорт.','Восстановить',()=>{state=next;createdId='';persist();render();toast('Данные успешно восстановлены');});}
    catch(error){toast(error.message||'Не удалось импортировать файл');}
    event.target.value='';
  }
});
window.addEventListener('hashchange',()=>{closeDialog();render();window.scrollTo({top:0});document.getElementById('page-content')?.focus({preventScroll:true});});
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();document.getElementById('page-content')?.focus();document.getElementById('page-content')?.scrollIntoView();});
render();

