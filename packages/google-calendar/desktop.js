// apps/desktop/src/plugins/google-calendar/settings.tsx
import { useEffect as useEffect2, useState as useState2 } from "react";

// apps/desktop/src/renderer/design-system/dialog.tsx
import { useEffect, useId, useRef, useState } from "react";

// apps/desktop/src/renderer/design-system/components.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var paths = {
  puzzle: "M4 8h4a3 3 0 1 1 5 0h7v5a3 3 0 1 0 0 5v3h-7a3 3 0 1 0-5 0H4v-7a3 3 0 1 0 0-5V8Z",
  palette: "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.8h2A4 4 0 0 0 21 11a9 9 0 0 0-9-8ZM7 10h.01M10 6h.01M15 6h.01M17 10h.01",
  "git-branch": "M6 6v12M6 12h7a5 5 0 0 0 5-5V6M8 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 20a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  keyboard: "M3 5h18v14H3zM6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 11h.01M10 11h.01M14 11h.01M18 11h.01M7 15h10",
  archive: "M4 9h16v11H4V9ZM3 4h18v5H3V4ZM9 13h6",
  terminal: "m4 6 6 6-6 6M13 18h7",
  edit: "m14 4 6 6M4 20l5-1L21 7l-4-4L5 15l-1 5Z",
  search: "M10.5 3a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15ZM16 16l5 5",
  server: "M4 3h16v7H4zM4 14h16v7H4zM7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6",
  devices: "M2 4h14v11H2zM6 19h6M9 15v4M19 8h3v13h-7v-3",
  laptop: "M5 4h14v12H5zM2 20h20l-3-4H5l-3 4Z",
  copy: "M8 8h13v13H8zM16 8V3H3v13h5",
  plus: "M12 5v14M5 12h14",
  settings: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z",
  expand: "M9 3H3v6m0-6 6 6M15 3h6v6m0-6-6 6M3 15v6h6m-6 0 6-6M21 15v6h-6m6 0-6-6",
  minimize: "M5 12h14",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  image: "M3 3h18v18H3V3ZM3 16l5-5 4 4 3-3 6 6M9 7h.01",
  screen: "M3 4h18v13H3V4ZM8 21h8M12 17v4",
  window: "M3 4h18v16H3V4ZM3 9h18M6 6.5h.01M9 6.5h.01",
  trash: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  checkpoint: "M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3Zm-4 9 3 3 5-6",
  pin: "M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6ZM12 14v7",
  alert: "M12 3 2 21h20L12 3ZM12 9v5M12 18h.01",
  volume: "M11 4 6 8H3v8h3l5 4V4ZM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16",
  spark: "m12 2 1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8L12 2ZM19 18l.5 1.5L21 20l-1.5.5L19 22l-.5-1.5L17 20l1.5-.5L19 18Z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  connections: "M8 7h8M8 17h8M6 9v6m12-6v6M8 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  group: "M3 7h7l2-3h9v15H3V7ZM7 11h10M7 15h6",
  conversation: "M5 4h14v12H9l-4 4V4Z",
  tasks: "m3 6 2 2 3-4M11 6h10M3 13h5M11 13h10M3 20h5M11 20h10",
  costs: "M4 20h16M6 16v-5M12 16V4M18 16V8",
  close: "m7 7 10 10M17 7 7 17",
  send: "M12 19V5m-6 6 6-6 6 6",
  check: "m5 12 4 4L19 6",
  circle: "M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z",
  chevron: "m7 10 5 5 5-5",
  refresh: "M20 7v5h-5M4 17v-5h5M6.1 6.1a8.3 8.3 0 0 1 13.7 5.1M4.2 12.8a8.3 8.3 0 0 0 13.7 5.1",
  key: "M14 9a5 5 0 1 1 2 4L9 20H5v-4l7-7h2M18 6h.01",
  play: "m8 5 11 7-11 7V5Z",
  stop: "M6 6h12v12H6z",
  model: "m12 3 9 5v8l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v8",
  history: "M3 4v5h5M3.4 9a9 9 0 1 1 0 6M12 7v5l3 2",
  pause: "M8 5v14M16 5v14",
  clock: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  document: "M14 3H6v18h12V7l-4-4ZM14 3v5h4M9 12h6M9 16h6",
  reply: "m9 5-6 6 6 6M3 11h10a7 7 0 0 1 7 7v2"
};
function Icon({ name, className = "" }) {
  return /* @__PURE__ */ jsx("svg", { className: `ui-icon ${className}`, viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: paths[name] }) });
}
function IconButton({ label, icon, variant = "quiet", className = "", type = "button", ...props }) {
  return /* @__PURE__ */ jsx("button", { ...props, type, className: `icon-button ${variant === "primary" ? "icon-button-primary" : ""} ${className}`, "aria-label": label, title: label, children: /* @__PURE__ */ jsx(Icon, { name: icon }) });
}
function TextButton({ icon, children, className = "", type = "button", ...props }) {
  return /* @__PURE__ */ jsxs("button", { ...props, type, className: `text-button ${className}`, onClick: (event) => {
    event.currentTarget.style.setProperty("--pending-width", `${event.currentTarget.offsetWidth}px`);
    props.onClick?.(event);
  }, children: [
    icon && /* @__PURE__ */ jsx(Icon, { name: icon }),
    children
  ] });
}
function InlineNotice({ children, tone = "warning", className = "", ...props }) {
  return /* @__PURE__ */ jsxs("div", { ...props, className: `inline-notice inline-notice-${tone} ${className}`, role: tone === "danger" ? "alert" : "status", children: [
    /* @__PURE__ */ jsx("span", { className: "notice-symbol", "aria-hidden": "true", children: /* @__PURE__ */ jsx(Icon, { name: "alert" }) }),
    /* @__PURE__ */ jsx("div", { className: "notice-body", children })
  ] });
}

