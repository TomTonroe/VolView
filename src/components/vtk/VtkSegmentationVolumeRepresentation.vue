<script setup lang="ts">
import {
  toRefs,
  computed,
  inject,
  watchEffect,
  watch,
  shallowRef,
  Ref,
} from 'vue';
import { useVolumeRepresentation } from '@/src/core/vtk/useVolumeRepresentation';
import { VtkViewContext } from '@/src/components/vtk/context';
import { onVTKEvent } from '@/src/composables/onVTKEvent';
import { useSegmentGroupStore } from '@/src/store/segmentGroups';
import { useSegmentGroupConfigInitializer } from '@/src/composables/useSegmentGroupConfigInitializer';
import { useImage } from '@/src/composables/useCurrentImage';
import { isViewAnimating } from '@/src/composables/isViewAnimating';
import { useCroppingEffect } from '@/src/composables/useCroppingEffect';
import { useCropStore } from '@/src/store/tools/crop';
import { useEventListener } from '@vueuse/core';
import useLayerColoringStore from '@/src/store/view-configs/layers';
import useVolumeColoringStore from '@/src/store/view-configs/volume-coloring';
import {
  setCinematicLighting,
  setCinematicVolumeShading,
  setCinematicVolumeSampling,
  setCinematicVolumeScatter,
  setCinematicLocalAmbientOcclusion,
} from '@/src/utils/volumeProperties';
import { InterpolationType } from '@kitware/vtk.js/Rendering/Core/VolumeProperty/Constants';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import vtkBoundingBox from '@kitware/vtk.js/Common/DataModel/BoundingBox';
import type { vtkObject } from '@kitware/vtk.js/interfaces';
import {
  ChunkImage,
  type ChunkLoadedInfo,
} from '@/src/core/streaming/chunkImage';

interface Props {
  viewId: string;
  segmentationId: string;
  labelValue?: number;
}

const props = defineProps<Props>();
const { viewId, segmentationId } = toRefs(props);

const view = inject(VtkViewContext);
if (!view) throw new Error('No VtkView');

const segmentationStore = useSegmentGroupStore();
const metadata = computed(
  () => segmentationStore.metadataByID[segmentationId.value]
);
const imageData = computed(
  () => segmentationStore.dataIndex[segmentationId.value]
);

const parentImageId = computed(() => metadata.value?.parentImage);
const {
  metadata: parentImageMetadata,
  isLoading: isImageStreaming,
  image,
} = useImage(parentImageId);
const volumeColoringConfig = computed(() =>
  useVolumeColoringStore().getConfig(viewId.value, parentImageId.value)
);

const rep = useVolumeRepresentation(view, imageData);

const cfun = vtkColorTransferFunction.newInstance();
const ofun = vtkPiecewiseFunction.newInstance();
rep.property.setRGBTransferFunction(0, cfun);
rep.property.setScalarOpacity(0, ofun);
rep.property.setInterpolationType(InterpolationType.NEAREST);

[cfun, ofun].forEach((obj: vtkObject) => {
  onVTKEvent(obj, 'onModified', view.requestRender);
});

const updatedExtents = shallowRef<Array<ChunkLoadedInfo['updatedExtent']>>([]);
useEventListener(
  image as Ref<ChunkImage | null>,
  'chunkLoad',
  (info: ChunkLoadedInfo) => {
    updatedExtents.value = [...updatedExtents.value, info.updatedExtent];
  }
);

watch(updatedExtents, (current, old) => {
  const startOffset = old.length;
  rep.mapper.setUpdatedExtents([
    ...rep.mapper.getUpdatedExtents(),
    ...current.slice(startOffset),
  ]);
  view.requestRender();
});

onVTKEvent(imageData, 'onModified', view.requestRender);

useSegmentGroupConfigInitializer(viewId.value, segmentationId.value);
const coloringStore = useLayerColoringStore();

