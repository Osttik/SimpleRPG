import {
  createSlice,
  type PayloadAction,
  type SliceCaseReducers,
  type CreateSliceOptions,
} from "@reduxjs/toolkit";

type AutoSetter<State, K extends keyof State> = {
  [P in `set_${K & string}`]: (
    state: State,
    action: PayloadAction<State[K]>
  ) => void;
};

export class SliceBuilder<
  Name extends string,
  State extends Record<string, any> = {},
  Reducers extends SliceCaseReducers<State> = {}
> {
  public name: Name;

  private _initialState: Partial<State> = {};
  private _reducers: any = {};

  constructor(name: Name) {
    this.name = name;
  }

  public addParameter<
    K extends string,
    V,
    CustomReducers extends SliceCaseReducers<State & Record<K, V>> = {}
  >(
    name: K,
    initialValue: V,
    reducers?: CustomReducers
  ): SliceBuilder<
    Name,
    State & Record<K, V>,
    Reducers & AutoSetter<State & Record<K, V>, K> & CustomReducers
  > {
    const builder = this as unknown as SliceBuilder<
      Name,
      State & Record<K, V>,
      Reducers & AutoSetter<State & Record<K, V>, K> & CustomReducers
    >;

    builder._initialState[name as keyof State] = initialValue as any;

    const setterName = `set_${name}`;
    builder._reducers[setterName] = (state: any, action: PayloadAction<V>) => {
      state[name] = action.payload;
    };

    if (reducers) {
      Object.assign(builder._reducers, reducers);
    }

    return builder;
  }

  public build() {
    const options = {
      name: this.name,
      initialState: this._initialState as State,
      reducers: this._reducers,
    } as unknown as CreateSliceOptions<State, Reducers, Name>;

    return createSlice(options);
  }
}