// apps/desktop/src/renderer/design-system/dialog.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function Dialog({ title, children, onClose, closeDisabled = false }) {
  const dialog = useRef(null), heading = useId();
  const [closing, setClosing] = useState(false), timer = useRef(void 0);
  const close = useRef(onClose);
  close.current = onClose;
  function requestClose() {
    if (closeDisabled || timer.current || closing) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || dialog.current?.querySelector(".task-thread")) {
      close.current();
      return;
    }
    setClosing(true);
    timer.current = setTimeout(() => close.current(), 110);
  }
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    const unsubscribe = window.ada.onNavigation(() => close.current());
    element.showModal();
    return () => {
      clearTimeout(timer.current);
      unsubscribe();
      element.close();
      if (previous instanceof HTMLElement && previous.isConnected && !previous.closest("[hidden]")) previous.focus();
    };
  }, []);
  return /* @__PURE__ */ jsxs2("dialog", { ref: dialog, className: "app-dialog", "data-closing": closing || void 0, "aria-labelledby": heading, onKeyDown: (event) => {
    if (event.key === "Escape") event.stopPropagation();
  }, onCancel: (event) => {
    event.preventDefault();
    event.stopPropagation();
    requestClose();
  }, children: [
    /* @__PURE__ */ jsxs2("header", { children: [
      /* @__PURE__ */ jsx2("h2", { id: heading, children: title }),
      /* @__PURE__ */ jsx2(IconButton, { icon: "close", label: `Close ${title.toLowerCase()}`, disabled: closing || closeDisabled, onClick: requestClose })
    ] }),
    children
  ] });
}

// apps/desktop/src/renderer/design-system/brands/claude-color.svg
var claude_color_default = 'data:image/svg+xml,<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Claude</title><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="%23D97757" fill-rule="nonzero"></path></svg>';

// apps/desktop/src/renderer/design-system/brands/qwen-color.svg
var qwen_color_default = 'data:image/svg+xml,<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Qwen</title><path d="M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 00.157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 00-.081.05 575.097 575.097 0 01-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 01-.465-.271l-1.335-2.323a.09.09 0 00-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 01-.002-.54l1.207-2.12a.198.198 0 000-.197 550.951 550.951 0 01-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 012.589-.001.124.124 0 00.107-.063l2.806-4.895a.488.488 0 01.422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 00-.052.03L6.254 6.788a.157.157 0 01-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 00-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 01.096 0l1.424 2.53a.122.122 0 00.107.062l2.763-.02a.04.04 0 00.035-.02.041.041 0 000-.04l-2.9-5.086a.108.108 0 010-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 000-.114L9.225 1.774a.06.06 0 00-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 01-.05.029.058.058 0 01-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z" fill="url(%23lobe-icons-qwen-_R_0_)" fill-rule="nonzero"></path><defs><linearGradient id="lobe-icons-qwen-_R_0_" x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stop-color="%236336E7" stop-opacity=".84"></stop><stop offset="100%" stop-color="%236F69F7" stop-opacity=".84"></stop></linearGradient></defs></svg>';

