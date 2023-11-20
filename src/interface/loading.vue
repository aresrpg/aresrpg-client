<template lang="pug">
.background(v-if="loading")
  .loader
</template>

<script setup>
import { inject } from 'vue'

const loading = inject('loading')
</script>

<style lang="stylus" scoped>
.background
  position absolute
  z-index 2
  width 100vw
  height 100vh
  background rgba(#212121, .9)
  display flex
  justify-content center
  align-items center
.loader {
  width: 48px;
  height: 48px;
  border: 3px solid white
  border-radius: 50%;
  display: inline-block;
  position: relative;
  box-sizing: border-box;
  animation: rotation 1s linear infinite;
}
.loader::after {
  content: '';
  box-sizing: border-box;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid;
  border-color: #FDD835 transparent;
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
