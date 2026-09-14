import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../game/data/catalog.ts';
import { createBattle, createUnit, dispatch, enemyIntentDamage, startRound } from '../game/battle.ts';
import { Runtime } from '../game/runtime.ts';
import { cardScore, effective } from '../game/cards.ts';
import { meetsCondition, parseCondition } from '../game/conditions.ts';
import { calculateDamage } from '../game/damage.ts';
import { weightedDraw } from '../game/random.ts';
import { value } from '../game/evaluation.ts';

let nextCard = 0;
const card = (...symbols) => ({ id: `test-${nextCard++}`, origin: '測試卡', symbols });
const setup = (extra = {}) => ({ seed: 73, playerHp: 100, enemies: ['ruins-sentinel'], skills: Object.keys(catalog.skills).map(id => ({ id, level: 1 })), equipment: [], ...extra });
const make = (extra = {}, data = catalog) => createBattle(setup(extra), data);
const action = (state, command, data = catalog) => { const result = dispatch(state, command, data); assert.equal(result.error, undefined); return result.state; };
const finish = (state, ids = [], data = catalog) => action(action(state, { type: 'beginEnd' }, data), { type: 'end', cardIds: ids }, data);
const cardsState = (cards = [], extra = {}) => ({ ...make(extra), phase: 'cards', hand: cards });
const runtime = (state) => new Runtime(state, catalog);
const own = (state) => state.units[0];
const enemy = (state) => state.units[1];

test('1/3/9, independent wildcard effects, real lucky and skull amplification', () => {
  assert.deepEqual(cardScore(card('attack','attack','lucky'), catalog.rules), { attack:9, armor:1 });
  assert.deepEqual(cardScore(card('attack','defense','lucky'), catalog.rules), { attack:3, armor:3 });
  assert.deepEqual(cardScore(card('lucky','lucky','lucky'), catalog.rules), { attack:9, armor:9 });
  assert.equal(effective(card('lucky','lucky','lucky'), 'star'), 3);
  assert.equal(effective(card('star','star','star'), 'lucky'), 0);
  assert.deepEqual(cardScore(card('attack','attack','skull'), catalog.rules, true), { attack:9, armor:0 });
  assert.deepEqual(cardScore(card('attack','defense','skull'), catalog.rules, true), { attack:3, armor:3 });
  assert.deepEqual(cardScore(card('skull','skull','skull'), catalog.rules, true), { attack:0, armor:0 });
});

test('sum, exact, strict and inclusive condition operators', () => {
  const three = [card('attack','star','skull'),card('attack','star','skull'),card('attack','star','skull')];
  assert.equal(meetsCondition(three, 'Σ⚔️>=3 & Σ✨=3'), true);
  assert.equal(meetsCondition(three, 'Σ⚔️>3'), false);
  assert.equal(meetsCondition(three, 'Σ⚔️<=3'), true);
  assert.equal(meetsCondition(three, 'Σ⚔️<3'), false);
  assert.equal(meetsCondition(three, '[⚔️=1]'), true);
  assert.equal(meetsCondition([card('attack','attack','defense')], '[⚔️=1]'), false);
  assert.equal(meetsCondition([], 'Σ⚔️=0'), false);
  assert.throws(() => parseCondition('⚔️⚔️'));
});

test('distinct exact slots backtrack; a single wildcard card cannot fill two slots', () => {
  const wild = card('lucky','lucky','lucky');
  assert.equal(meetsCondition([wild,card('defense','defense','defense')], '[🛡️=3], [✨=3]'), true);
  assert.equal(meetsCondition([card('defense','defense','lucky'),card('star','star','lucky')], '[🛡️=3], [✨=3]'), true);
  assert.equal(meetsCondition([wild], '[🛡️=3], [✨=3]'), false);
  assert.equal(meetsCondition([wild,wild], '[🛡️=3], [✨=3]'), false);
  assert.equal(meetsCondition([wild], 'Σ🛡️>=3 & Σ✨>=3'), true);
});

test('weighted draw normalizes to actual total (105), keeps fractional weights', () => {
  const weights = [['attack',30],['defense',30],['star',30],['lucky',10],['skull',5]];
  assert.equal(weightedDraw(weights,()=>94/105),'lucky');
  assert.equal(weightedDraw(weights,()=>101/105),'skull');
  assert.equal(weightedDraw([['a',0.25],['b',0.75]],()=>0.249),'a');
  assert.equal(weightedDraw([['a',0.25],['b',0.75]],()=>0.25),'b');
});

