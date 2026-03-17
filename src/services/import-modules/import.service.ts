export class ImportService<T> {
  public path: string;
  constructor(path: string) {
    this.path = path;
  }

  public import = () => {
    return import(this.path) as T;
  }
}