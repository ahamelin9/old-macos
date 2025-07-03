import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Styling
import './styles.css';
const WindowHeader = ({ title, onClose, onMinimize, onMaximize, maximized }) => {
    return (_jsxs("div", { className: "window-header", children: [_jsxs("div", { className: "window-controls", children: [_jsx("button", { className: "window-close", onClick: onClose, "aria-label": "Close window" }), _jsx("button", { className: "window-minimize", onClick: onMinimize, "aria-label": "Minimize window" }), _jsx("button", { className: "window-maximize", onClick: onMaximize, "aria-label": maximized ? "Restore window" : "Maximize window" })] }), _jsx("div", { className: "window-title", children: title })] }));
};
export default WindowHeader;
