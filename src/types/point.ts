import type { Vector3 } from '@kitware/vtk.js/types';
import { AnnotationTool } from './annotation-tool';

export type Point = {
  /**
   * Position in world coordinates.
   */
  position: Vector3;
} & AnnotationTool;

