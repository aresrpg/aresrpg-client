<script setup>
// chat-gpt generated code
import { ref, onMounted, nextTick } from 'vue';
const props = defineProps(['tabs']);
const activeTab = ref(Object.keys(props.tabs)[0]);
const borderStyle = ref({});

const tabsContainerRef = ref(null);

const updateBorderStyle = tabElement => {
  borderStyle.value = {
    width: `${tabElement.offsetWidth}px`,
    transform: `translateX(${tabElement.offsetLeft}px)`,
  };
};

const setActiveTab = (tab, event) => {
  activeTab.value = tab;
  updateBorderStyle(event.currentTarget);
};

onMounted(async () => {
  // Wait for the next DOM update cycle to ensure all elements are rendered
  await nextTick();
  const activeTabElement = tabsContainerRef.value.querySelector('.tab.active');
  if (activeTabElement) {
    updateBorderStyle(activeTabElement);
  }
});
</script>

<template lang="pug">
.tabs
  .tabs-container(ref="tabsContainerRef")
    slot(name="before-tabs")
    .tab(
      v-for="(tab, name) in props.tabs" :key="name"
      :class="{ 'active': activeTab === name }"
      @click="event => setActiveTab(name, event)"
    )
      slot(:tab="name" name="tab" @click.stop.prevent) {{ name }}
    .animated-border(:style="borderStyle")
  .tab-content
    slot(name="content" :data="props.tabs[activeTab]" :tab="activeTab")
      | Content for {{ activeTab }}
</template>

<style lang="stylus" scoped>

.tabs
  position: relative
  .tabs-container
    display: flex
    margin-bottom: -1px // Overlap the tabs with the border
    position: relative
    align-items: center
    .tab
      opacity: .5
      cursor: pointer
      user-select: none
      position: relative
      z-index: 1 // Ensure tabs are above the border
      transition: color 0.3s ease
      &.active
        opacity: 1

  .animated-border
    height: 1px
    background-color #eee
    position: absolute
    bottom: 0
    transition: all 0.3s ease

  .tab-content
    padding: .25em
    padding-top: 1em
    background lighten(#212121, 7%)
    border-radius 6px
</style>