// apps/desktop/src/renderer/design-system/brands/zai.svg
var zai_default = 'data:image/svg+xml,<svg fill="currentColor" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Z.ai</title><path d="M12.105 2L9.927 4.953H.653L2.83 2h9.276zM23.254 19.048L21.078 22h-9.242l2.174-2.952h9.244zM24 2L9.264 22H0L14.736 2H24z"></path></svg>';

// apps/desktop/src/renderer/design-system/brands/deepseek-color.svg
var deepseek_color_default = 'data:image/svg+xml,<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="%234D6BFE"></path></svg>';

// apps/desktop/src/renderer/design-system/brands/antgroup-color.svg
var antgroup_color_default = 'data:image/svg+xml,<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>AntGroup</title><path d="M9.797 6.282a.451.451 0 01-.336-.315 1.019 1.019 0 010-.505c.156-.86.3-1.725.501-2.577.14-.7.42-1.367.823-1.96.305-.431.75-.746 1.262-.89.877-.217 1.24.629.937 1.348-.259.593-.877.914-1.334 1.348-.835.795-1.096 2.14-1.336 3.212a.427.427 0 01-.186.277.437.437 0 01-.331.062z" fill="url(%23lobe-icons-ant-group-0-_R_0_)" transform="translate(3)"></path><path d="M6.334 4.672c.33-.121.682.146.946.297.278.145.587.219.901.214.231.01.466 0 .688.018 4.098.176 7.484 3.22 8.05 7.237.565 4.016-1.852 7.859-5.745 9.134-3.894 1.276-8.153-.38-10.126-3.935A8.339 8.339 0 013.133 7.081c.348-.278.716-.53 1.102-.755a8.404 8.404 0 001.318-.79c.28-.243.45-.742.781-.864zm4.406 2.15c-2.841.003-4.898 2.533-4.628 5.642.27 3.109 2.781 5.641 5.613 5.665 2.832.024 4.932-2.512 4.658-5.644-.273-3.133-2.802-5.666-5.643-5.663zm.357.57a4.707 4.707 0 013.304 1.446 5.703 5.703 0 011.643 3.49 4.841 4.841 0 01-1.141 3.705v.015a3.923 3.923 0 01-2.808 1.303 4.664 4.664 0 01-3.367-1.387 5.678 5.678 0 01-1.71-3.518 4.832 4.832 0 011.14-3.753 3.923 3.923 0 012.813-1.3h.126z" fill="url(%23lobe-icons-ant-group-1-_R_0_)" transform="translate(3)"></path><path d="M2.346 2.054a1.26 1.26 0 01.384-.594.842.842 0 011.165.11c.694.82.169 2.078.142 3.02.013.805.208 1.597.57 2.318.084.134.147.279.186.43a.539.539 0 01-.3.577c-.345.17-.568-.19-.709-.446-.324-.6-.617-1.216-.877-1.846a8.698 8.698 0 01-.618-1.987 7.523 7.523 0 01-.051-.37 3.717 3.717 0 01-.024-.34 2.506 2.506 0 01.132-.872z" fill="url(%23lobe-icons-ant-group-2-_R_0_)" transform="translate(3)"></path><defs><linearGradient id="lobe-icons-ant-group-0-_R_0_" x1="31.373%" x2="61.365%" y1="95.551%" y2="-.348%"><stop offset="0%" stop-color="%2306F"></stop><stop offset="20%" stop-color="%231677FF"></stop><stop offset="100%" stop-color="%2304A6FF"></stop></linearGradient><linearGradient id="lobe-icons-ant-group-1-_R_0_" x1="4.366%" x2="94.359%" y1="65.982%" y2="32.918%"><stop offset="0%" stop-color="%2306F"></stop><stop offset="20%" stop-color="%231677FF"></stop><stop offset="100%" stop-color="%2304A6FF"></stop></linearGradient><linearGradient id="lobe-icons-ant-group-2-_R_0_" x1="56.255%" x2="45.986%" y1="99.257%" y2="1.384%"><stop offset="0%" stop-color="%2306F"></stop><stop offset="20%" stop-color="%231677FF"></stop><stop offset="100%" stop-color="%2304A6FF"></stop></linearGradient></defs></svg>';

