<template>
  <g>
    <circle
      v-if="pt"
      :cx="pt.x"
      :cy="pt.y"
      :stroke="color"
      :stroke-width="strokeWidth"
      :fill="color"
      :r="ANNOTATION_TOOL_HANDLE_RADIUS"
      class="handle"
    />
  </g>
</template>

<script lang="ts">
import { onVTKEvent } from '@/src/composables/onVTKEvent';
import { ANNOTATION_TOOL_HANDLE_RADIUS } from '@/src/constants';
import { worldToSVG } from '@/src/utils/vtk-helpers';
import type { Vector3 } from '@kitware/vtk.js/types';
import { PropType, defineComponent, toRefs, unref, ref, watch, inject } from 'vue';
import { VtkViewContext } from '@/src/components/vtk/context';
import { useResizeObserver } from '@vueuse/core';
import { vtkFieldRef } from '@/src/core/vtk/vtkFieldRef';

type SVGPoint = { x: number; y: number };

export default defineComponent({
  props: {
    position: Array as PropType<Array<number>>,
    color: String,
    strokeWidth: Number,
  },
  setup(props) {
    const { position } = toRefs(props);
    const pt = ref<SVGPoint | null>();

    const view = inject(VtkViewContext);
    if (!view) throw new Error('No VtkView');

    const updatePoint = () => {
      const viewRenderer = view.renderer;
      const p = unref(position) as Vector3 | undefined;
      if (p) {
        const point2D = worldToSVG(p, viewRenderer);
        if (point2D) pt.value = { x: point2D[0], y: point2D[1] };
      } else {
        pt.value = null;
      }
    };

    const camera = vtkFieldRef(view.renderer, 'activeCamera');
    onVTKEvent(camera, 'onModified', updatePoint);
    watch([position], updatePoint, { deep: true, immediate: true });

    const container = vtkFieldRef(view.renderWindowView, 'container');
    useResizeObserver(container, updatePoint);

    return {
      pt,
      ANNOTATION_TOOL_HANDLE_RADIUS,
    };
  },
});
</script>

<style scoped>
.handle { cursor: pointer; }
</style>
