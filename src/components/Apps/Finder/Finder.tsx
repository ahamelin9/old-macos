import React, { useState } from 'react';
import './Finder.css';

const Finder: React.FC = () => {
  const [activeSection, setActiveSection] = useState('About Me');

  const renderContent = () => {
    switch (activeSection) {
      case 'About Me':
        return (
          <div className="content-section">
            <h2>About Me</h2>
            <p>Hello! I'm <strong>Alex Hamelin</strong></p>
          </div>
        );
      case 'Projects':
        return (
          <div className="content-section">
            <h2>Projects</h2>
            <ul>
              <li><strong>Desktop OS UI</strong> – A React app mimicking Mac OS windows with drag/resize functionality. I wanted this to have multiple apps within the application itself so I can keep scaling it and add more projects later.</li>
            </ul>
          </div>
        );
      case 'Skills':
        return (
          <div className="content-section">
            <h2>Skills</h2>
            <ul>
              <li>React / TypeScript</li>
              <li>JavaScript</li>
              <li>CSS</li>
              <li>Node.js</li>
              <li>REST API Integration</li>
            </ul>
          </div>
        );
      case 'Interests':
        return (
          <div className="content-section">
            <h2>Interests</h2>
            <p>Coding, gaming, art, pickleball, golf, etc.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="finder-inner">
      <div className="finder-toolbar">
        <div className="toolbar-buttons">
          <button>Back</button>
          <button>Forward</button>
          <button>View</button>
          <button>Action</button>
        </div>
      </div>

      <div className="finder-body">
        <div className="finder-sidebar">
          {['About Me', 'Interests', 'Projects', 'Skills'].map(item => (
            <div
              key={item}
              className={`sidebar-item ${activeSection === item ? 'selected' : ''}`}
              onClick={() => setActiveSection(item)}
            >
              {item}
            </div>
          ))}
          <div className="sidebar-links">
            <a href="https://www.linkedin.com/in/alejandro-hamelin/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="https://github.com/ahamelin9" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>

        <div className="finder-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Finder;
