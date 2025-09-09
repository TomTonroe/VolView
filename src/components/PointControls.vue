<script setup lang="ts">
import { usePointStore } from '@/src/store/tools/points';
import LabelControls from '@/src/components/LabelControls.vue';

const activeToolStore = usePointStore();
</script>

<template>
  <label-controls :labels-store="activeToolStore" />
  <!-- Reserved for future point-specific controls -->
</template>

