import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../game/data/catalog.ts';
import { adventureRules as rules } from '../game/data/adventure.ts';
import { createAdventure, dispatchAdventure, eliteChance, enterEvent, nextEncounter } from '../game/adventure/engine.ts';
import { eventEffects } from '../game/adventure/event-effects.ts';
import { rewardPool, rollRewards, shopPrice } from '../game/adventure/rewards.ts';
import { newSave, restoreAdventure } from '../game/adventure/save.ts';
import { random } from '../game/random.ts';

const setup = { seed: 73, skills: ['power-strike'], equipment: ['sword'] };
const make = (seed = 73, data = catalog, config = rules) => createAdventure({ ...setup, seed }, data, config);
const act = (state, command, config = rules, data = catalog) => {
  const result = dispatchAdventure(state, command, data, config);
  assert.equal(result.error, undefined, `${JSON.stringify(command)}: ${result.error}`);
  return result.state;
};
const enter = (id, config = rules) => { const state = make(); enterEvent(state, id, config); return state; };
const onlyOutcome = (eventId, optionId, outcomeId) => {
  const config = structuredClone(rules);
  const option = config.events[eventId].options.find(option => option.id === optionId);
  option.outcomes = [option.outcomes.find(outcome => outcome.id === outcomeId)];
  return config;
};
const defeatEnemy = state => {
  state.battle.phase = 'cards';
  state.battle.units[0].pool = 10000;
  state = act(state, { type:'battle', command:{type:'beginEnd'} });
  return act(state, { type:'battle', command:{type:'end',cardIds:[]} });
};

test('adventure starts with permitted loadout and never starts at an event', () => {
  for (let seed=0;seed<100;seed++) {
    const state=make(seed);
    assert.equal(state.phase,'battle'); assert.equal(state.battle.ap,3);
    assert.notEqual(catalog.enemies[state.enemyId].draft,true);
    assert.deepEqual(state.player.skills,[{id:'power-strike',level:1}]);
  }
  assert.throws(()=>createAdventure({...setup,skills:['power-strike','life-recovery']},catalog,rules));
  assert.throws(()=>createAdventure({...setup,equipment:['diamond']},catalog,rules));
});

test('elite minimum is supplied by equipment modifier and scales to newly authored equipment', () => {
  const state=make();assert.equal(eliteChance(state,catalog,rules),.12);
  state.player.equipment.push('red-oni-mask');assert.equal(eliteChance(state,catalog,rules),.2);
  const data=structuredClone(catalog);
  data.equipment.testMask={id:'testMask',name:'Mask',description:'',modifiers:[{kind:'eliteChanceMinimum',value:.5}]};
  state.player.equipment.push('testMask');assert.equal(eliteChance(state,data,rules),.5);
});

test('victory settles once; HP, max HP and inventory carry into subsequent battle', () => {
  let state=make();state.battle.units[0].hp=17;state.battle.units[0].maxHp=51;
  state.battle.inventory['healing-potion']=2;
  state=defeatEnemy(state);state=act(state,{type:'settleBattle'});
  assert.equal(state.phase,'reward'); assert.equal(state.player.hp,17);assert.equal(state.player.maxHp,51);
  assert.equal(state.player.inventory['healing-potion'],2);assert.equal(state.completed,1);
  const rejected=dispatchAdventure(state,{type:'settleBattle'},catalog,rules);
  assert.ok(rejected.error);assert.strictEqual(rejected.state,state);
  const config=structuredClone(rules);config.region.eventChance=0;
  state=act(state,{type:'reward',index:null},config);
  assert.equal(state.battle.units[0].hp,17);assert.equal(state.battle.units[0].maxHp,51);
  assert.equal(state.battle.inventory['healing-potion'],2);
});

