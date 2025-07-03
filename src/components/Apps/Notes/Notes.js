import { jsx as _jsx } from "react/jsx-runtime";
// React
import { useState } from 'react';
//Styling
import './Notes.css';
const Notes = () => {
    const [text, setText] = useState('');
    return (_jsx("div", { className: "notes-window", children: _jsx("textarea", { className: "notes-textarea", placeholder: "Start typing your note...", value: text, onChange: (e) => setText(e.target.value) }) }));
};
export default Notes;
