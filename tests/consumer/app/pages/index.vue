<!-- tests/consumer/app/pages/index.vue -->
<template>
  <v-container
    class="fixture"
    :data-ready="ready"
  >
    <h1 class="text-headline-small mb-4">
      S99AB component checks
    </h1>
    <div class="d-flex flex-wrap ga-2 mb-5">
      <v-btn
        data-testid="mode"
        @click="appearance.setMode(appearance.dark.value ? 'light' : 'dark', undefined, 'none')"
      >
        {{ appearance.dark.value ? 'Light' : 'Dark' }}
      </v-btn>
      <v-btn
        data-testid="contrast"
        @click="appearance.setContrast(appearance.high.value ? 'normal' : 'high', undefined, 'none')"
      >
        Contrast
      </v-btn>
      <v-btn
        data-testid="locale"
        @click="locale = locale === 'en' ? 'pl' : 'en'"
      >
        {{ locale }}
      </v-btn>
    </div>
    <UiTabStrip
      :workspace="workspace"
      :title-of="tab => tab.title"
      :icon-of="() => 'mdi-folder'"
      :tint-of="() => undefined"
      tabs-label="Workspace"
      :close-label="tab => `Close ${tab.title}`"
      moving-reason="Moving"
      :tab-menu="() => []"
      :strip-menu="() => []"
    />
    <UiReleaseNotice
      class="my-5"
      :text="description"
    />
    <UiDownloadAssetRow
      :row="download"
      class="mb-5"
    />
    <v-card class="pa-5 mb-5">
      <v-text-field
        label="Email"
        model-value="invalid"
        :error-messages="locale === 'pl' ? 'Wpisz poprawny adres e-mail.' : 'Enter a valid email address.'"
      />
      <v-text-field
        label="Password"
        type="password"
        model-value="example"
      />
      <v-otp-input
        length="6"
        model-value="123456"
        aria-label="Recovery code"
      />
      <UiButton
        loading
        color="accent"
      >
        Saving
      </UiButton>
    </v-card>
    <v-menu
      :close-on-content-click="false"
      max-width="340"
    >
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          data-testid="menu"
        >
          Open menu
        </v-btn>
      </template>
      <v-card data-testid="menu-card">
        <v-list>
          <v-list-item
            data-testid="avatar-row"
            :title="description"
          >
            <template #prepend>
              <v-avatar
                size="48"
                color="accent"
              >
                AB
              </v-avatar>
            </template>
          </v-list-item>
          <v-list-item
            data-testid="image-row"
            title="Landscape"
          >
            <template #prepend>
              <img
                :src="thumbnail"
                width="64"
                height="40"
                alt="Landscape"
              >
            </template>
          </v-list-item>
          <v-list-item
            data-testid="icon-row"
            prepend-icon="mdi-download"
            title="Download"
          />
          <v-list-item
            data-testid="checkbox-row"
            title="Notifications"
          >
            <template #prepend>
              <v-checkbox-btn aria-label="Notifications" />
            </template>
          </v-list-item>
        </v-list>
      </v-card>
    </v-menu>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppearance } from '../../../../web/src/composables/appearance/useAppearance'
import { useTabs, type WorkspaceTab } from '../../../../web/src/composables/tabs/useTabs'

const ready = ref(false)
const appearance = useAppearance()
const { locale } = useI18n()
const description = computed(() => locale.value === 'pl'
  ? 'Informacje o aktualizacji oraz szczegółowe ustawienia pobierania aplikacji'
  : 'Release information and application download preferences')
const download = computed(() => ({
  key: 'linux-deb',
  label: 'Linux', sub: description.value, kind: 'deb', primary: true,
  filename: 's99ab-example-with-a-long-release-filename_1.8.1_amd64.deb',
  size: '25 MB', url: '#download', digest: '', version: '',
}))
const thumbnail = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40"><rect width="64" height="40" fill="#597c92"/></svg>')
const workspace = reactive(useTabs<WorkspaceTab & { title: string }, string>({
  home: { id: 'home', title: 'Home', pinned: true },
  make: (title: string) => ({ title }), read: tab => tab.title,
  apply: (tab, title) => { tab.title = title },
  key: tab => tab.title, isHome: title => title === 'Home',
}))
workspace.open('Downloads', { newTab: true })
onMounted(() => {
  ready.value = true
})
</script>

<style scoped>
.fixture { max-width: 860px; }
</style>