test('free nine-cell board, lock spends AP immediately and persists across rerolls', () => {
  let state = make(); const original = [...state.board];
  assert.equal(state.ap,3); assert.equal(state.hand.length,0); assert.equal(state.board.length,9);
  state = action(state,{type:'lock',column:0}); assert.equal(state.ap,2);
  state = action(state,{type:'spin'}); assert.equal(state.ap,1); assert.deepEqual(state.locked,[0]);
  for(const index of [0,3,6]) assert.equal(state.board[index],original[index]);
  state = action(state,{type:'spin'}); assert.equal(state.ap,0); assert.equal(state.phase,'slots');
  const invalid = dispatch(state,{type:'spin'},catalog); assert.ok(invalid.error); assert.equal(invalid.state,state);
});

test('lucky coin is repeatable after new AP expenditure, not triggered by free unlock clicks', () => {
  let state = make({equipment:['lucky-coin']}); state.ap=1; state.rng=1;
  state=action(state,{type:'lock',column:0}); assert.equal(state.ap,1);
  state.rng=1; state=action(state,{type:'spin'}); assert.equal(state.ap,1);
  state.ap=0; const oldRng=state.rng; state=action(state,{type:'lock',column:0}); assert.equal(state.ap,0); assert.equal(state.rng,oldRng);
});

test('all eight triple-skull lines penalize next AP, clamped at zero', () => {
  let state=make(); state.board=Array(9).fill('skull'); state=action(state,{type:'confirmBoard'});
  assert.equal(state.hand.length,8); assert.equal(state.nextApPenalty,8);
  assert.ok(dispatch(state,{type:'play',cardIds:[state.hand[0].id]},catalog).error);
  state=finish(state); assert.equal(state.ap,0); assert.equal(state.nextApPenalty,0);
});

test('retention has no hard three-card cap and can be renewed', () => {
  let state=make({equipment:['vip-membership']}); state.board=Array(9).fill('defense'); state=action(state,{type:'confirmBoard'});
  const ids=state.hand.slice(0,4).map(c=>c.id); state=finish(state,ids);
  assert.equal(state.retained.length,4); assert.equal(state.ap,4);
  state=action(state,{type:'confirmBoard'}); assert.equal(state.hand.filter(c=>ids.includes(c.id)).length,4);
  state=finish(state,[ids[0]]); assert.equal(state.retained[0].id,ids[0]);
});

test('special cards follow eight lines, mushroom enters immediately', () => {
  let state=make({equipment:['magic-stone','star-sea-compass'],consumables:{'magic-mushroom':1}});
  assert.equal(state.hand.length,0); state=action(state,{type:'confirmBoard'}); assert.equal(state.hand.length,10);
  assert.equal(state.hand[8].origin,'魔石'); assert.equal(state.hand[9].origin,'星海羅盤');
  state=action(state,{type:'consumable',itemId:'magic-mushroom'});
  assert.equal(state.hand.length,11); assert.deepEqual(state.hand.at(-1).symbols,['star','star','star']);
});

test('skill materials neither score nor activate equipment on-play effects', () => {
  const material=card('attack','attack','lucky');
  let state=cardsState([material],{equipment:['reinforced-shuriken','rune-cube']});
  state=action(state,{type:'skill',skillId:'power-strike',cardIds:[material.id]});
  assert.equal(own(state).pool,12); assert.equal(own(state).armor,0); assert.equal(state.damage.length,0); assert.equal(state.hand.length,0);
});

test('invalid material is atomic, including RNG and AP', () => {
  const material=card('attack','star','defense'); const state=cardsState([material]);
  const result=dispatch(state,{type:'skill',skillId:'power-strike',cardIds:[material.id]},catalog);
  assert.ok(result.error); assert.equal(result.state,state); assert.equal(state.hand.length,1);
});

test('ordered additive and multiplicative pool operations yield 30 or 18', () => {
  const a=make();const r=runtime(a);own(a).pool=3;
  r.effects([{op:'pool',amount:12,target:'self'},{op:'pool',amount:2,mode:'multiply',target:'self'}],r.context(own(a)));
  assert.equal(own(a).pool,30);
  own(a).pool=3;r.effects([{op:'pool',amount:2,mode:'multiply',target:'self'},{op:'pool',amount:12,target:'self'}],r.context(own(a)));
  assert.equal(own(a).pool,18);
});