// apps/desktop/src/renderer/design-system/brands/xiaomimimo.svg
var xiaomimimo_default = 'data:image/svg+xml,<svg fill="currentColor" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>XiaomiMiMo</title><path d="M.958 15.936a.459.459 0 01.459.44v2.729a.46.46 0 01-.918 0v-2.729a.459.459 0 01.459-.44zm4.814-2.035a.46.46 0 01.553.45v4.754a.458.458 0 11-.918 0V15.48L3.74 17.202a.462.462 0 01-.655.016.462.462 0 01-.065-.082L.628 14.67a.459.459 0 01.658-.637l2.124 2.187 2.127-2.188a.46.46 0 01.235-.13zm2.068.004a.46.46 0 01.458.445v4.755a.46.46 0 01-.458.458.459.459 0 01-.458-.458V14.35a.459.459 0 01.458-.445zm1.973 2.014a.46.46 0 01.46.457v2.729a.46.46 0 01-.784.324.46.46 0 01-.134-.324v-2.729a.46.46 0 01.458-.458zm.002-2.045a.458.458 0 01.328.157l2.127 2.19 2.125-2.19a.459.459 0 01.784.318v4.756a.46.46 0 01-.455.458.46.46 0 01-.458-.458V15.48l-1.667 1.723a.46.46 0 01-.65.008l-.005-.005c0-.002-.002-.002-.004-.003l-2.455-2.534a.46.46 0 01-.008-.667.461.461 0 01.338-.128zm6.797 1.206a.46.46 0 01.53.651A1.966 1.966 0 0019.81 18.4a.462.462 0 01.623.18.46.46 0 01-.181.624 2.863 2.863 0 01-1.38.353l-.142-.004a2.88 2.88 0 01-2.393-4.263.461.461 0 01.274-.21zm.864-.931a2.884 2.884 0 013.915 3.914.46.46 0 01-.402.24l-.057-.004a.458.458 0 01-.164-.055.46.46 0 01-.182-.622 1.967 1.967 0 00-2.669-2.67.459.459 0 11-.441-.803zM9.59 6.368c1.481 0 1.696 1.202 1.696 1.654v2.648h-.917v-.432c-.26.346-.792.535-1.36.535-.133 0-1.289-.03-1.384-1.136-.082-.932.675-1.61 2.053-1.61h.691c0-.563-.367-.886-.983-.886-.44.013-.864.174-1.2.458l-.36-.664c.484-.379 1.012-.567 1.764-.567zm4.427.1c1.263 0 2.082.97 2.083 2.15 0 1.181-.824 2.154-2.083 2.154-1.26 0-2.084-.972-2.084-2.152 0-1.18.82-2.153 2.084-2.153zm6.801.015c.68 0 1.202.465 1.197 1.548v2.642H21.1V8.29c0-.312-.002-.98-.63-.98s-.628.667-.628.838v2.524h-.89V8.148c0-.17-.001-.838-.63-.838-.628 0-.628.668-.628.98v2.383h-.917v-4.03h.917V7a1.22 1.22 0 01.947-.516c.398 0 .76.193.982.686a1.321 1.321 0 011.195-.686zm-18.093.872l1.457-1.772H5.32L3.311 8.07l2.14 2.602H4.24L2.725 8.796 1.21 10.672H0L2.138 8.07.13 5.583h1.138l1.458 1.772zm4.149 3.317h-.916V6.644h.916v4.028zm16.99 0h-.916V6.644h.916v4.028zM9.925 8.71c-1.055 0-1.359.412-1.326.742.032.329.324.537.757.537a1.013 1.013 0 001.014-.968l.002-.31h-.447zM14.018 7.3c-.663 0-1.184.487-1.184 1.32 0 .832.52 1.32 1.184 1.32.662 0 1.182-.49 1.182-1.32 0-.832-.52-1.32-1.182-1.32zM6.417 5.001a.568.568 0 01.587.582.588.588 0 01-1.175 0A.57.57 0 016.417 5zm16.991 0a.57.57 0 01.592.582.588.588 0 01-1.174 0 .57.57 0 01.357-.542.572.572 0 01.225-.04z"></path></svg>';

// apps/desktop/src/renderer/design-system/brands/openrouter.svg
var openrouter_default = 'data:image/svg+xml,<svg fill="currentColor" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>OpenRouter</title><path d="M18.654 3.87a5.087 5.087 0 110 10.174L23.7 19.09c.64.641.187 1.737-.72 1.737H8.48a8.479 8.479 0 010-16.958h10.175zM8.479 7.26a5.087 5.087 0 100 10.176 5.087 5.087 0 000-10.175z"></path></svg>';

