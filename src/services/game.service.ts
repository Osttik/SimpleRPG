import { createAdapter } from '@most/adapter';
import { multicast } from '@most/core';
import { newDefaultScheduler } from '@most/scheduler';
import { type Stream, type Disposable } from '@most/types'; 

class GameService {
  private readonly adapter = createAdapter<void>();
  public readonly onConnected$: Stream<void>;
  private scheduler = newDefaultScheduler();
  private subs: Disposable[] = [];

  constructor() {
    this.onConnected$ = multicast(this.adapter[1]);
  }

  public connect() {
    this.adapter[0](undefined); 
  }

  public subscribeToConnection(callback: () => void): Disposable {
    const sub = this.onConnected$.run({
      event: () => callback(),
      error: (_, err) => console.error(err),
      end: () => {}
    }, this.scheduler);

    this.subs.push(sub);
    return sub;
  }

  public disposeAll() {
    this.subs.forEach(s => s.dispose());
    this.subs = [];
  }
}

export const gameService = new GameService();