<!-- web/layouts/blank.vue -->
<template>
  <v-app>
    <v-main>
      <slot />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
/*
  The signed-out frame: v-app only, so Vuetify's theme and layout apply. No bar,
  rail or centring. An app's own layouts/blank.vue takes precedence.
*/
</script>