// apps/desktop/src/renderer/design-system/brands/meta-color.svg
var meta_color_default = 'data:image/svg+xml,<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Meta</title><path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(%23lobe-icons-meta-0-_R_0_)"></path><path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(%23lobe-icons-meta-1-_R_0_)"></path><path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(%23lobe-icons-meta-2-_R_0_)"></path><path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(%23lobe-icons-meta-3-_R_0_)"></path><path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(%23lobe-icons-meta-4-_R_0_)"></path><path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(%23lobe-icons-meta-5-_R_0_)"></path><path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="%230082FB"></path><path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(%23lobe-icons-meta-6-_R_0_)"></path><path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="%230082FB"></path><path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(%23lobe-icons-meta-7-_R_0_)"></path><path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(%23lobe-icons-meta-8-_R_0_)"></path><path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(%23lobe-icons-meta-9-_R_0_)"></path><path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(%23lobe-icons-meta-10-_R_0_)"></path><path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(%23lobe-icons-meta-11-_R_0_)"></path><path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(%23lobe-icons-meta-12-_R_0_)"></path><defs><linearGradient id="lobe-icons-meta-0-_R_0_" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stop-color="%230867DF"></stop><stop offset="45.39%" stop-color="%230668E1"></stop><stop offset="85.91%" stop-color="%230064E0"></stop></linearGradient><linearGradient id="lobe-icons-meta-1-_R_0_" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stop-color="%230064DF"></stop><stop offset="99.88%" stop-color="%230064E0"></stop></linearGradient><linearGradient id="lobe-icons-meta-2-_R_0_" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stop-color="%230072EC"></stop><stop offset="68.81%" stop-color="%230064DF"></stop></linearGradient><linearGradient id="lobe-icons-meta-3-_R_0_" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stop-color="%23007CF6"></stop><stop offset="99.43%" stop-color="%230072EC"></stop></linearGradient><linearGradient id="lobe-icons-meta-4-_R_0_" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stop-color="%23007FF9"></stop><stop offset="100%" stop-color="%23007CF6"></stop></linearGradient><linearGradient id="lobe-icons-meta-5-_R_0_" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stop-color="%23007FF9"></stop><stop offset="100%" stop-color="%230082FB"></stop></linearGradient><linearGradient id="lobe-icons-meta-6-_R_0_" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stop-color="%23007FF8"></stop><stop offset="91.41%" stop-color="%230082FB"></stop></linearGradient><linearGradient id="lobe-icons-meta-7-_R_0_" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stop-color="%230082FB"></stop><stop offset="99.95%" stop-color="%230081FA"></stop></linearGradient><linearGradient id="lobe-icons-meta-8-_R_0_" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stop-color="%230081FA"></stop><stop offset="100%" stop-color="%230080F9"></stop></linearGradient><linearGradient id="lobe-icons-meta-9-_R_0_" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stop-color="%23027AF3"></stop><stop offset="100%" stop-color="%230080F9"></stop></linearGradient><linearGradient id="lobe-icons-meta-10-_R_0_" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stop-color="%230377EF"></stop><stop offset="99.94%" stop-color="%230279F1"></stop></linearGradient><linearGradient id="lobe-icons-meta-11-_R_0_" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stop-color="%230471E9"></stop><stop offset="100%" stop-color="%230377EF"></stop></linearGradient><linearGradient id="lobe-icons-meta-12-_R_0_" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stop-color="%230867DF"></stop><stop offset="100%" stop-color="%230471E9"></stop></linearGradient></defs></svg>';

// apps/desktop/src/renderer/design-system/brands/opencode.svg
var opencode_default = 'data:image/svg+xml,<svg fill="currentColor" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>opencode</title><path d="M16 6H8v12h8V6zm4 16H4V2h16v20z"></path></svg>';

// apps/desktop/src/renderer/design-system/brands/openai.svg
var openai_default = 'data:image/svg+xml,<svg fill="currentColor" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>OpenAI</title><path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"></path></svg>';

