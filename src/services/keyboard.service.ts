import type { KeyEnumValue, MouseKeyEnumValue } from '@/defines/key.enum';
import { gameState } from '@/modules/game_module/game_state';
import { createAdapter } from '@most/adapter';
import { filter } from '@most/core';
import { newDefaultScheduler } from '@most/scheduler';
import { type Disposable } from '@most/types';
import { KeyboardEvent, MouseEvent } from 'react';

type SinkArray<T> = ((event: T) => void)[];
type TEvent = Record<string, string | undefined>;

type KeyboardServiceEvent = Omit<KeyboardEvent, 'key'> & {
  key: KeyEnumValue;
}

type MouseServiceEvent = Omit<MouseEvent, 'button'> & {
  button: MouseKeyEnumValue;
}

const getKey = (event: TEvent) => {
  if (event.button != null) return event.button;
  if (event.key != null) return event.key;

  return "";
}

class KeyboardService {
  private _scheduler = newDefaultScheduler();
  private _sinksKeyDown: SinkArray<KeyboardServiceEvent> = [];
  private _sinksKeyUp: SinkArray<KeyboardServiceEvent> = [];
  private _sinksMouseDown: SinkArray<MouseEvent> = [];
  private _sinksMouseUp: SinkArray<MouseEvent> = [];

  constructor() {    
    window.addEventListener('keydown', e => this.handleOnKeyDown(e as unknown as KeyboardServiceEvent));
    window.addEventListener('keyup', e => this.handleOnKeyUp(e as unknown as KeyboardServiceEvent));
    window.addEventListener('mousedown', e => this.handleOnMouseDown(e as unknown as MouseServiceEvent));
    window.addEventListener('mouseup', e => this.handleOnMouseUp(e as unknown as MouseServiceEvent));
    window.addEventListener('mousemove', e => this.handleOnMouseMove(e as unknown as MouseEvent));
  }

  private handleOnMouseDown = (e: MouseServiceEvent) => {
    this._sinksMouseDown.forEach(sink => sink(e));
  };

  private handleOnMouseUp = (e: MouseServiceEvent) => {
    this._sinksMouseUp.forEach(sink => sink(e));
  };
  
  private handleOnMouseMove = (e: MouseEvent) => {
    gameState.mousePosition = { x: e.clientX, y: e.clientY };
  };

  private handleOnKeyDown = (e: KeyboardServiceEvent) => {
    this._sinksKeyDown.forEach(sink => sink(e));
  };

  private handleOnKeyUp = (e: KeyboardServiceEvent) => {
    this._sinksKeyUp.forEach(sink => sink(e));
  };

  private _subscribeToKey = <T>(array: SinkArray<T>, targetKey: KeyEnumValue | KeyEnumValue[], callback: (e: T) => void): Disposable => {
    const [sink, stream] = createAdapter<T>();
    if (!Array.isArray(targetKey)) {
      targetKey = [targetKey];
    }
    array.push(sink);

    const keyStream = filter((e) => targetKey.includes(getKey(e as TEvent)), stream);

    const runningStream = keyStream.run({
      event: (_, e) => callback(e),
      error: (_, err) => console.error(err),
      end: () => {}
    }, this._scheduler);

    return {
      dispose: () => {
        runningStream.dispose();
        array.removeElementFastDesort(sink);
      }
    };
  }

  public subscribeToKeyDown = (targetKey: KeyEnumValue | KeyEnumValue[], callback: (e: KeyboardServiceEvent) => void) => this._subscribeToKey(this._sinksKeyDown, targetKey, callback);
  public subscribeToKeyUp = (targetKey: KeyEnumValue | KeyEnumValue[], callback: (e: KeyboardServiceEvent) => void) => this._subscribeToKey(this._sinksKeyUp, targetKey, callback);
  public subscribeToKey = (targetKey: KeyEnumValue | KeyEnumValue[], callbackOnDown: (e: KeyboardServiceEvent) => void, callbackOnUp: (e: KeyboardServiceEvent) => void) => {
    return [this.subscribeToKeyUp(targetKey, callbackOnUp), this.subscribeToKeyDown(targetKey, callbackOnDown)];
  }

  public subscribeToMouseDown = (targetKey: MouseKeyEnumValue | MouseKeyEnumValue[], callback: (e: MouseServiceEvent) => void) => this._subscribeToKey(this._sinksMouseDown, targetKey, callback);
  public subscribeToMouseUp = (targetKey: MouseKeyEnumValue | MouseKeyEnumValue[], callback: (e: MouseServiceEvent) => void) => this._subscribeToKey(this._sinksMouseUp, targetKey, callback);
  public subscribeToMouse = (targetKey: MouseKeyEnumValue | MouseKeyEnumValue[], callbackOnDown: (e: MouseServiceEvent) => void, callbackOnUp: (e: MouseServiceEvent) => void) => {
    return [this.subscribeToMouseUp(targetKey, callbackOnUp), this.subscribeToMouseDown(targetKey, callbackOnDown)];
  }
}

export const keyboardService = new KeyboardService();