test('boss victory restores HP, advances depth and scales the next battle', () => {
  let state=make();state.progress=20;nextEncounter(state,catalog,rules);
  assert.equal(state.enemyId,'ruins-guardian');state.battle.units[0].hp=1;
  state=act(defeatEnemy(state),{type:'settleBattle'});
  assert.equal(state.player.hp,45);assert.equal(state.bosses,1);assert.ok(state.rewards.length>0);
  const config=structuredClone(rules);config.region.eventChance=0;
  state=act(state,{type:'reward',index:0},config);
  assert.equal(state.depth,2);assert.equal(state.progress,0);
  assert.equal(state.battle.units[1].maxHp,Math.round(catalog.enemies[state.enemyId].hp*1.5));
});

test('defeat ends the run without gold or duplicate reward settlement', () => {
  let state=make();state.battle.units[0].hp=0;state.battle.outcome='defeat';state.battle.phase='finished';
  state=act(state,{type:'settleBattle'});
  assert.equal(state.phase,'ended');assert.equal(state.player.gold,0);
  assert.ok(dispatchAdventure(state,{type:'reward',index:null},catalog,rules).error);
});

test('reward pools exclude owned weapon families and maximum-level skills; choices are distinct', () => {
  const state=make();state.player.equipment=['reinforced-longsword'];
  state.player.skills=[{id:'power-strike',level:3},{id:'life-recovery',level:1},{id:'shield-block',level:1}];
  const pool=rewardPool(state.player,catalog,rules,['equipment','skill'],'普通');
  assert.equal(pool.some(item=>item.id==='sword'||item.id==='power-strike'),false);
  assert.ok(pool.some(item=>item.id==='life-recovery'));
  for (let i=0;i<20;i++) {
    const rewards=rollRewards(state,catalog,rules,rules.loot['ruins-boss-loot']);
    assert.equal(new Set(rewards.map(reward=>reward.id)).size,rewards.length);
    assert.ok(rewards.every(reward=>!Object.values(rules.weaponUpgrades).includes(reward.id)));
  }
});

test('all eleven event definitions and every weighted outcome have executable handlers', () => {
  assert.equal(Object.keys(rules.events).length,11);
  for (const definition of Object.values(rules.events)) for (const option of definition.options) for (const outcome of option.outcomes) {
    assert.equal(typeof eventEffects[outcome.type],'function',outcome.type);
    const config=onlyOutcome(definition.id,option.id,outcome.id);
    let state=enter(definition.id,config);state.player.gold=500;state.player.inventory.whetstone=2;
    state=act(state,{type:'option',id:option.id},config);
    assert.ok(state.phase==='battle'||state.encounter.stage!=='choice',`${definition.id}/${outcome.id}`);
  }
});

test('spring seal lasts for the next battle only and blocks material payment atomically', () => {
  const config=onlyOutcome('ruins-mysterious-spring','drink','sealed-skill');config.region.eventChance=0;
  let state=enter('ruins-mysterious-spring',config);
  state=act(state,{type:'option',id:'drink'},config);
  assert.deepEqual(state.player.sealedNext,['power-strike']);
  state=act(state,{type:'continue'},config);
  assert.deepEqual(state.battle.sealedSkills,['power-strike']);assert.deepEqual(state.player.sealedNext,[]);
  state.battle.phase='cards';state.battle.hand=[{id:'sword3',symbols:['attack','attack','attack'],origin:'test'}];
  const rejected=dispatchAdventure(state,{type:'battle',command:{type:'skill',skillId:'power-strike',cardIds:['sword3']}},catalog,config);
  assert.ok(rejected.error);assert.strictEqual(rejected.state,state);assert.equal(state.battle.hand.length,1);
  state=act(act(defeatEnemy(state),{type:'settleBattle'},config),{type:'reward',index:null},config);
  assert.deepEqual(state.battle.sealedSkills,[]);
});

test('explorer blessing uses revised buff identity, carries nine rounds and charges once', () => {
  const config=structuredClone(rules);config.region.eventChance=0;
  let state=enter('ruins-aged-explorer');state.player.gold=30;state.player.equipment=[];
  state=act(state,{type:'option',id:'fund'},config);
  assert.equal(state.player.gold,0);assert.equal(state.player.statusesNext[0].id,'attack-up-3');
  state=act(state,{type:'continue'},config);
  const buff=state.battle.units[0].statuses.find(status=>status.id==='attack-up-3');
  assert.equal(buff.remaining,9);assert.equal(state.battle.units[0].pool,3);
  assert.equal(state.player.statusesNext.length,0);
});