// apps/desktop/src/renderer/design-system/brands/nvidia-color.svg
var nvidia_color_default = 'data:image/svg+xml,<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Nvidia</title><path d="M10.212 8.976V7.62c.127-.01.256-.017.388-.021 3.596-.117 5.957 3.184 5.957 3.184s-2.548 3.647-5.282 3.647a3.227 3.227 0 01-1.063-.175v-4.109c1.4.174 1.681.812 2.523 2.258l1.873-1.627a4.905 4.905 0 00-3.67-1.846 6.594 6.594 0 00-.729.044m0-4.476v2.025c.13-.01.259-.019.388-.024 5.002-.174 8.261 4.226 8.261 4.226s-3.743 4.69-7.643 4.69c-.338 0-.675-.031-1.007-.092v1.25c.278.038.558.057.838.057 3.629 0 6.253-1.91 8.794-4.169.421.347 2.146 1.193 2.501 1.564-2.416 2.083-8.048 3.763-11.24 3.763-.308 0-.603-.02-.894-.048V19.5H24v-15H10.21zm0 9.756v1.068c-3.356-.616-4.287-4.21-4.287-4.21a7.173 7.173 0 014.287-2.138v1.172h-.005a3.182 3.182 0 00-2.502 1.178s.615 2.276 2.507 2.931m-5.961-3.3c1.436-1.935 3.604-3.148 5.961-3.336V6.523C5.81 6.887 2 10.723 2 10.723s2.158 6.427 8.21 7.015v-1.166C5.77 16 4.25 10.958 4.25 10.958h-.002z" fill="%2374B71B" fill-rule="nonzero"></path></svg>';

// apps/desktop/src/renderer/design-system/brands/google-color.svg
var google_color_default = 'data:image/svg+xml,<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Google</title><path d="M23 12.245c0-.905-.075-1.565-.236-2.25h-10.54v4.083h6.186c-.124 1.014-.797 2.542-2.294 3.569l-.021.136 3.332 2.53.23.022C21.779 18.417 23 15.593 23 12.245z" fill="%234285F4"></path><path d="M12.225 23c3.03 0 5.574-.978 7.433-2.665l-3.542-2.688c-.948.648-2.22 1.1-3.891 1.1a6.745 6.745 0 01-6.386-4.572l-.132.011-3.465 2.628-.045.124C4.043 20.531 7.835 23 12.225 23z" fill="%2334A853"></path><path d="M5.84 14.175A6.65 6.65 0 015.463 12c0-.758.138-1.491.361-2.175l-.006-.147-3.508-2.67-.115.054A10.831 10.831 0 001 12c0 1.772.436 3.447 1.197 4.938l3.642-2.763z" fill="%23FBBC05"></path><path d="M12.225 5.253c2.108 0 3.529.892 4.34 1.638l3.167-3.031C17.787 2.088 15.255 1 12.225 1 7.834 1 4.043 3.469 2.197 7.062l3.63 2.763a6.77 6.77 0 016.398-4.572z" fill="%23EB4335"></path></svg>';

// apps/desktop/src/renderer/design-system/brands/discord.svg
var discord_default = 'data:image/svg+xml,<svg fill="%235865F2" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Discord</title><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>';

// apps/desktop/src/renderer/design-system/brand-icon.tsx
import { jsx as jsx3 } from "react/jsx-runtime";
var brands = {
  google: { image: google_color_default, label: "Google", monochrome: false },
  discord: { image: discord_default, label: "Discord", monochrome: false },
  anthropic: { image: claude_color_default, label: "Claude", monochrome: false },
  qwen: { image: qwen_color_default, label: "Qwen", monochrome: false },
  "z-ai": { image: zai_default, label: "Z.ai", monochrome: true },
  deepseek: { image: deepseek_color_default, label: "DeepSeek", monochrome: false },
  inclusionai: { image: antgroup_color_default, label: "inclusionAI / Ant Group", monochrome: false },
  xiaomi: { image: xiaomimimo_default, label: "Xiaomi MiMo", monochrome: true },
  openrouter: { image: openrouter_default, label: "OpenRouter", monochrome: true },
  meta: { image: meta_color_default, label: "Meta", monochrome: false },
  opencode: { image: opencode_default, label: "OpenCode Zen", monochrome: true },
  openai: { image: openai_default, label: "OpenAI", monochrome: true },
  nvidia: { image: nvidia_color_default, label: "NVIDIA", monochrome: false }
};
function knownBrand(value) {
  return Object.hasOwn(brands, value);
}
function BrandIcon({ brand, compact = false }) {
  const mark = knownBrand(brand) ? brands[brand] : void 0;
  return /* @__PURE__ */ jsx3("span", { className: `brand-icon ${compact ? "brand-icon-compact" : ""}`, title: mark?.label ?? "Model", "aria-hidden": "true", children: mark ? /* @__PURE__ */ jsx3("img", { className: mark.monochrome ? "brand-monochrome" : void 0, src: mark.image, alt: "", draggable: false }) : /* @__PURE__ */ jsx3(Icon, { name: "model" }) });
}

