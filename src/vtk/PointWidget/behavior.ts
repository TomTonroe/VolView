import macro from '@kitware/vtk.js/macro';
import type { Vector3 } from '@kitware/vtk.js/types';
import { computeWorldCoords } from '@/src/vtk/ToolWidgetUtils/utils';

export enum InteractionState {
  Placing = 'Placing',
  Select = 'Select',
  Dragging = 'Dragging',
}

export function shouldIgnoreEvent(e: any) {
  return e.altKey || e.controlKey || e.shiftKey;
}

export default function widgetBehavior(publicAPI: any, model: any) {
  model.classHierarchy.push('vtkPointWidgetProp');

  model.interactionState = InteractionState.Select;
  let draggingState: any = null;

  macro.setGet(publicAPI, model, ['interactionState']);
  macro.setGet(publicAPI, model, ['manipulator']);
  macro.event(publicAPI, model, 'RightClickEvent');
  macro.event(publicAPI, model, 'PlacedEvent');
  macro.event(publicAPI, model, 'HoverEvent');

  publicAPI.deactivateAllHandles = () => {
    model.widgetState.deactivate();
    model.activeState = null;
  };

  publicAPI.setPoint = (coord: Vector3) => {
    const point = model.widgetState.getPoint();
    point.setOrigin(coord);
  };

  const originalSetInteractionState = publicAPI.setInteractionState;
  publicAPI.setInteractionState = (state: InteractionState) => {
    const changed = originalSetInteractionState(state);
    if (changed && state === InteractionState.Placing) {
      model.widgetState.setIsPlaced(false);
      model.widgetState.getPoint().setVisible(false);
    }
    return changed;
  };

  publicAPI.resetInteractions = () => {
    model._interactor.cancelAnimation(publicAPI, true);
  };

  const getWorldCoords = computeWorldCoords(model);

  publicAPI.handleLeftButtonPress = (eventData: any) => {
    if (!model.manipulator || shouldIgnoreEvent(eventData)) {
      return macro.VOID;
    }

    publicAPI.invokeHoverEvent({ ...eventData, hovering: false });

    const activeWidget = model._widgetManager.getActiveWidget();
    if (activeWidget && activeWidget !== publicAPI) {
      return macro.VOID;
    }

    const worldCoords = getWorldCoords(eventData);
    if (!worldCoords?.length) return macro.VOID;

    const intState = publicAPI.getInteractionState();

    if (intState === InteractionState.Placing) {
      publicAPI.setPoint(worldCoords);
      model.widgetState.getPoint().setVisible(true);
      model.widgetState.setIsPlaced(true);
      publicAPI.setInteractionState(InteractionState.Select);
      publicAPI.invokePlacedEvent();
      return macro.EVENT_ABORT;
    }

    // drag
    if (model.activeState?.getActive() && model.pickable) {
      draggingState = model.activeState;
      publicAPI.setInteractionState(InteractionState.Dragging);
      model._apiSpecificRenderWindow.setCursor('grabbing');
      model._interactor.requestAnimation(publicAPI);
      publicAPI.invokeStartInteractionEvent();
      return macro.EVENT_ABORT;
    }

    return macro.VOID;
  };

  publicAPI.handleMouseMove = (eventData: any) => {
    const worldCoords = getWorldCoords(eventData);
    if (!worldCoords?.length) return macro.VOID;

    if (publicAPI.getInteractionState() === InteractionState.Dragging && draggingState) {
      draggingState.setOrigin(worldCoords);
      publicAPI.invokeInteractionEvent();
      return macro.EVENT_ABORT;
    }

    publicAPI.invokeHoverEvent({ ...eventData, hovering: !!model.activeState });
    return macro.VOID;
  };

  publicAPI.handleLeftButtonRelease = (eventData: any) => {
    if (draggingState) {
      const worldCoords = getWorldCoords(eventData);
      if (worldCoords?.length) draggingState.setOrigin(worldCoords);
      draggingState = null;
      publicAPI.setInteractionState(InteractionState.Select);
      model._apiSpecificRenderWindow.setCursor('pointer');
      model.widgetState.deactivate();
      model._interactor.cancelAnimation(publicAPI);
      publicAPI.invokeEndInteractionEvent();
      model._widgetManager.enablePicking();
    }
  };

  publicAPI.handleRightButtonPress = (eventData: any) => {
    if (shouldIgnoreEvent(eventData) || publicAPI.getInteractionState() !== InteractionState.Select || !model.activeState) {
      return macro.VOID;
    }
    publicAPI.invokeRightClickEvent(eventData);
    return macro.EVENT_ABORT;
  };

  publicAPI.grabFocus = () => {
    throw new Error('grabFocus is not implemented');
  };
  publicAPI.loseFocus = () => {
    throw new Error('loseFocus is not implemented');
  };

  publicAPI.delete = macro.chain(() => {
    publicAPI.resetInteractions();
  }, publicAPI.delete);
}