const segmentsToRender = computed(() => {
  if (!metadata.value?.segments) return [];

  return metadata.value.segments.order
    .filter((segId) => segId > 0)
    .filter((segId) => {
      const segment = metadata.value.segments.byValue[segId];
      if (!segment?.visible) return false;

      if (props.labelValue !== undefined) {
        return segment.value === props.labelValue;
      }

      return true;
    })
    .map((segId) => ({
      value: metadata.value.segments.byValue[segId].value,
      segment: metadata.value.segments.byValue[segId],
      segId,
    }))
    .sort((a, b) => a.value - b.value);
});

const applySegmentColoring = () => {
  if (!metadata.value?.segments) {
    console.warn(
      'VtkSegmentationVolumeRepresentation: No segment metadata available'
    );
    return;
  }

  cfun.removeAllPoints();
  ofun.removeAllPoints();

  cfun.addRGBPoint(0, 0, 0, 0);
  ofun.addPoint(0, 0);

  segmentsToRender.value.forEach(({ value: segmentValue, segment }) => {
    const [r = 0, g = 0, b = 0] = segment.color;

    if (segmentValue > 1) {
      cfun.addRGBPoint(segmentValue - 0.1, 0, 0, 0);
      ofun.addPoint(segmentValue - 0.1, 0);
    }

    cfun.addRGBPoint(segmentValue, r / 255, g / 255, b / 255);
    ofun.addPoint(segmentValue, 1);

    cfun.addRGBPoint(segmentValue + 0.1, 0, 0, 0);
    ofun.addPoint(segmentValue + 0.1, 0);
  });

  rep.property.modified();
};

const cvrParams = computed(() => volumeColoringConfig.value?.cvr);
const center = computed((): [number, number, number] => {
  if (!parentImageMetadata.value?.worldBounds) return [0, 0, 0];
  const centerArray = vtkBoundingBox.getCenter(
    parentImageMetadata.value.worldBounds
  );
  return [centerArray[0], centerArray[1], centerArray[2]];
});
const isAnimating = isViewAnimating(view);

watchEffect(() => {
  const img = imageData.value;
  if (!cvrParams.value || !img) return;

  const {
    enabled: cvrEnabled,
    lightFollowsCamera,
    ambient,
    diffuse,
    specular,
    volumetricScatteringBlending,
    volumeQuality,
    useLocalAmbientOcclusion,
    useVolumetricScatteringBlending,
    laoKernelRadius,
    laoKernelSize,
  } = cvrParams.value;
  const { property, mapper } = rep;

  const enabled = cvrEnabled && !isAnimating.value && !isImageStreaming.value;

  setCinematicLighting({
    enabled,
    renderer: view.renderer,
    lightFollowsCamera,
    center: center.value,
  });

  setCinematicVolumeShading({
    enabled,
    image: img,
    ambient,
    diffuse,
    specular,
    property,
    component: 0,
  });

  setCinematicVolumeScatter({
    enabled: enabled && useVolumetricScatteringBlending,
    mapper,
    blending: volumetricScatteringBlending,
  });

  setCinematicVolumeSampling({
    enabled,
    image: img,
    mapper,
    quality: volumeQuality,
  });

  setCinematicLocalAmbientOcclusion({
    enabled: enabled && useLocalAmbientOcclusion,
    kernelRadius: laoKernelRadius,
    kernelSize: laoKernelSize,
    mapper,
  });

  if (isImageStreaming.value) {
    const sampleDistance = mapper.getSampleDistance();
    mapper.setSampleDistance(sampleDistance * 15);
  }

  view.requestRender();
});

const cropStore = useCropStore();
const croppingPlanes = cropStore.getComputedVTKPlanes(parentImageId);
useCroppingEffect(rep.mapper, croppingPlanes);

const visibility = computed(
  () =>
    coloringStore.getConfig(viewId.value, segmentationId.value)?.blendConfig
      ?.visibility ?? true
);

const hasSegmentsToRender = computed(() => segmentsToRender.value.length > 0);

watchEffect(() => {
  const shouldShow = visibility.value && hasSegmentsToRender.value;
  rep.actor.setVisibility(shouldShow);

  if (shouldShow) {
    applySegmentColoring();
  }
});

defineExpose(rep);
</script>

<template>
  <slot></slot>
</template>
