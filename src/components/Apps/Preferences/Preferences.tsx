// React
import React from 'react';
// Styling
import './Preferences.css';

const Preferences: React.FC = () => {
  return (
    <div className="preferences-window">
      <div className="preferences-category">Appearance</div>
      <div className="preferences-category">Network</div>
      <div className="preferences-category">Sound</div>
    </div>
  );
};

export default Preferences;