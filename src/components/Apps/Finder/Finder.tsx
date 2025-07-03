// React
import React from 'react';
// Styling
import './Finder.css';

const Finder: React.FC = () => {
  return (
    <div className="finder-window">
      <div className="finder-titlebar">
        <div className="titlebar-title">Find Me!</div>
      </div>
      
      <div className="finder-toolbar">
        <div className="toolbar-button">Back</div>
        <div className="toolbar-button">Forward</div>
        <div className="toolbar-separator"></div>
        <div className="toolbar-button">View</div>
        <div className="toolbar-button">Action</div>
      </div>
      
      <div className="finder-container">
        <div className="finder-sidebar">
          <div className="sidebar-section">
            <div className="sidebar-header">Places</div>
            <div className="sidebar-item selected">About Me</div>
            <div className="sidebar-item">Interests</div>
            <div className="sidebar-item">Projects</div>
            <div className="sidebar-item">Skills</div>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-header">Devices</div>
            <div className="sidebar-item">My Computer</div>
            <div className="sidebar-item">Network</div>
          </div>
        </div>
        
        <div className="finder-content">
          <div className="content-section">
            <h2 className="section-title">About Me</h2>
            <div className="section-content">
              <div className="info-row">
                <span className="info-label">Name:</span>
                <span className="info-value">Alex Hamelin</span>
              </div>
              <div className="info-row">
                <span className="info-label">Email:</span>
                <span className="info-value">ahamelin9@gmail.com</span>
              </div>
              <div className="info-row">
                <span className="info-label">LinkedIn:</span>
                <span className="info-value">
                  <a href="https://www.linkedin.com/in/alejandro-hamelin/" target="_blank" rel="noopener noreferrer" className="leopard-link">
                    linkedin.com/in/alejandro-hamelin
                  </a>
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">GitHub:</span>
                <span className="info-value">
                  <a href="https://github.com/ahamelin9" target="_blank" rel="noopener noreferrer" className="leopard-link">
                    github.com/ahamelin9
                  </a>
                </span>
              </div>
            </div>
          </div>
          
          <div className="content-section">
            <h2 className="section-title">Interests</h2>
            <div className="section-content">
              <p>Type your interests here...</p>
            </div>
          </div>
          
          <div className="content-section">
            <h2 className="section-title">Projects</h2>
            <div className="section-content">
              <p>Describe your projects here...</p>
            </div>
          </div>
          
          <div className="content-section">
            <h2 className="section-title">Skills</h2>
            <div className="section-content">
              <p>List your skills here...</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="finder-statusbar">
        <div className="statusbar-item">5 items</div>
        <div className="statusbar-separator"></div>
        <div className="statusbar-item">Mac OS X (10.5.8)</div>
      </div>
    </div>
  );
};

export default Finder;