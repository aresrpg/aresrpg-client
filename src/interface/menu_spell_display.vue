<script setup>
import { spell_icons } from './spell_icons.js';
import SpellCard from './spell_card.vue';

const props = defineProps(['spells']);
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
      SpellCard(:spell="spell")
</template>

<style lang="stylus" scoped>
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
</style>
