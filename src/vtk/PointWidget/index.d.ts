export type vtkPointWidget = import('@kitware/vtk.js/Widgets/Core/AbstractWidgetFactory').default & {
  setInteractionState: (state: any) => void;
  resetInteractions: () => void;
};

export type vtkPointViewWidget = vtkPointWidget & {
  getWidgetState: () => any;
  setManipulator: (m: any) => void;
  setHandleVisibility: (v: boolean) => void;
};

declare const _default: {
  newInstance: (opts?: any) => vtkPointWidget;
  extend: (a: any, b: any, c?: any) => void;
};

export default _default;
export enum InteractionState {
  Placing = 'Placing',
  Select = 'Select',
  Dragging = 'Dragging',
}
