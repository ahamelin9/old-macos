import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import './Finder.css';
const Finder = () => {
    const [activeSection, setActiveSection] = useState('About Me');
    const renderContent = () => {
        switch (activeSection) {
            case 'About Me':
                return (_jsxs("div", { className: "content-section", children: [_jsx("h2", { children: "About Me" }), _jsxs("p", { children: ["Hello! I'm ", _jsx("strong", { children: "Alex Hamelin" })] })] }));
            case 'Projects':
                return (_jsxs("div", { className: "content-section", children: [_jsx("h2", { children: "Projects" }), _jsx("ul", { children: _jsxs("li", { children: [_jsx("strong", { children: "Desktop OS UI" }), " \u2013 A React app mimicking Mac OS windows with drag/resize functionality. I wanted this to have multiple apps within the application itself so I can keep scaling it and add more projects later."] }) })] }));
            case 'Skills':
                return (_jsxs("div", { className: "content-section", children: [_jsx("h2", { children: "Skills" }), _jsxs("ul", { children: [_jsx("li", { children: "React / TypeScript" }), _jsx("li", { children: "JavaScript" }), _jsx("li", { children: "CSS" }), _jsx("li", { children: "Node.js" }), _jsx("li", { children: "REST API Integration" })] })] }));
            case 'Interests':
                return (_jsxs("div", { className: "content-section", children: [_jsx("h2", { children: "Interests" }), _jsx("p", { children: "Coding, gaming, art, pickleball, golf, etc." })] }));
            default:
                return null;
        }
    };
    return (_jsxs("div", { className: "finder-inner", children: [_jsx("div", { className: "finder-toolbar", children: _jsxs("div", { className: "toolbar-buttons", children: [_jsx("button", { children: "Back" }), _jsx("button", { children: "Forward" }), _jsx("button", { children: "View" }), _jsx("button", { children: "Action" })] }) }), _jsxs("div", { className: "finder-body", children: [_jsxs("div", { className: "finder-sidebar", children: [['About Me', 'Interests', 'Projects', 'Skills'].map(item => (_jsx("div", { className: `sidebar-item ${activeSection === item ? 'selected' : ''}`, onClick: () => setActiveSection(item), children: item }, item))), _jsxs("div", { className: "sidebar-links", children: [_jsx("a", { href: "https://www.linkedin.com/in/alejandro-hamelin/", target: "_blank", rel: "noopener noreferrer", children: "LinkedIn" }), _jsx("a", { href: "https://github.com/ahamelin9", target: "_blank", rel: "noopener noreferrer", children: "GitHub" })] })] }), _jsx("div", { className: "finder-content", children: renderContent() })] })] }));
};
export default Finder;
