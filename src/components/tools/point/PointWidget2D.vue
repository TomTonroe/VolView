<script setup lang="ts">
import vtkPointWidget, { InteractionState, vtkPointViewWidget } from '@/src/vtk/PointWidget';
import { reactive, computed, toRefs, watch, inject, onUnmounted, watchEffect } from 'vue';
import vtkPlaneManipulator from '@kitware/vtk.js/Widgets/Manipulators/PlaneManipulator';
import { useImage } from '@/src/composables/useCurrentImage';
import { updatePlaneManipulatorFor2DView } from '@/src/utils/manipulators';
import type { LPSAxisDir } from '@/src/types/lps';
import { usePointStore } from '@/src/store/tools/points';
import { onVTKEvent } from '@/src/composables/onVTKEvent';
import { useRightClickContextMenu, useHoverEvent, useWidgetVisibility } from '@/src/composables/annotationTool';
import type { ToolID } from '@/src/types/annotation-tool';
import type { Maybe } from '@/src/types';
import { useSliceInfo } from '@/src/composables/useSliceInfo';
import { VtkViewContext } from '@/src/components/vtk/context';
import { whenever } from '@vueuse/core';
import PointSVG2D from './PointSVG2D.vue';

type Props = {
  toolId: ToolID;
  viewId: string;
  viewDirection: LPSAxisDir;
  isPlacing?: boolean;
  imageId?: Maybe<string>;
};

const props = defineProps<Props>();
const emit = defineEmits(['placed', 'contextmenu', 'widgetHover']);

const { toolId, viewId, viewDirection, imageId } = toRefs(props);
const isPlacing = computed(() => !!props.isPlacing);

const view = inject(VtkViewContext);
if (!view) throw new Error('No VtkView');

const sliceInfo = useSliceInfo(viewId, imageId);
const slice = computed(() => sliceInfo.value?.slice ?? 0);

const pointStore = usePointStore();
const point = computed(() => pointStore.toolByID[toolId.value]);
const { metadata: imageMetadata } = useImage(imageId);

const widgetFactory = vtkPointWidget.newInstance({ id: toolId.value, isPlaced: !isPlacing.value });
const widget = view.widgetManager.addWidget(widgetFactory) as vtkPointViewWidget;

onUnmounted(() => {
  view.widgetManager.removeWidget(widget);
  widgetFactory.delete();
});

whenever(isPlacing, () => { widget.setInteractionState(InteractionState.Placing); }, { immediate: true });

watch([slice, imageId], () => {
  const placed = (widget.getWidgetState() as any).getIsPlaced?.();
  if (!placed) {
    widget.resetInteractions();
    widget.setInteractionState(InteractionState.Placing);
  }
});

onVTKEvent(widget, 'onPlacedEvent', () => emit('placed'));
useHoverEvent(emit, widget);
useRightClickContextMenu(emit, widget);

const manipulator = vtkPlaneManipulator.newInstance();
widget.setManipulator(manipulator);
watchEffect(() => {
  updatePlaneManipulatorFor2DView(
    manipulator,
    viewDirection.value,
    point.value?.slice ?? slice.value,
    imageMetadata.value
  );
});

const isVisible = computed(() => point.value?.slice === slice.value);
useWidgetVisibility(widget, isVisible, view);

const visibleStates = reactive({ handle: false });
const widgetState = (widgetFactory as any).getWidgetState();
onVTKEvent(widgetState, 'onModified', () => {
  visibleStates.handle = widgetState.getPoint().getVisible();
});
visibleStates.handle = widgetState.getPoint().getVisible();

const position = computed(() => (visibleStates.handle ? point.value?.position : undefined));

// expose to template
defineExpose({});
</script>

<template>
  <PointSVG2D v-show="slice === point.slice" :position="position" :color="point.color" :strokeWidth="point.strokeWidth" />
</template>