test('shop transactions charge growing rounded prices and reject repeat item purchases', () => {
  let state=enter('ruins-mysterious-shop');state.player.gold=500;
  state=act(state,{type:'option',id:'browse'});
  assert.equal(shopPrice(state,rules),38);assert.equal(state.encounter.shop.offers.length,3);
  const item=state.encounter.shop.offers[0];
  state=act(state,{type:'buy',id:item.id,kind:'item'});
  assert.equal(state.player.gold,462);assert.equal(shopPrice(state,rules),67);
  const duplicate=dispatchAdventure(state,{type:'buy',id:item.id,kind:'item'},catalog,rules);
  assert.ok(duplicate.error);assert.strictEqual(duplicate.state,state);
  state=act(state,{type:'buy',id:'power-strike',kind:'skill'});
  assert.equal(state.player.gold,395);assert.equal(state.player.skills[0].level,2);assert.equal(shopPrice(state,rules),119);
  state.player.gold=0;assert.ok(dispatchAdventure(state,{type:'buy',id:'power-strike',kind:'skill'},catalog,rules).error);
  state=act(state,{type:'leave'});assert.equal(state.encounter.stage,'result');
});

test('blacksmith guaranteed upgrade consumes stone and fee; failed forge keeps the weapon', () => {
  let state=enter('ruins-treasure-blacksmith');state.player.gold=20;
  assert.ok(dispatchAdventure(state,{type:'option',id:'forge-guaranteed'},catalog,rules).error);
  state.player.inventory.whetstone=1;
  state=act(state,{type:'option',id:'forge-guaranteed'});
  assert.equal(state.player.gold,0);assert.equal(state.player.inventory.whetstone,0);
  state=act(state,{type:'forge',id:'sword'});assert.deepEqual(state.player.equipment,['reinforced-longsword']);
  state=enter('ruins-treasure-blacksmith');state.player.gold=20;
  const config=structuredClone(rules);config.events['ruins-treasure-blacksmith'].options[0].outcomes[0].successChance=0;
  state=act(state,{type:'option',id:'forge-risky'},config);state=act(state,{type:'forge',id:'sword'},config);
  assert.deepEqual(state.player.equipment,['sword']);assert.equal(state.player.gold,0);
});

test('vault cost rounds half-up, is nonlethal, and equipment requires an explicit choice', () => {
  let state=enter('ruins-sealed-vault');state.player.hp=45;
  state=act(state,{type:'option',id:'blood-unseal'});
  assert.equal(state.player.hp,22);assert.equal(state.encounter.stage,'vault');assert.equal(state.player.equipment.length,1);
  const id=state.encounter.reward.id;state=act(state,{type:'vault',accept:true});assert.ok(state.player.equipment.includes(id));
  state=enter('ruins-sealed-vault');state.player.hp=1;state=act(state,{type:'option',id:'blood-unseal'});
  assert.equal(state.player.hp,1);
});

test('ancient echo lowers max HP and lets the player select the skill upgrade', () => {
  let state=enter('ruins-ancient-echo');state=act(state,{type:'option',id:'accept'});
  assert.equal(state.player.maxHp,36);assert.equal(state.encounter.stage,'upgrade');assert.equal(state.player.skills[0].level,1);
  state=act(state,{type:'eventSkill',id:'power-strike'});assert.equal(state.player.skills[0].level,2);assert.equal(state.encounter.stage,'result');
});

test('corpse searches escalate risk, preserve earlier rewards and never award loot on ambush', () => {
  const config=structuredClone(rules);
  config.events['ruins-adventurer-corpse'].options[0].outcomes[0].eliteChances=[0,1,1];
  let state=enter('ruins-adventurer-corpse');state=act(state,{type:'option',id:'search'},config);
  assert.equal(state.encounter.corpse.attempts,1);assert.equal(state.encounter.stage,'corpse');
  const before=structuredClone(state.player);
  state=act(state,{type:'search'},config);
  assert.equal(state.phase,'battle');assert.equal(catalog.enemies[state.enemyId].tier,'菁英');
  assert.equal(state.player.gold,before.gold);assert.deepEqual(state.player.inventory,before.inventory);
});

