// React
import React, { useState } from 'react';
//Styling
import './Notes.css';

const Notes: React.FC = () => {
  const [text, setText] = useState('');

  return (
    <div className="notes-window">
      <textarea
        className="notes-textarea"
        placeholder="Start typing your note..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  );
};

export default Notes;