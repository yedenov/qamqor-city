import { initiatives, categories, districts } from './data.js';

export const STORE_KEY = 'qamqor-city-v1';
export const freshState = () => ({
  app: 'qamqor-city', version: 1,
  profile: { name: 'Друг города', district: 'Бостандык' },
  saved: [], joined: [], completed: [], created: [],
  filters: { query: '', category: 'all', district: 'all' }, notes: {},
});

export const allInitiatives = state => [...state.created, ...initiatives];
export function getInitiative(state, id) {
  return allInitiatives(state).find(item => item.id === id);
}

export function join(state, id) {
  if (!getInitiative(state, id)) throw new Error('Инициатива не найдена');
  return { ...state, joined: [...new Set([...state.joined, id])] };
}

export function leave(state, id) {
  const taskIds = getInitiative(state, id)?.tasks.map(task => task.id) || [];
  return {
    ...state,
    joined: state.joined.filter(value => value !== id),
    completed: state.completed.filter(value => !taskIds.includes(value)),
  };
}

export function toggleSaved(state, id) {
  if (!getInitiative(state, id)) throw new Error('Инициатива не найдена');
  return {
    ...state,
    saved: state.saved.includes(id)
      ? state.saved.filter(value => value !== id)
      : [...state.saved, id],
  };
}

export function toggleTask(state, id, taskId) {
  const item = getInitiative(state, id);
  if (!item || !state.joined.includes(id) || !item.tasks.some(task => task.id === taskId)) {
    throw new Error('Сначала добавьте инициативу в свой план');
  }
  return {
    ...state,
    completed: state.completed.includes(taskId)
      ? state.completed.filter(value => value !== taskId)
      : [...state.completed, taskId],
  };
}

export function metrics(state) {
  const selected = allInitiatives(state).filter(item => state.joined.includes(item.id));
  const countDone = item => item.tasks.filter(task => state.completed.includes(task.id)).length;
  const done = selected.reduce((sum, item) => sum + countDone(item), 0);
  const total = selected.reduce((sum, item) => sum + item.tasks.length, 0);
  const finished = selected.filter(item => item.tasks.length && countDone(item) === item.tasks.length).length;
  return {
    joined: selected.length, saved: state.saved.length, done, total, finished,
    plannedHours: selected.reduce((sum, item) => sum + item.duration, 0),
    percent: total ? Math.round(done / total * 100) : 0,
    byCategory: categories.filter(category => category.id !== 'all').map(category => ({
      ...category,
      count: selected.filter(item => item.category === category.id).length,
      done: selected.filter(item => item.category === category.id)
        .reduce((sum, item) => sum + countDone(item), 0),
    })),
  };
}

export function filterInitiatives(items, { query = '', category = 'all', district = 'all' } = {}) {
  const normalized = query.trim().toLocaleLowerCase('ru');
  return items.filter(item =>
    (category === 'all' || item.category === category) &&
    (district === 'all' || item.district === district) &&
    (!normalized || `${item.title} ${item.summary} ${item.district}`.toLocaleLowerCase('ru').includes(normalized)),
  );
}

export const safeText = (value, max) => typeof value === 'string' && value.length <= max &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);

export function validateDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return { title: 'Некорректные данные инициативы.' };
  }
  const errors = {};
  if (!safeText(draft.title, 80) || draft.title.trim().length < 6) errors.title = 'Название: от 6 до 80 символов.';
  if (!safeText(draft.summary, 1500) || draft.summary.trim().length < 40) errors.summary = 'Описание: от 40 до 1500 символов.';
  if (!categories.some(category => category.id === draft.category && category.id !== 'all')) errors.category = 'Выберите направление.';
  if (!districts.includes(draft.district)) errors.district = 'Выберите район.';
  if (!validDate(draft.date)) errors.date = 'Укажите корректную дату.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time || '')) errors.time = 'Укажите время.';
  if (!['string', 'number'].includes(typeof draft.duration) || !Number.isFinite(Number(draft.duration)) || Number(draft.duration) < 0.5 || Number(draft.duration) > 12) {
    errors.duration = 'Длительность: от 0,5 до 12 часов.';
  }
  return errors;
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !isNaN(date) && date.toISOString().slice(0, 10) === value && value >= '2020-01-01' && value <= '2100-12-31';
}

export function createInitiative(state, draft, id = `local-${globalThis.crypto.randomUUID()}`) {
  const errors = validateDraft(draft);
  if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '));
  if (state.created.length >= 100) throw new Error('В пространстве может быть до 100 собственных инициатив.');
  if (!/^local-[a-zA-Z0-9-]{1,50}$/.test(id) || getInitiative(state, id)) throw new Error('Некорректный идентификатор');
  const item = {
    id, title: draft.title.trim(), summary: draft.summary.trim(),
    category: draft.category, district: draft.district, date: draft.date,
    time: draft.time, duration: Number(draft.duration), sample: false,
    art: 'city', x: 50, y: 50,
    tasks: [
      { id: `${id}-1`, title: 'Уточнить цель и подготовить план' },
      { id: `${id}-2`, title: 'Выполнить запланированное действие' },
      { id: `${id}-3`, title: 'Записать результаты и следующий шаг' },
    ],
  };
  return { ...state, created: [item, ...state.created] };
}

/** Reconstruct allowlisted state; never merge untrusted objects into application state. */
export function importState(raw) {
  if (typeof raw !== 'string' || raw.length > 500000) throw new Error('Файл слишком большой (максимум 500 КБ).');
  let input;
  try { input = JSON.parse(raw); }
  catch { throw new Error('Не удалось прочитать JSON-файл.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1 || input.app !== 'qamqor-city') throw new Error('Неподдерживаемый формат данных.');
  const result = freshState();
  if (!input.profile || !safeText(input.profile.name, 60) || !input.profile.name.trim() || !districts.includes(input.profile.district)) throw new Error('Некорректный профиль.');
  result.profile = { name: input.profile.name.trim(), district: input.profile.district };
  if (!Array.isArray(input.created) || input.created.length > 100) throw new Error('Некорректный список инициатив.');
  for (const draft of [...input.created].reverse()) {
    if (Object.keys(validateDraft(draft)).length) throw new Error('В файле есть некорректная инициатива.');
    result.created = createInitiative(result, draft, draft.id).created;
  }
  const ids = new Set(allInitiatives(result).map(item => item.id));
  for (const key of ['saved', 'joined']) {
    if (!Array.isArray(input[key]) || input[key].length > 112 || input[key].some(id => typeof id !== 'string' || !ids.has(id))) throw new Error('В файле есть неизвестные инициативы.');
    result[key] = [...new Set(input[key])];
  }
  const taskIds = new Set(allInitiatives(result).filter(item => result.joined.includes(item.id)).flatMap(item => item.tasks.map(task => task.id)));
  if (!Array.isArray(input.completed) || input.completed.length > 400 || input.completed.some(id => !taskIds.has(id))) throw new Error('В файле есть некорректные задачи.');
  result.completed = [...new Set(input.completed)];
  if (input.filters && safeText(input.filters.query, 100) && categories.some(category => category.id === input.filters.category) && (input.filters.district === 'all' || districts.includes(input.filters.district))) {
    result.filters = { query: input.filters.query, category: input.filters.category, district: input.filters.district };
  }
  if (input.notes && typeof input.notes === 'object' && !Array.isArray(input.notes)) {
    for (const [id, note] of Object.entries(input.notes)) {
      if (!ids.has(id) || !safeText(note, 2000)) throw new Error('Некорректные личные заметки.');
      result.notes[id] = note;
    }
  }
  return result;
}

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
