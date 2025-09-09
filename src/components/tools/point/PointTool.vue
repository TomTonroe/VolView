<template>
  <div class="overlay-no-events">
    <svg class="overlay-no-events">
      <point-widget-2D
        v-for="tool in tools"
        :key="tool.id"
        :tool-id="tool.id"
        :is-placing="tool.id === placingToolID"
        :image-id="imageId"
        :view-id="viewId"
        :view-direction="viewDirection"
        @contextmenu="openContextMenu(tool.id, $event)"
        @placed="onToolPlaced"
        @widgetHover="onHover(tool.id, $event)"
      />
    </svg>
    <annotation-info :info="overlayInfo" :tool-store="activeToolStore" />
    <annotation-context-menu ref="contextMenu" :tool-store="activeToolStore" v-slot="{ context }">
      <v-list-item class="text-subtitle-2 v-list-item--disabled">
        <template #prepend>
          <v-icon>mdi-crosshairs-gps</v-icon>
        </template>
        <v-list-item-title>
          World (mm):
          <span class="font-mono">
            [
            {{ fmt(activeToolStore.toolByID[context.forToolID]?.position?.[0]) }},
            {{ fmt(activeToolStore.toolByID[context.forToolID]?.position?.[1]) }},
            {{ fmt(activeToolStore.toolByID[context.forToolID]?.position?.[2]) }}
            ]
          </span>
        </v-list-item-title>
      </v-list-item>
    </annotation-context-menu>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onUnmounted, PropType, toRefs } from 'vue';
import { storeToRefs } from 'pinia';
import { useCurrentImage } from '@/src/composables/useCurrentImage';
import { useToolStore } from '@/src/store/tools';
import { Tools } from '@/src/store/tools/types';
import { getLPSAxisFromDir } from '@/src/utils/lps';
import { LPSAxisDir } from '@/src/types/lps';
import { usePointStore } from '@/src/store/tools/points';
import { useCurrentTools, useContextMenu, useHover, usePlacingAnnotationTool } from '@/src/composables/annotationTool';
import AnnotationContextMenu from '@/src/components/tools/AnnotationContextMenu.vue';
import AnnotationInfo from '@/src/components/tools/AnnotationInfo.vue';
import { useFrameOfReference } from '@/src/composables/useFrameOfReference';
import { Maybe } from '@/src/types';
import { useSliceInfo } from '@/src/composables/useSliceInfo';
import { watchImmediate } from '@vueuse/core';
import PointWidget2D from './PointWidget2D.vue';

const useActiveToolStore = usePointStore;
const toolType = Tools.Point;

export default defineComponent({
  name: 'PointTool',
  props: {
    viewId: { type: String, required: true },
    viewDirection: { type: String as PropType<LPSAxisDir>, required: true },
    imageId: String as PropType<Maybe<string>>,
  },
  components: { PointWidget2D, AnnotationContextMenu, AnnotationInfo },
  setup(props) {
    const { viewDirection, imageId, viewId } = toRefs(props);
    const toolStore = useToolStore();
    const activeToolStore = useActiveToolStore();
    const { activeLabel } = storeToRefs(activeToolStore);

    const sliceInfo = useSliceInfo(viewId, imageId);
    const slice = computed(() => sliceInfo.value?.slice ?? 0);

    const { currentImageID, currentImageMetadata } = useCurrentImage();
    const isToolActive = computed(() => toolStore.currentTool === toolType);
    const viewAxis = computed(() => getLPSAxisFromDir(viewDirection.value));

    const frameOfReference = useFrameOfReference(viewDirection, slice, currentImageMetadata);

    const placingTool = usePlacingAnnotationTool(
      activeToolStore,
      computed(() => {
        if (!currentImageID.value) return {};
        return {
          imageID: currentImageID.value,
          frameOfReference: frameOfReference.value,
          slice: slice.value,
          label: activeLabel.value,
          ...(activeLabel.value && activeToolStore.labels[activeLabel.value]),
        };
      })
    );

    watchImmediate([isToolActive, currentImageID] as const, ([active, imageID]) => {
      placingTool.remove();
      if (active && imageID) placingTool.add();
    });

    onUnmounted(() => { placingTool.remove(); });

    const onToolPlaced = () => {
      if (currentImageID.value) {
        placingTool.commit();
        placingTool.add();
      }
    };

    const { contextMenu, openContextMenu } = useContextMenu();
    const currentTools = useCurrentTools(activeToolStore, viewAxis);
    const { onHover, overlayInfo } = useHover(currentTools, slice);

    const fmt = (n?: number) =>
      typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '';

    return {
      tools: currentTools,
      placingToolID: placingTool.id,
      onToolPlaced,
      contextMenu,
      openContextMenu,
      activeToolStore,
      onHover,
      overlayInfo,
      fmt,
    };
  },
});
</script>

<style scoped src="@/src/components/styles/vtk-view.css"></style>
