<script setup>
import { ref } from 'vue';

import agility from '../assets/statistics/agility.png';
import chance from '../assets/statistics/chance.png';
import intelligence from '../assets/statistics/intelligence.png';
import wisdom from '../assets/statistics/wisdom.png';
import raw_damage from '../assets/statistics/raw_damage.png';
import strength from '../assets/statistics/strength.png';
import vitality from '../assets/statistics/vitality.png';

import Tabs from './tabs.vue';
import { spell_icons } from './spell_icons.js';

const props = defineProps(['spells']);

const damage_text = damage => {
  return damage.min === damage.max
    ? `${damage.min} damage`
    : `${damage.min} to ${damage.max} damages`;
};

const critical_text = damage => {
  return damage.critical_min === damage.critical_max
    ? `${damage.critical_min} critical`
    : `${damage.critical_min} - ${damage.critical_max} critical`;
};

const critical_chance = data => {
  console.log(data);
  if (data.critical_chance)
    return `${data.critical_chance[0]}/${data.critical_chance[1]}`;
};

const has_critical = data => {
  return data.critical_effects.length;
};

const effects_tab = data => {
  if (!data.base_effects.length) return;
  return {
    Effects: data.base_effects,
    ...(has_critical(data) && { Critical: data.critical_effects }),
  };
};

const element_to_icon = element => {
  switch (element) {
    case 'air':
      return agility;
    case 'water':
      return chance;
    case 'fire':
      return intelligence;
    case 'earth':
      return strength;
    case 'raw':
      return raw_damage;
  }
};

const element_to_color = element => {
  switch (element) {
    case 'air':
      return '#66BB6A';
    case 'water':
      return '#42A5F5';
    case 'fire':
      return '#EF5350';
    case 'earth':
      return '#8D6E63';
    case 'raw':
      return '#EEEEEE';
  }
};
</script>

<template lang="pug">
.container
  vs-tooltip(
    v-for="spell in props.spells"
    interactivity
  )
    .spell
      img(:src="spell_icons[spell.icon]")
    template(#content)
      .content
        .name {{ spell.name }}
        .level Unlock at level: #[b {{ spell.level }}]
        .desc {{ spell.description }}
        Tabs(
          :tabs="Object.fromEntries(spell.levels.map((level, index) => [index+1, level]))"
        )
          template(#before-tabs)
            span.spell-level Spell level
          template(#tab="{ tab }")
            span.spell-level-name {{ tab }}
          template(#content="{ data }")
            .head
              .ap
                i.bx.bxs-bolt
                span {{ data.cost }}
              .range
                i.bx.bx-map-pin
                span {{ data.range[0] }} - {{ data.range[1] }}
            .effects
              Tabs(
                v-if="effects_tab(data)"
                :tabs="effects_tab(data)"
              )
                template(#tab="{ tab }")
                  span.title {{ tab }}
                template(#content="{ data: effects }")
                  .effect(v-for="effect in effects")
                    .effect-line(v-if="effect.type === 'damage'")
                      img(:src="element_to_icon(effect.element)")
                      span
                        | Deals #[b(:style="{ color: element_to_color(effect.element)}") {{ damage_text(effect) }}]
                        | #[span.crit(v-if="effect.critical_min") {{ critical_text(effect) }}]
                    .effect-line(v-else-if="effect.type === 'add_damage'")
                      img(:src="element_to_icon(effect.element)")
                      span
                        | + #[b(:style="{ color: element_to_color(effect.element)}") {{ damage_text(effect) }}]
                        | #[span.crit(v-if="effect.critical_min") {{ critical_text(effect) }}]
            .attributes
              span.title Attributes
              .critical(v-if="has_critical(data)") Critical chance #[b {{ critical_chance(data) }}]
              .area(v-if="data.area") Area #[b {{ data.area }}]

</template>

<style lang="stylus" scoped>

.head
  display flex
  flex-flow row nowrap
  justify-content space-evenly
  >div
    display flex
    flex-flow row nowrap
    align-items center
    border-radius 6px
    i
      font-size 1.2em
      margin-right .2em
  .ap
    i
      color #3498DB

.effects, .attributes
  span.title
    text-transform uppercase
    font-size .8em
    font-weight bold
    opacity .7
    padding 0 .5em
  >div
    font-size .9em
    margin .5em 0
    .effect
      .effect-line
        display flex
        flex-flow row nowrap
        align-items center
        margin-left .5em
        >img
          width 20px
          height 20px
          margin-right .5em
        span
          font-size 1.1em
          b
            font-weight 900
          .crit
            color #eee
            background-color #000000
            border-radius 6px
            opacity .8
            font-size .9em
            margin-left .5em
            padding .1em .3em
.attributes
  >div
      padding 0em 2em
      font-size .9em
      display flex
      justify-content space-between
      b
        font-weight 900
        margin-left .5em
        color #eee
        background-color #37474F
        border-radius 6px
        font-size .9em
        padding .1em .3em
.container
  display flex
  padding 1em
  flex-wrap wrap
  .spell
    width 60px
    margin .25em
    height @width
    border-radius 6px
    overflow hidden
    border 2px solid black
    cursor pointer
    img
      width 100%
      height 100%
      object-fit cover
.content
  display flex
  flex-flow column nowrap
  >div
    text-align start
  .name
    font-weight bold
    font-size 1.2em
    text-transform uppercase
  .level
    font-size .9em
    b
      text-decoration none
      color #F1C40F
      font-weight 900
  .desc
    font-size .9em
    text-align justify
    margin 1em
    font-style italic
    padding-bottom .5em
    border-bottom 1px solid #eee
  .spell-level
    text-transform uppercase
    font-size .7em
    font-weight bold
    opacity .7
    padding-right 1em
  .spell-level-name
    font-weight 900
    padding 0 .5em
</style>
