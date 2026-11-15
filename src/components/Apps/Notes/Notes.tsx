// React
import React, { useState } from 'react';
//Styling
import './Notes.css';

const STORAGE_KEY = 'notes_text';

// The note is kept in this browser between visits. Storage can be off (some
// private windows), and then Notes still works, it just forgets.
const loadNote = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

const saveNote = (text: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // storage is off or full: keep the note in memory only
  }
};

const Notes: React.FC = () => {
  const [text, setText] = useState(loadNote);

  return (
    <div className="notes-window">
      <textarea
        className="notes-textarea"
        placeholder="Start typing your note..."
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          saveNote(e.target.value);
        }}
      />
    </div>
  );
};

export default Notes;
