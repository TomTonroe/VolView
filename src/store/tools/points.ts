import { defineAnnotationToolStore } from '@/src/utils/defineAnnotationToolStore';
import type { Vector3 } from '@kitware/vtk.js/types';
import { Manifest, StateFile } from '@/src/io/state-file/schema';
import { POINT_LABEL_DEFAULTS } from '@/src/config';
import { ToolID } from '@/src/types/annotation-tool';

import { useAnnotationTool } from './useAnnotationTool';

const pointDefaults = () => ({
  position: [0, 0, 0] as Vector3,
  id: '' as ToolID,
  name: 'Point',
});

export const usePointStore = defineAnnotationToolStore('points', () => {
  const toolAPI = useAnnotationTool({
    toolDefaults: pointDefaults,
    initialLabels: POINT_LABEL_DEFAULTS,
  });

  function getPoints(id: ToolID) {
    const tool = toolAPI.toolByID.value[id];
    return [tool.position];
  }

  // --- serialization --- //

  function serialize(state: StateFile) {
    state.manifest.tools.points = toolAPI.serializeTools();
  }

  function deserialize(manifest: Manifest, dataIDMap: Record<string, string>) {
    toolAPI.deserializeTools(manifest.tools.points, dataIDMap);
  }

  return {
    ...toolAPI,
    getPoints,
    serialize,
    deserialize,
  };
});
