<!-- web/src/components/auth/AuthDialog.vue -->
<template>
  <v-card>
    <v-card-text>
      <!-- Not routed, so the work behind the dialog survives. No plate or repo
           readout: those belong on the full sign-in page. -->
      <UiAuthCard
        :kind="kind"
        :return-to="returnTo"
        :routed="false"
        :repo="false"
        @switch="kind = $event"
      >
        <template
          v-for="name in forwarded"
          :key="name"
          #[name]
        >
          <slot :name="name" />
        </template>
      </UiAuthCard>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import UiAuthCard from './AuthCard.vue'
import type { KratosFlowKind } from '../../composables/kratos/useKratosFlow'
import { useForwardedSlots } from '../../composables/primitives/internal/slots'

// The plate slots are not forwarded; see the template.
const FORWARDED = ['brand', 'prepend', 'append', 'form-prepend', 'form-append'] as const

/**
 * The credential card in a dialog, for a session that expired mid-work. Kratos
 * still redirects on success; the dialog only avoids leaving the page first.
 */
const { kind: initial = 'login', returnTo = '' } = defineProps<{
  kind?: KratosFlowKind
  returnTo?: string
}>()

const forwarded = useForwardedSlots({ only: FORWARDED })

// Local, because the switch stays inside the dialog.
const kind = ref<KratosFlowKind>(initial)
</script>