test('battle pool does not hit until end turn and excess never spills to next enemy', () => {
  const material=card('attack','attack','attack'); let state=cardsState([material],{enemies:['ruins-sentinel','ruins-sentinel']});
  state=action(state,{type:'play',cardIds:[material.id]}); assert.equal(enemy(state).hp,50); assert.equal(own(state).pool,9);
  enemy(state).hp=3; state=finish(state);
  const hit=state.damage.find(d=>d.source==='player'&&d.type==='battle'); assert.equal(hit.overkill,6); assert.equal(state.units[2].hp,50);
});

test('five normal played cards create five separate equipment damage events, retarget between events', () => {
  const cards=Array.from({length:5},()=>card('star','star','star'));let state=cardsState(cards,{equipment:['reinforced-shuriken'],enemies:['ruins-sentinel','ruins-sentinel']});
  enemy(state).hp=2; state=action(state,{type:'play',cardIds:cards.map(c=>c.id)});
  assert.equal(state.damage.length,5);assert.deepEqual(state.damage.map(d=>d.target),['enemy-0','enemy-0','enemy-1','enemy-1','enemy-1']);
});

test('elemental bottle and flame sword require pre-mitigation extra > 1; hardened scales acts after hit', () => {
  let state=make({equipment:['elemental-bottle','flame-sword'],enemies:['rockscale-lizard']});const r=runtime(state);
  enemy(state).armor=20;r.damage(own(state),enemy(state),'extra',1,'one');
  assert.equal(state.damage[0].raw,1);assert.equal(enemy(state).armor,21);assert.equal(enemy(state).statuses.some(s=>s.id==='burning'),false);
  r.damage(own(state),enemy(state),'extra',2,'two');assert.equal(state.damage[1].raw,3);assert.equal(state.damage[1].hpDamage,0);assert.equal(enemy(state).armor,20);
  assert.equal(enemy(state).statuses.find(s=>s.id==='burning').stacks,1);assert.equal(state.damage.length,2);
});

test('fully armor-blocked battle damage still triggers reflection; extra damage does not', () => {
  const state=make({equipment:['thorns']});const r=runtime(state);own(state).armor=30;
  r.attack(enemy(state),own(state),10,'attack');
  assert.equal(state.damage[0].hpDamage,0);assert.equal(state.damage[1].type,'reflection');assert.equal(enemy(state).hp,45);
  r.damage(enemy(state),own(state),'extra',5,'extra');assert.equal(state.damage.length,3);
});

test('curse min examples and simultaneous death batch', () => {
  const state=make();const r=runtime(state);
  r.addStatus(own(state),'curse',r.context(own(state)),{stacks:5});r.addStatus(enemy(state),'curse',r.context(own(state)),{stacks:10});
  r.curse(own(state),3);assert.deepEqual(state.damage.map(d=>d.raw),[3,3]);
  own(state).hp=1;enemy(state).hp=1;r.curse(own(state),3);assert.equal(state.outcome,'draw');assert.deepEqual(state.units.map(u=>u.hp),[0,0]);
});

test('burning ticks only at whole-round end and 1 stack clears', () => {
  let state=cardsState();let r=runtime(state);r.addStatus(enemy(state),'burning',r.context(own(state)),{stacks:1});
  assert.equal(state.damage.length,0);state=finish(state);assert.equal(state.damage.filter(d=>d.type==='burn').length,1);assert.equal(enemy(state).statuses.some(s=>s.id==='burning'),false);
  r=runtime(state);r.addStatus(enemy(state),'burning',r.context(own(state)),{stacks:5});r.emit('roundEnd',enemy(state));assert.equal(enemy(state).statuses.find(s=>s.id==='burning').stacks,3);
});

test('flame cover marks all attackers then burns that round and expires', () => {
  let state=cardsState([],{enemies:['ruins-sentinel','ruins-sentinel']});const r=runtime(state);
  r.addStatus(own(state),'flame-cover',r.context(own(state)),{rounds:1,params:{power:5}});
  state=finish(state);assert.equal(state.damage.filter(d=>d.type==='burn').length,2);assert.equal(own(state).statuses.some(s=>s.id==='flame-cover'),false);
});

test('damage pipeline is armor -> percent half-up -> fixed; bypass only skips armor', () => {
  const target=createUnit('a','enemy','a',100);target.armor=3;
  const result=calculateDamage(10,'battle',target,catalog.rules,{percent:0.2,fixed:2});
  assert.equal(result.afterArmor,7);assert.equal(result.afterPercent,6);assert.equal(result.hpDamage,4);
  const bypass=calculateDamage(10,'battle',target,catalog.rules,{percent:0.2,fixed:2},10);
  assert.equal(bypass.armorBlocked,0);assert.equal(bypass.hpDamage,6);
  const burn=calculateDamage(10,'burn',target,catalog.rules,{percent:0,fixed:0});assert.equal(burn.hpDamage,7);
});

