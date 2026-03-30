declare module '*.glsl?raw' {
  const content: string;
  export default content;
}

declare module '*.node' {
  const value: any;
  export default value;
}

declare module '*/gamecore_wasm.js' {
  const ModuleFactory: (config?: any) => Promise<any>;
  export default ModuleFactory;
}