// apps/desktop/src/plugins/google-calendar/settings.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function GoogleCalendarSettings({ connection }) {
  const [state2, setState] = useState2(), [clientId, setId] = useState2(""), [clientSecret, setSecret] = useState2(""), [setup, setSetup] = useState2(false), [busy, setBusy] = useState2(false), [checking, setChecking] = useState2(false), [error, setError] = useState2("");
  useEffect2(() => {
    let alive = true;
    const refresh = () => {
      void connection().then((value) => {
        if (alive) setState(value);
      }).catch(() => {
        if (alive) setError("Calendar settings are unavailable.");
      });
    };
    refresh();
    const timer = setInterval(refresh, 2e3);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [connection]);
  async function act(input) {
    setBusy(true);
    setChecking(input?.action === "check");
    setError("");
    try {
      setState(await connection(input));
      setSecret("");
      setId("");
      if (input?.action === "configure") setSetup(false);
    } catch {
      setError("Calendar connection failed. Check the Google configuration and try again.");
    } finally {
      setBusy(false);
      setChecking(false);
    }
  }
  return /* @__PURE__ */ jsxs3("section", { className: "provider-connection calendar-settings", "aria-label": "Google Calendar connection", children: [
    /* @__PURE__ */ jsxs3("div", { className: "provider-heading", children: [
      /* @__PURE__ */ jsxs3("h4", { className: "settings-section-title", children: [
        /* @__PURE__ */ jsx4(BrandIcon, { brand: "google", compact: true }),
        "Google Calendar and Tasks"
      ] }),
      /* @__PURE__ */ jsx4("span", { role: "status", children: checking ? "Checking access" : state2?.authorizing ? "Waiting for Google" : state2?.connected ? state2.access === "blocked" ? "Read access blocked" : state2.access === "ready" ? state2.tasks && state2.tasks.access !== "ready" ? "Calendar connected" : "Connected" : "Signed in, access not checked" : state2 ? "Not connected" : error ? "Unavailable" : "Loading" })
    ] }),
    /* @__PURE__ */ jsx4("p", { className: "setting-detail", children: "Find events and to-dos. Allow changes to schedule events, edit tasks and mark them complete when you ask." }),
    state2?.connected && state2.tasks && /* @__PURE__ */ jsxs3("div", { className: "calendar-services", children: [
      /* @__PURE__ */ jsxs3("div", { children: [
        /* @__PURE__ */ jsx4("span", { children: "Calendar events" }),
        /* @__PURE__ */ jsx4("span", { children: state2.access === "ready" ? state2.permissions?.calendar === "read-write" ? "Read and write" : "Read-only" : state2.access === "blocked" ? "Blocked" : "Not checked" })
      ] }),
      /* @__PURE__ */ jsxs3("div", { children: [
        /* @__PURE__ */ jsx4("span", { children: "Google Tasks" }),
        /* @__PURE__ */ jsx4("span", { children: state2.tasks.access === "ready" ? state2.permissions?.tasks === "read-write" ? "Read and write" : "Read-only" : state2.tasks.access === "permission-needed" ? "Reconnect to grant access" : state2.tasks.access === "blocked" ? "Blocked" : "Not checked" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs3("div", { className: "calendar-actions", children: [
      state2?.connected && /* @__PURE__ */ jsx4(TextButton, { disabled: busy || state2.authorizing, onClick: () => void act({ action: "check" }), children: "Check access" }),
      /* @__PURE__ */ jsx4(TextButton, { onClick: () => setSetup(true), children: state2?.configured ? "Edit Google configuration" : "Set up Google connection" }),
      /* @__PURE__ */ jsx4(TextButton, { disabled: busy || !state2?.configured || state2.authorizing, onClick: () => void act({ action: "authorize", access: state2?.permissions?.calendar === "read-write" || state2?.permissions?.tasks === "read-write" ? "read-write" : "read-only" }), children: state2?.connected ? "Reconnect with Google" : "Connect with Google" }),
      state2?.configured && /* @__PURE__ */ jsx4(TextButton, { icon: "edit", disabled: busy || state2.authorizing, onClick: () => void act({ action: "authorize", access: state2.permissions?.calendar === "read-write" && state2.permissions?.tasks === "read-write" ? "read-only" : "read-write" }), children: state2.permissions?.calendar === "read-write" && state2.permissions?.tasks === "read-write" ? "Use read-only access" : "Allow changes" }),
      state2?.configured && /* @__PURE__ */ jsx4(TextButton, { disabled: busy, onClick: () => void act({ action: "disconnect" }), children: "Disconnect" })
    ] }),
    setup && /* @__PURE__ */ jsx4(Dialog, { title: "Google Calendar and Tasks setup", onClose: () => setSetup(false), children: /* @__PURE__ */ jsxs3("div", { className: "calendar-settings", children: [
      /* @__PURE__ */ jsx4("p", { className: "setting-detail", children: "Create a Desktop app OAuth client in Google Cloud, then enter its credentials below. Enable both APIs in that same project. Add your account as a test user if the app is in testing, and sign in on the Ada server PC." }),
      /* @__PURE__ */ jsxs3("div", { className: "calendar-actions", children: [
        /* @__PURE__ */ jsx4(TextButton, { onClick: () => void window.ada.openExternalLink(state2?.apiSetup?.calendar ?? "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"), children: "Enable Calendar API" }),
        /* @__PURE__ */ jsx4(TextButton, { onClick: () => void window.ada.openExternalLink(state2?.apiSetup?.tasks ?? "https://console.cloud.google.com/apis/library/tasks.googleapis.com"), children: "Enable Tasks API" })
      ] }),
      /* @__PURE__ */ jsx4("p", { className: "setting-detail", children: "These buttons open Google Cloud. Choose Enable there, then return and check access." }),
      /* @__PURE__ */ jsxs3("form", { className: "provider-connect", onSubmit: (event) => {
        event.preventDefault();
        void act({ action: "configure", clientId, clientSecret });
      }, children: [
        /* @__PURE__ */ jsx4("label", { htmlFor: "calendar-client-id", children: "Google client ID" }),
        /* @__PURE__ */ jsx4("input", { id: "calendar-client-id", autoComplete: "off", value: clientId, onChange: (event) => setId(event.target.value), disabled: busy }),
        /* @__PURE__ */ jsx4("label", { htmlFor: "calendar-client-secret", children: "Google client secret" }),
        /* @__PURE__ */ jsx4("input", { id: "calendar-client-secret", type: "password", autoComplete: "off", value: clientSecret, onChange: (event) => setSecret(event.target.value), disabled: busy }),
        /* @__PURE__ */ jsx4(TextButton, { type: "submit", disabled: busy || !clientId || !clientSecret, children: "Save OAuth client" })
      ] }),
      /* @__PURE__ */ jsx4("p", { className: "setting-detail", children: "Credentials stay encrypted for your Windows account on the server. Requested events and tasks can enter task history and model context. Google testing grants may expire after seven days." }),
      error && /* @__PURE__ */ jsx4(InlineNotice, { tone: "warning", children: error })
    ] }) }),
    !setup && (error || state2?.error) && /* @__PURE__ */ jsx4(InlineNotice, { tone: "warning", children: error || state2?.error }),
    !setup && state2?.setupUrl && /* @__PURE__ */ jsx4(TextButton, { onClick: () => void window.ada.openExternalLink(state2.setupUrl), children: "Enable Calendar API" }),
    !setup && state2?.tasks?.error && /* @__PURE__ */ jsx4(InlineNotice, { tone: "warning", children: state2.tasks.error }),
    !setup && state2?.tasks?.setupUrl && /* @__PURE__ */ jsx4(TextButton, { onClick: () => void window.ada.openExternalLink(state2.tasks.setupUrl), children: "Enable Tasks API" })
  ] });
}

// apps/desktop/src/plugins/google-calendar/index.tsx
import { useCallback } from "react";
import { jsx as jsx5 } from "react/jsx-runtime";
function state(value) {
  if (!value || typeof value !== "object" || typeof value.configured !== "boolean" || typeof value.connected !== "boolean" || typeof value.authorizing !== "boolean") throw new Error("Google connection state is unavailable.");
  return value;
}
function GoogleConnection({ action }) {
  const connection = useCallback(async (input) => {
    if (input) {
      const { action: id, ...args } = input;
      const result = await action(id, args);
      if (id !== "authorize") return state(result);
    }
    const value = state(await action("state", {}));
    return value.authorizationPending ? state(await action("complete", {})) : value;
  }, [action]);
  return /* @__PURE__ */ jsx5(GoogleCalendarSettings, { connection });
}
export {
  GoogleConnection as default
};