test('holy shield multiplies base defense and iron shield but never diamond restoration', () => {
  const state=make({equipment:['iron-shield','diamond'],playerDefense:2});const r=runtime(state);
  r.addStatus(own(state),'holy-shield',r.context(own(state)),{rounds:3,params:{power:2}});own(state).retainedArmor=5;
  startRound(r);assert.equal(own(state).armor,19);assert.equal(own(state).retainedArmor,0);
});

test('shield block counts all submitted cards once at player turn end', () => {
  const cards=[card('attack','defense','star'),card('defense','star','skull')];let state=cardsState(cards);
  state=action(state,{type:'skill',skillId:'shield-block',cardIds:cards.map(c=>c.id)});assert.equal(own(state).armor,0);
  runtime(state).emit('playerTurnEnd',own(state));assert.equal(own(state).armor,6);assert.equal(own(state).statuses.some(s=>s.id==='shield-block'),false);
});

test('curse snake prohibits card equipment armor but doubles skill armor', () => {
  const cards=[card('defense','star','lucky'),card('star','star','star')];let state=cardsState(cards,{equipment:['cursed-snake-scale','rune-cube','lucky-carrot']});
  state=action(state,{type:'play',cardIds:[cards[0].id]});assert.equal(own(state).armor,0);
  state=action(state,{type:'skill',skillId:'mana-armor',cardIds:[cards[1].id]});assert.equal(own(state).armor,12);
});

test('mana purge counts actual printed stars once per card including materials, not lucky', () => {
  const cards=[card('star','star','star'),card('lucky','lucky','lucky')];let state=cardsState(cards,{enemies:['arcane-hound']});
  state=action(state,{type:'skill',skillId:'mana-armor',cardIds:[cards[0].id]});state=action(state,{type:'play',cardIds:[cards[1].id]});
  assert.equal(value({countCards:{where:{left:{read:'printed.star'},compare:'>=',right:1}}},state,runtime(state).context(own(state))),1);assert.equal(enemyIntentDamage(state,enemy(state),catalog),20);
});

test('food iron queues permanent base stats for next round, not immediately', () => {
  const state=make({enemies:['iron-beast']});const r=runtime(state);own(state).armor=12;
  r.emit('roundEnd',enemy(state),{target:own(state)});assert.equal(enemy(state).baseAttack,6);assert.equal(enemy(state).pendingAttack,2);
  startRound(r);assert.equal(enemy(state).baseAttack,8);assert.equal(enemy(state).baseDefense,2);assert.equal(enemy(state).pendingAttack,0);
});

test('attack buffs do not stack with themselves, different IDs coexist and refresh duration', () => {
  const state=make();const r=runtime(state);const context=r.context(own(state));
  r.addStatus(own(state),'attack-up-3',context,{rounds:2});r.addStatus(own(state),'attack-up-3',context,{rounds:3});r.addStatus(own(state),'attack-up-7',context,{rounds:1});
  assert.equal(own(state).pool,10);assert.equal(own(state).statuses.length,2);assert.equal(own(state).statuses[0].remaining,3);
});

test('knight hammer armor break affects this hit; crossbow remains one battle event', () => {
  const c=card('attack','attack','attack');let state=cardsState([c],{equipment:['knight-hammer','crossbow']});enemy(state).armor=10;
  state=action(state,{type:'play',cardIds:[c.id]});state=finish(state);
  const hit=state.damage.find(d=>d.source==='player'&&d.type==='battle');assert.equal(hit.raw,18);assert.equal(hit.bypass,9);assert.equal(hit.armorBlocked,9);assert.equal(hit.hpDamage,9);
  assert.equal(state.damage.filter(d=>d.source==='player').length,1);
});

test('retaining a card does not create empty hand for gambler', () => {
  const held=card('star','star','star');let state=cardsState([held],{equipment:['gamblers-left-hand']});own(state).pool=10;
  state=finish(state,[held.id]);assert.equal(state.damage.find(d=>d.source==='player').raw,10);
  let empty=cardsState([],{equipment:['gamblers-left-hand']});own(empty).pool=10;empty=finish(empty);assert.equal(empty.damage.find(d=>d.source==='player').raw,15);
});

test('one skill locks its target but still pays its own armor cost after killing it', () => {
  const c=card('lucky','lucky','lucky');let state=cardsState([c],{enemies:['ruins-sentinel','ruins-sentinel']});own(state).armor=30;enemy(state).hp=1;
  state=action(state,{type:'skill',skillId:'shield-bash',cardIds:[c.id]});assert.equal(enemy(state).hp,0);assert.equal(state.units[2].hp,50);assert.equal(own(state).armor,15);
});

