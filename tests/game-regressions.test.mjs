import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../game/data/catalog.ts';
import { createBattle, createUnit, dispatch } from '../game/battle.ts';
import { Runtime } from '../game/runtime.ts';
import { playbackGroups } from '../components/battle/playback.ts';

const make = (extra = {}, data = catalog) => createBattle({ seed: 73, playerHp: 100, enemies: ['ruins-sentinel','ruins-sentinel'], skills: [{ id:'power-strike', level:1 }], equipment: [], ...extra }, data);
const card = (id, symbols = ['attack','attack','attack']) => ({ id, symbols, origin:'回歸測試' });
const act = (state, command, data = catalog) => {
  const result = dispatch(state, command, data);
  assert.equal(result.error, undefined);
  return result.state;
};
const finish = state => act(act(state, { type:'beginEnd' }), { type:'end', cardIds:[] });

test('visual snapshots preserve hit order and group only explicitly simultaneous effects', () => {
  const state = make();
  const runtime = new Runtime(state, catalog);
  const [player, enemy] = state.units;
  enemy.armor = 2;
  runtime.damage(player, enemy, 'extra', 3, 'hit one');
  const first = state.damage.at(-1);
  const firstHp = enemy.hp;
  enemy.armor = 4;
  runtime.damage(player, enemy, 'extra', 5, 'hit two');
  assert.deepEqual(first.scene.find(unit => unit.id === enemy.id), {id: enemy.id, hp: firstHp, armor: 0});
  assert.equal(playbackGroups(state.damage).length, 2);
  const curseId = Object.values(catalog.statuses).find(status => status.tags?.includes('curse')).id;
  for (const unit of [player, enemy]) unit.statuses.push({id:curseId, stacks:1, remaining:null, params:{}, order:1, source:player.id, origin:'system'});
  runtime.curse(player, 2);
  const curse = state.damage.filter(hit => hit.type === 'curse');
  assert.equal(curse.length, 2);
  assert.equal(curse[0].batchId, curse[1].batchId);
  assert.deepEqual(curse[0].scene, curse[1].scene);
  const groups = playbackGroups(state.damage);
  assert.equal(groups.length, 3);
  assert.equal(groups[2].length, 2);
});

test('whole battle multiplier includes crossbow armor bypass', () => {
  for (const equipment of [['crossbow','gamblers-left-hand'],['gamblers-left-hand','crossbow']]) {
    let state = make({ equipment });
    state.phase='cards'; state.hand=[card('a')]; state.units[1].armor=30;
    state=act(state,{ type:'play', cardIds:['a'] }); state=finish(state);
    const hit=state.damage.find(hit=>hit.source==='player'&&hit.type==='battle');
    assert.equal(hit.raw,27); assert.equal(hit.bypass,14); assert.equal(hit.hpDamage,14);
  }
});

test('reinforced hammer keeps per-card hits and per-hit flame sword triggers', () => {
  let state=make({ equipment:['reinforced-knight-hammer','flame-sword'] });
  state.phase='cards'; state.hand=[card('a'),card('b')];
  state=act(state,{type:'play',cardIds:['a','b']}); state=finish(state);
  assert.deepEqual(state.damage.filter(hit=>hit.source==='player'&&hit.type==='extra').map(hit=>hit.raw),[3,3]);
  assert.equal(state.logs.filter(entry=>entry.text.includes('獲得燃燒 1 層')).length,2);
});

test('blood leech requires an established battle hit, not a canceled attempt', () => {
  let state=make({ equipment:['reinforced-knight-hammer','blood-leech'] });
  state.units[0].hp=50; state.units[1].hp=1;
  state.phase='cards';state.hand=[card('a')];
  state=act(state,{type:'play',cardIds:['a']});state=finish(state);
  assert.equal(state.damage.some(hit=>hit.source==='player'&&hit.type==='battle'),false);
  assert.equal(state.logs.some(entry=>entry.text.includes('血蛭：')&&entry.text.includes('回復')),false);
  assert.equal(state.units[0].hp,40);
  const blocked=make({equipment:['blood-leech']});blocked.units[0].hp=50;blocked.units[1].armor=30;
  new Runtime(blocked,catalog).attack(blocked.units[0],blocked.units[1],10,'attack');
  assert.equal(blocked.units[0].hp,53);assert.equal(blocked.damage[0].hpDamage,0);
});

test('independent per-card hammer hits retarget after death without moving the locked battle hit', () => {
  let state=make({ equipment:['reinforced-knight-hammer'] });
  state.units[1].hp=1;
  state.phase='cards';state.hand=[card('a'),card('b')];
  state=act(state,{type:'play',cardIds:['a','b']});state=finish(state);
  assert.deepEqual(state.damage.filter(hit=>hit.type==='extra').map(hit=>[hit.target,hit.raw,hit.overkill]),[['enemy-0',3,2],['enemy-1',3,0]]);
  assert.equal(state.damage.some(hit=>hit.type==='battle'&&hit.source==='player'),false);
});

test('iron eating uses half-up rounding and remains deferred until next round', () => {
  const state=make({enemies:['iron-beast']});state.units[0].armor=9;
  const runtime=new Runtime(state,catalog);
  runtime.emit('roundEnd',state.units[1],{target:state.units[0]});
  assert.equal(state.units[1].baseAttack,6);
  assert.equal(state.units[1].pendingAttack,2);assert.equal(state.units[1].pendingDefense,2);
});

