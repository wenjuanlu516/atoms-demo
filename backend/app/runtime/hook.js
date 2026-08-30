(() => {
  const makeStore = () => {
    const mem = Object.create(null);
    return {
      getItem: (key) => (Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null),
      setItem: (key, value) => {
        mem[String(key)] = String(value);
      },
      removeItem: (key) => {
        delete mem[key];
      },
      clear: () => {
        for (const key of Object.keys(mem)) delete mem[key];
      },
      key: (index) => Object.keys(mem)[index] || null,
      get length() {
        return Object.keys(mem).length;
      },
    };
  };
  const probe = (name) => {
    try {
      const store = window[name];
      store.setItem("__atoms_probe", "1");
      store.removeItem("__atoms_probe");
    } catch {
      Object.defineProperty(window, name, { configurable: true, value: makeStore() });
    }
  };
  probe("localStorage");
  probe("sessionStorage");

  const post = (type, payload) => {
    window.parent.postMessage({ __atoms: true, type, ...payload }, "*");
  };

  window.addEventListener("load", () => window.scrollTo(0, 0));

  window.addEventListener("error", (event) => {
    const message = String(event.message || "");
    if (message.includes("localStorage") || message.includes("sessionStorage") || message.includes("sandboxed")) {
      return;
    }
    post("runtime_error", {
      message: event.message,
      source: (event.filename || "") + ":" + event.lineno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    post("runtime_error", {
      message: "Unhandled Promise: " + event.reason,
      source: "promise",
    });
  });

  let selectMode = false;
  const style = document.createElement("style");
  style.textContent = "[data-atom-hover='1']{outline:2px solid #6366f1 !important; cursor:pointer;}";
  document.documentElement.appendChild(style);

  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (!data.__atoms) return;
    if (data.type === "select_mode") selectMode = Boolean(data.enabled);
  });

  document.addEventListener(
    "mouseover",
    (event) => {
      if (!selectMode) return;
      const el = event.target;
      if (!(el instanceof HTMLElement)) return;
      el.setAttribute("data-atom-hover", "1");
    },
    true,
  );
  document.addEventListener(
    "mouseout",
    (event) => {
      const el = event.target;
      if (el instanceof HTMLElement) el.removeAttribute("data-atom-hover");
    },
    true,
  );
  document.addEventListener(
    "click",
    (event) => {
      if (!selectMode) return;
      event.preventDefault();
      event.stopPropagation();
      const el = event.target;
      if (!(el instanceof HTMLElement)) return;
      post("element_selected", {
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || "").slice(0, 80),
        className: el.className,
      });
    },
    true,
  );
})();
