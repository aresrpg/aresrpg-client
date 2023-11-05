<template lang="pug">
.container
  h1 404
  span there is nothing here..
  .btn(@click.native="$router.push('/')") take me back 🤗
</template>

<style lang="stylus" scoped>
.container
  display flex
  flex-flow column nowrap
  width 100vw
  height 100vh
  justify-content center
  align-items center
  color #fff
  h1
    font-size 10rem
  .btn
    cursor pointer
    text-decoration underline
    font-size .7em
</style>