test('death explosions run before final outcome, including nested unit deaths', () => {
  const data=structuredClone(catalog);
  data.equipment.lastBurst={id:'lastBurst',name:'Death burst',description:'',hooks:[{event:'death',effects:[{op:'damage',damageType:'extra',target:'enemies',amount:100}]}]};
  const state=make({equipment:['lastBurst']},data);
  new Runtime(state,data).damage(state.units[1],state.units[0],'extra',100,'fatal');
  assert.deepEqual(state.units.map(unit=>unit.hp),[0,0,0]);assert.equal(state.outcome,'draw');
  assert.equal(state.damage.filter(hit=>hit.source==='player').length,2);
});

test('data-defined once-per-battle revive works and does not repeat', () => {
  const data=structuredClone(catalog);
  data.equipment.revive={id:'revive',name:'Revive',description:'',hooks:[{event:'death',oncePerBattle:true,effects:[{op:'revive',amount:5,target:'self'}]}]};
  const state=make({equipment:['revive']},data);const runtime=new Runtime(state,data);
  runtime.damage(state.units[1],state.units[0],'extra',100,'fatal');
  assert.equal(state.units[0].hp,5);assert.equal(state.outcome,null);
  runtime.damage(state.units[1],state.units[0],'extra',100,'fatal');
  assert.equal(state.units[0].hp,0);assert.equal(state.outcome,'defeat');
});

test('enemy multi-target effects resolve right to left; player effects left to right', () => {
  const state=make();state.units.splice(1,0,createUnit('right-ally','player','Ally',100));
  const runtime=new Runtime(state,catalog);
  runtime.effects([{op:'damage',damageType:'extra',target:'enemies',amount:1}],runtime.context(state.units[2]));
  assert.deepEqual(state.damage.map(hit=>hit.target),['right-ally','player']);
  state.damage=[];
  runtime.effects([{op:'damage',damageType:'extra',target:'enemies',amount:1}],runtime.context(state.units[0]));
  assert.deepEqual(state.damage.map(hit=>hit.target),['enemy-0','enemy-1']);
});

test('reflection-specific mitigation precedes armor and ignores general mitigation', () => {
  const data=structuredClone(catalog);
  data.equipment.mitigation={id:'mitigation',name:'Mitigation',description:'',modifiers:[
    {kind:'damageReduction',damageType:'reflection',stage:'percent',value:.5},
    {kind:'damageReduction',stage:'fixed',value:100},
  ]};
  const state=make({equipment:['mitigation']},data);state.units[0].armor=8;
  new Runtime(state,data).damage(state.units[1],state.units[0],'reflection',10,'reflect');
  assert.equal(state.units[0].hp,100);assert.equal(state.units[0].armor,3);
  assert.deepEqual(state.damage[0].steps.map(step=>step.stage),['percent','fixed','special','armor']);
});

test('authored battle damage cannot bypass the pool or lock an early target', () => {
  const data=structuredClone(catalog);
  data.skills.newSkill={id:'newSkill',name:'New',description:'',levels:[{condition:'Σ✨>=1',description:'',effects:[{op:'damage',damageType:'battle',target:'target',amount:12}]}]};
  let state=make({skills:[{id:'newSkill',level:1}]},data);state.phase='cards';state.hand=[card('a',['star'])];
  state=act(state,{type:'skill',skillId:'newSkill',cardIds:['a']},data);
  assert.equal(state.units[0].pool,12);assert.equal(state.units[1].hp,50);assert.equal(state.damage.length,0);
  const runtime=new Runtime(state,data);runtime.damage(state.units[0],state.units[1],'extra',50,'remove old target');
  state=act(act(state,{type:'beginEnd'},data),{type:'end',cardIds:[]},data);
  const hit=state.damage.find(hit=>hit.source==='player'&&hit.type==='battle');
  assert.equal(hit.raw,12);assert.equal(hit.target,'enemy-1');
});

test('immune extra damage never activates scales or flame sword', () => {
  const data=structuredClone(catalog);
  data.statuses.immune={id:'immune',name:'Immune',description:'',stacking:'refresh',modifiers:[{kind:'damageImmunity',damageType:'extra'}]};
  const state=make({equipment:['flame-sword'],enemies:['rockscale-lizard']},data);const runtime=new Runtime(state,data);
  runtime.addStatus(state.units[1],'immune',runtime.context(state.units[1]));
  const armor=state.units[1].armor;
  runtime.damage(state.units[0],state.units[1],'extra',3,'test');
  assert.equal(state.damage.length,0);assert.equal(state.units[1].armor,armor);
  assert.equal(state.units[1].statuses.some(status=>status.id==='burning'),false);
});

test('skull guarantee completes before final-board equipment predicates', () => {
  for(const equipment of [['black-cat-tail','rams skull'],['rams skull','black-cat-tail']]) {
    const state=make({seed:1,equipment});
    assert.equal(state.board.includes('skull'),true);assert.equal(state.units[0].maxHp,102);
  }
});

test('card history exposes only processed cards, independent of UI batching', () => {
  const data=structuredClone(catalog);
  data.equipment.history={id:'history',name:'History',description:'',hooks:[{event:'cardPlayed',effects:[{op:'damage',damageType:'extra',target:'target',amount:{countCards:{use:'play'}}}]}]};
  let batch=make({equipment:['history']},data);batch.phase='cards';batch.hand=[card('a',['star']),card('b',['star'])];
  let split=structuredClone(batch);
  batch=act(batch,{type:'play',cardIds:['a','b']},data);
  split=act(act(split,{type:'play',cardIds:['a']},data),{type:'play',cardIds:['b']},data);
  assert.deepEqual(batch.damage.map(hit=>hit.raw),[1,2]);assert.deepEqual(batch.damage,split.damage);
});
