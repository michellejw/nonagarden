import "@testing-library/jest-dom/vitest";

// jsdom v25+ requires explicit localStorage setup; patch it if it doesn't have clear()
if (typeof window !== "undefined") {
  if (!window.localStorage || typeof window.localStorage.clear !== "function") {
    const store: Record<string, string> = {};

    const storage: Storage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach(key => delete store[key]);
      },
      key: (index: number) => Object.keys(store)[index] || null,
      get length() {
        return Object.keys(store).length;
      },
    };

    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: false,
      configurable: true,
    });
  }
}

// jsdom lacks PointerEvent; Testing Library's pointer helpers need it.
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  // @ts-expect-error assigning polyfill
  window.PointerEvent = PointerEventPolyfill;
}
