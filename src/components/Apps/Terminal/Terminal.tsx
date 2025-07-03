// React
import React, { useState, useRef, useEffect } from 'react';
// Styling
import './Terminal.css';

const Terminal: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>([
    '% Mac OS Terminal Emulator v1.0',
    'Type "help" for available commands',
    ''
  ]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isClearing, setIsClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const commands: Record<string, (args: string[]) => { result: string[]; clear?: boolean }> = {
    help: () => ({
      result: [
        'Available commands:',
        'clear       - Clear terminal screen',
        'echo <text> - Display text',
        'date        - Show current date/time',
        'ls [dir]    - List directory contents',
        'cd <dir>    - Change directory',
        'cat <file>  - Display file contents',
        'pwd         - Print working directory',
        'whoami      - Display current user',
        'theme <light/dark> - Change color theme',
        'history     - Show command history',
        ''
      ]
    }),
    clear: () => ({ result: [], clear: true }),
    echo: (args) => ({ result: [args.join(' '), ''] }),
    date: () => ({ result: [new Date().toString(), ''] }),
    ls: (args) => {
      const dir = args[0] || '';
      const files = {
        '': ['Applications/', 'Documents/', 'System/', 'Users/'],
        'Applications/': ['Finder.app', 'Terminal.app', 'Notes.app'],
        'Documents/': ['report.txt', 'notes.txt'],
        'System/': ['Preferences/', 'Library/']
      };
      return { result: [...(files[dir as keyof typeof files] || [`ls: ${dir}: No such directory`]), ''] };
    },
    cd: (args) => ({ result: [`cd: ${args[0] || 'HOME'}: No such directory (simulation only)`, ''] }),
    cat: (args) => ({ result: [`Contents of ${args[0] || 'file'}: (simulated content)`, ''] }),
    pwd: () => ({ result: ['~/Desktop', ''] }),
    whoami: () => ({ result: ['guest', ''] }),
    theme: (args) => {
      const theme = args[0];
      if (theme === 'dark' || theme === 'light') {
        document.documentElement.style.setProperty('--term-bg', theme === 'dark' ? '#222' : '#fff');
        document.documentElement.style.setProperty('--term-text', theme === 'dark' ? '#ddd' : '#000');
        return { result: [`Theme set to ${theme}`, ''] };
      }
      return { result: ['theme: specify "light" or "dark"', ''] };
    },
    history: () => ({ result: [...commandHistory.map((cmd, i) => ` ${i + 1}  ${cmd}`), ''] })
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const [cmd, ...args] = input.trim().split(' ');
    const newOutput = [...output, `$ ${input}`];
    
    if (cmd in commands) {
      const { result, clear } = commands[cmd](args);
      if (clear) {
        setIsClearing(true);
        setTimeout(() => {
          setOutput(result.length ? result : ['']);
          setIsClearing(false);
        }, 200);
      } else {
        setOutput([...newOutput, ...result]);
      }
    } else {
      setOutput([...newOutput, `${cmd}: command not found`, '']);
    }

    setCommandHistory([...commandHistory, input]);
    setHistoryIndex(-1);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' && commandHistory.length > 0) {
      const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
    } else if (e.key === 'ArrowDown' && historyIndex >= 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setInput(newIndex >= 0 ? commandHistory[commandHistory.length - 1 - newIndex] : '');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const partial = input.trim();
      const matches = Object.keys(commands).filter(c => c.startsWith(partial));
      if (matches.length === 1) {
        setInput(matches[0] + ' ');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      handleSubmit({ preventDefault: () => {} } as React.FormEvent);
      setInput('clear');
    }
  };

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className={`terminal-content ${isClearing ? 'clearing' : ''}`}>
      <div className="terminal-output" ref={outputRef}>
        {output.map((line, i) => (
          <div key={i} className={`terminal-line ${
            line.startsWith('ls:') || line.startsWith('cd:') || line.startsWith('cat:') ? 'error' : ''
          } ${
            line.endsWith('/') ? 'dir' : ''
          }`}>
            {line}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="terminal-input">
        <span className="prompt">$</span>
        <input
          type="text"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="terminal-input-field"
          autoFocus
        />
      </form>
    </div>
  );
};

export default Terminal;