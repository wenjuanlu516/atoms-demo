(() => {
  const post = (type, payload) => {
    window.parent.postMessage({ __atoms: true, type, ...payload }, "*");
  };

  window.addEventListener("error", (event) => {
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
