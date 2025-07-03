// Styling
import './styles.css';

interface WindowHeaderProps {
  title: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  maximized: boolean;
}

const WindowHeader: React.FC<WindowHeaderProps> = ({ 
  title, 
  onClose, 
  onMinimize,
  onMaximize,
  maximized
}) => {
  return (
    <div className="window-header">
      <div className="window-controls">
        <button 
          className="window-close"
          onClick={onClose}
          aria-label="Close window"
        />
        <button 
          className="window-minimize"
          onClick={onMinimize}
          aria-label="Minimize window"
        />
        <button 
          className="window-maximize"
          onClick={onMaximize}
          aria-label={maximized ? "Restore window" : "Maximize window"}
        />
      </div>
      <div className="window-title">{title}</div>
    </div>
  );
};

export default WindowHeader;