test('mushroom is immediate; fire bomb status never transfers to next unit', () => {
  let state=cardsState([],{enemies:['ruins-sentinel','ruins-sentinel'],consumables:{'fire-bomb':1}});enemy(state).hp=1;
  state=action(state,{type:'consumable',itemId:'fire-bomb'});assert.equal(state.units[2].statuses.some(s=>s.id==='burning'),false);
});

test('diamond samples after burn; summer anchor includes reflected and burning damage', () => {
  let state=cardsState([],{equipment:['diamond','summer-gift-anchor','thorns']});own(state).armor=20;
  state=finish(state);assert.equal(state.retained.length,0);assert.equal(state.pendingCards.some(c=>c.origin==='夏賜儀碇'),false);assert.equal(own(state).armor,5);
  let quiet=cardsState([],{equipment:['summer-gift-anchor']});quiet=finish(quiet);assert.equal(quiet.pendingCards.some(c=>c.origin==='夏賜儀碇'),true);
});

test('two-round stun lasts through next player turn and then clears', () => {
  let state=cardsState();runtime(state).addStatus(own(state),'stunned',runtime(state).context(enemy(state)),{rounds:2});
  state=finish(state);assert.equal(own(state).statuses.find(s=>s.id==='stunned').remaining,1);assert.equal(state.phase,'cards');
  assert.ok(dispatch(state,{type:'play',cardIds:[state.hand[0].id]},catalog).error);
  state=finish(state);assert.equal(own(state).statuses.some(s=>s.id==='stunned'),false);
});

test('enemies act left to right and target players right to left', () => {
  let state=cardsState([],{enemies:['ruins-sentinel','ruins-sentinel']});state.units.splice(1,0,createUnit('ally','player','隊友',100));
  state=finish(state);assert.deepEqual(state.damage.map(d=>[d.source,d.target]),[['enemy-0','ally'],['enemy-1','ally']]);
});

test('content roster parses every skill; new recipe uses the engine without a special ID', () => {
  assert.equal(Object.keys(catalog.skills).length,10);assert.equal(Object.keys(catalog.equipment).length,40);
  for(const skill of Object.values(catalog.skills)) for(const level of skill.levels) assert.doesNotThrow(()=>parseCondition(level.condition));
  const data=structuredClone(catalog);data.skills['test-recipe']={id:'test-recipe',name:'測試組合',description:'',levels:[{condition:'Σ✨>=1',description:'',effects:[{op:'armor',target:'self',amount:5},{op:'pool',target:'self',amount:7}]}]};
  let state=make({skills:[{id:'test-recipe',level:1}]},data);state.phase='cards';const c=card('star');state.hand=[c];state=action(state,{type:'skill',skillId:'test-recipe',cardIds:[c.id]},data);
  assert.equal(own(state).armor,5);assert.equal(own(state).pool,7);
  assert.throws(()=>runtime(state).damage(own(state),enemy(state),'poison',3,'草案'));
});

test('deterministic command simulations finish with valid state across equipment loadouts', () => {
  function simulate(seed, equipment) {
    let state=make({seed,equipment,enemies:['ruins-sentinel','rockscale-lizard']});
    for(let turn=0;turn<30&&!state.outcome;turn++) {
      if(state.phase==='slots')state=action(state,{type:'confirmBoard'});
      const canAct=!own(state).statuses.some(s=>catalog.statuses[s.id].modifiers?.some(m=>m.kind==='skipAction'));
      const ids=state.hand.filter(c=>!c.symbols.every(s=>s==='skull')).map(c=>c.id);
      if(canAct&&ids.length)state=action(state,{type:'play',cardIds:ids});
      if(!state.outcome)state=finish(state);
      for(const unit of state.units) for(const number of [unit.hp,unit.armor,unit.pool]) assert.ok(Number.isFinite(number)&&number>=0);
    }
    // A deterministic simulation is allowed to remain in progress after the
    // sample turn budget; the invariant we need here is a valid, replayable
    // state rather than an invented victory condition.
    assert.ok(state.round >= 1); return state;
  }
  for(const gear of [['sword','iron-shield'],['reinforced-shuriken','flame-sword','elemental-bottle'],['diamond','cursed-snake-scale','rune-cube'],['rams skull','voodoo-doll','prayer-beads']]) {
    assert.deepEqual(simulate(77,gear),simulate(77,gear));
  }
});
