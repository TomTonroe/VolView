import macro from '@kitware/vtk.js/macro';
import vtkAbstractWidgetFactory from '@kitware/vtk.js/Widgets/Core/AbstractWidgetFactory';
import vtkPlanePointManipulator from '@kitware/vtk.js/Widgets/Manipulators/PlaneManipulator';
import vtkSphereHandleRepresentation from '@kitware/vtk.js/Widgets/Representations/SphereHandleRepresentation';

import widgetBehavior from './behavior';
import stateGenerator from './state';

export { InteractionState } from './behavior';

function vtkPointWidget(publicAPI, model) {
  model.classHierarchy.push('vtkPointWidget');

  publicAPI.getRepresentationsForViewType = () => [
    {
      builder: vtkSphereHandleRepresentation,
      labels: ['point'],
      initialValues: {
        scaleInPixels: true,
      },
    },
  ];

  // Default manipulator
  model.manipulator = vtkPlanePointManipulator.newInstance();
}

const DEFAULT_VALUES = {};

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  vtkAbstractWidgetFactory.extend(publicAPI, model, {
    ...initialValues,
    behavior: widgetBehavior,
    widgetState: stateGenerator(initialValues),
  });
  macro.get(publicAPI, model, ['manipulator']);

  vtkPointWidget(publicAPI, model);
}

export const newInstance = macro.newInstance(extend, 'vtkPointWidget');

export default { newInstance, extend };

