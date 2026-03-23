export { };

declare global {
  interface Array<T> {
    removeElement: (element: T) => boolean;
    removeElementFastDesort: (element: T) => boolean;
  }
}

export const addExtensionsForArray = () => {
  addRemove();
}

const addRemove = () => {
  if (!Array.prototype.removeElement) {
    Object.defineProperty(Array.prototype, 'removeElement', {
      value: function <T>(this: T[], element: T): boolean {
        const index = this.indexOf(element);
        if (index !== -1) {
          this.splice(index, 1);
          return true;
        }
        return false;
      },
      enumerable: false,
    });
  }

  if (!Array.prototype.removeElementFastDesort) {
    Object.defineProperty(Array.prototype, 'removeElementFastDesort', {
      value: function <T>(this: T[], element: T): boolean {
        const index = this.indexOf(element);
        if (index !== -1) {
          this[index] = this[this.length - 1];
          this.pop();
          return true;
        }
        return false;
      },
      enumerable: false,
    });
  }
}