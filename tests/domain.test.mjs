import test from 'node:test';
import assert from 'node:assert/strict';
import { initiatives, guides } from '../dist/data.js';
import { freshState, allInitiatives, join, leave, toggleSaved, toggleTask, metrics,
  filterInitiatives, validateDraft, validDate, createInitiative, importState, escapeHtml } from '../dist/domain.js';

const draft = () => ({title:'Библиотека нашего двора',summary:'Создать небольшую полку для обмена книгами и подготовить понятные карточки с правилами.',category:'education',district:'Алмалы',date:'2026-10-24',time:'10:30',duration:2});
const backup = state => JSON.stringify(state);

test('joining is idempotent, immutable and rejects unknown IDs', () => {
  const initial=freshState();
  const next=join(join(initial,'green-weekend'),'green-weekend');
  assert.deepEqual(initial.joined,[]);
  assert.deepEqual(next.joined,['green-weekend']);
  assert.equal(metrics(next).joined,1);
  assert.throws(()=>join(initial,'missing'),/не найдена/);
});

test('tasks require joined initiative and cannot be borrowed from another plan', () => {
  const initial=freshState();
  assert.throws(()=>toggleTask(initial,'green-weekend','green-weekend-1'));
  const joined=join(initial,'green-weekend');
  assert.throws(()=>toggleTask(joined,'green-weekend','digital-neighbor-1'));
  const done=toggleTask(joined,'green-weekend','green-weekend-1');
  assert.equal(metrics(done).done,1);
  assert.equal(metrics(done).percent,25);
  assert.equal(metrics(toggleTask(done,'green-weekend','green-weekend-1')).done,0);
});

test('completion and removal update derived totals without affecting another initiative', () => {
  let state=join(join(freshState(),'green-weekend'),'digital-neighbor');
  for(const task of initiatives[0].tasks)state=toggleTask(state,'green-weekend',task.id);
  state=toggleTask(state,'digital-neighbor','digital-neighbor-1');
  state.notes['green-weekend']='Keep this reflection';
  assert.equal(metrics(state).finished,1);
  assert.equal(metrics(state).done,5);
  assert.equal(metrics(state).plannedHours,5);
  const next=leave(state,'green-weekend');
  assert.equal(metrics(next).finished,0);
  assert.deepEqual(next.completed,['digital-neighbor-1']);
  assert.equal(next.notes['green-weekend'],'Keep this reflection');
});

test('save toggles independently of joining and search combines filters', () => {
  const saved=toggleSaved(freshState(),'green-weekend');
  assert.equal(saved.joined.length,0);
  assert.equal(toggleSaved(saved,'green-weekend').saved.length,0);
  assert.equal(filterInitiatives(initiatives,{query:'ЦИФРОВОЙ',category:'education',district:'Алмалы'}).length,1);
  assert.equal(filterInitiatives(initiatives,{query:'ЦИФРОВОЙ',category:'nature'}).length,0);
});

test('draft validates calendar dates, time, categories, text and duration bounds', () => {
  assert.deepEqual(validateDraft(draft()),{});
  assert.equal(validDate('2028-02-29'),true);
  assert.equal(validDate('2026-02-29'),false);
  assert.equal(validDate('2026-04-31'),false);
  assert.equal(validDate('2200-01-01'),false);
  const invalid={...draft(),title:'Hi',summary:'Short',date:'2026-02-30',time:'25:60',duration:Infinity,category:'<script>',district:'Unknown'};
  assert.equal(Object.keys(validateDraft(invalid)).length,7);
  assert.ok(validateDraft({...draft(),duration:true}).duration);
  assert.ok(validateDraft(null).title);
});

test('local initiative is constructed from known fields, not imported task definitions', () => {
  const state=createInitiative(freshState(),{...draft(),tasks:[{id:'hacked',title:'Injected'}],x:999,sample:true},'local-example');
  assert.equal(state.created[0].sample,false);
  assert.equal(state.created[0].tasks.length,3);
  assert.equal(state.created[0].tasks[0].id,'local-example-1');
  assert.equal(allInitiatives(state).length,13);
  assert.throws(()=>createInitiative(state,draft(),'local-example'));
  assert.throws(()=>createInitiative(state,draft(),'javascript:alert(1)'));
});

test('backup round-trip preserves valid progress and notes; duplicate references normalize', () => {
  let state=createInitiative(freshState(),draft(),'local-example');
  state=join(state,'local-example');
  state=toggleTask(state,'local-example','local-example-1');
  state=toggleSaved(state,'green-weekend');
  state.notes['local-example']='Personal reflection';
  state.joined.push('local-example');
  state.completed.push('local-example-1');
  const restored=importState(backup(state));
  assert.equal(restored.joined.length,1);
  assert.equal(restored.completed.length,1);
  assert.equal(restored.notes['local-example'],'Personal reflection');
  assert.equal(metrics(restored).done,1);
});

test('unsafe backups reject malformed JSON, wrong app, missing objects and unknown references', () => {
  assert.throws(()=>importState('{'),/JSON/);
  assert.throws(()=>importState(backup({...freshState(),app:'other'})),/формат/);
  assert.throws(()=>importState(backup({...freshState(),created:[null]})),/инициатива/);
  assert.throws(()=>importState(backup({...freshState(),joined:['unknown']})),/неизвестные/);
  assert.throws(()=>importState(backup({...freshState(),completed:['green-weekend-1']})),/задачи/);
  assert.throws(()=>importState(backup({...freshState(),notes:{unknown:'x'}})),/заметки/);
  assert.throws(()=>importState(' '.repeat(500001)),/большой/);
});

test('prototype keys cannot enter state, text markup is escaped at presentation boundary', () => {
  const raw=backup(freshState()).replace('"notes":{}','"notes":{"__proto__":{"polluted":true}}');
  assert.throws(()=>importState(raw),/заметки/);
  assert.equal({}.polluted,undefined);
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  const state={...freshState(),profile:{name:'<script>alert(1)</script>',district:'Алмалы'}};
  assert.equal(importState(backup(state)).profile.name,state.profile.name);
});

test('catalog seeds are coherent and every guide has structured content', () => {
  assert.equal(initiatives.length,12);
  assert.equal(new Set(initiatives.map(item=>item.id)).size,12);
  assert.equal(new Set(initiatives.flatMap(item=>item.tasks.map(task=>task.id))).size,48);
  for(const item of initiatives){assert.deepEqual(validateDraft(item),{});assert.equal(item.sample,true);}
  assert.equal(guides.length,6);
  for(const guide of guides)assert.equal(guide.sections.length,3);
});

test('the creation limit guarantees UI-created state remains importable', () => {
  let state=freshState();
  for(let index=0;index<100;index++)state=createInitiative(state,draft(),`local-${index}`);
  assert.equal(importState(backup(state)).created.length,100);
  assert.throws(()=>createInitiative(state,draft(),'local-overflow'),/100/);
  assert.equal(state.created.length,100);
});