test('collector wager consumes zero spins; locks do not draw or consume attempts', () => {
  let state=enter('ruins-mysterious-collector');state=act(state,{type:'option',id:'challenge-item'});
  const before=state.rng;state=act(state,{type:'eventSkill',id:'power-strike'});
  assert.equal(state.encounter.collector.attempt,0);assert.deepEqual(state.encounter.collector.reels,[]);assert.equal(state.rng,before);
  state.rng=1;state=act(state,{type:'collectorSpin'});assert.equal(state.encounter.stage,'spin');
  const collector=structuredClone(state.encounter.collector);const rng=state.rng;
  state=act(state,{type:'collectorLock',index:0});
  assert.equal(state.encounter.collector.attempt,1);assert.equal(state.rng,rng);assert.deepEqual(state.encounter.collector.reels,collector.reels);
  const locked=state.encounter.collector.reels[0];state=act(state,{type:'collectorSpin'});assert.equal(state.encounter.collector.reels[0],locked);
});

test('collector permits four actual failed spins and removes only the wager at the fourth', () => {
  let state=enter('ruins-mysterious-collector');state=act(state,{type:'option',id:'challenge-item'});state=act(state,{type:'eventSkill',id:'power-strike'});
  for (let i=1;i<=4;i++) {
    state.rng=1;state=act(state,{type:'collectorSpin'});
    assert.equal(state.encounter.collector.attempt,i);
    assert.equal(state.encounter.stage,i===4?'result':'spin');
    assert.equal(state.player.skills.length,i===4?0:1);
  }
  assert.ok(dispatchAdventure(state,{type:'collectorSpin'},catalog,rules).error);
});

test('collector win keeps wager and lets a full skill roster replace one skill', () => {
  let state=enter('ruins-mysterious-collector');state.player.skills.push({id:'life-recovery',level:1},{id:'shield-block',level:1});
  state=act(state,{type:'option',id:'challenge-skill'});state=act(state,{type:'eventSkill',id:'power-strike'});
  let winningSeed=0;
  for (;;winningSeed++) {
    const rng={rng:winningSeed};const values=[random(rng),random(rng),random(rng)];
    if(values.every(v=>v<.3))break;
  }
  state.rng=winningSeed;state=act(state,{type:'collectorSpin'});
  assert.equal(state.encounter.stage,'replace');const won=state.encounter.reward.id;
  state=act(state,{type:'eventSkill',id:'shield-block'});
  assert.equal(state.player.skills.length,3);assert.ok(state.player.skills.some(skill=>skill.id===won));assert.ok(state.player.skills.some(skill=>skill.id==='power-strike'));
});

test('command journal replays deterministic state and rejects incompatible or invalid saves', () => {
  let state=make();const save=newSave(setup);
  for (let round=0;round<8&&state.phase==='battle'&&!state.battle.outcome;round++) {
    const actions=[{type:'confirmBoard'}];
    for (const command of actions) {const action={type:'battle',command};state=act(state,action);save.commands.push(action);}
    const ids=state.battle.hand.map(card=>card.id);
    if (ids.length) {const action={type:'battle',command:{type:'play',cardIds:ids}};state=act(state,action);save.commands.push(action);}
    if (state.battle.outcome) break;
    for (const command of [{type:'beginEnd'},{type:'end',cardIds:[]}]) {const action={type:'battle',command};state=act(state,action);save.commands.push(action);}
  }
  assert.deepEqual(restoreAdventure(JSON.stringify(save),catalog,rules).state,state);
  assert.throws(()=>restoreAdventure(JSON.stringify({...save,revision:'old'}),catalog,rules));
  assert.throws(()=>restoreAdventure(JSON.stringify({...save,commands:[{type:'reward',index:0}]}),catalog,rules));
});
