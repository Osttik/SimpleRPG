declare module '*.glsl?raw' {
  const content: string;
  export default content;
}

declare module '*.node' {
  const value: any;
  export default value;
}