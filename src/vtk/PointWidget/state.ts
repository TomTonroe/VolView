import macro from '@kitware/vtk.js/macros';
import vtkAnnotationWidgetState from '@/src/vtk/ToolWidgetUtils/annotationWidgetState';
import { AnnotationToolType } from '@/src/store/tools/types';
import createPointState from '../ToolWidgetUtils/pointState';

function vtkPointWidgetState(publicAPI: any, model: any) {
  const position = createPointState({
    id: model.id,
    store: publicAPI.getStore(),
    key: 'position',
    visible: true,
  });

  model.labels = {
    point: [position],
  };

  publicAPI.getPoint = () => position;
}

const defaultValues = (initialValues: any) => ({
  toolType: AnnotationToolType.Point,
  isPlaced: false,
  ...initialValues,
});

function _createPointWidgetState(publicAPI: any, model: any, initialValues: any) {
  Object.assign(model, defaultValues(initialValues));
  vtkAnnotationWidgetState.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, ['isPlaced']);

  vtkPointWidgetState(publicAPI, model);
}

const createPointWidgetState = macro.newInstance(
  _createPointWidgetState,
  'vtkPointWidgetState'
);

export default createPointWidgetState;

