import React, { useState } from 'react';
import './Calculator.css';

const Calculator: React.FC = () => {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const clearAll = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
    setCalculated(false);
  };

  const inputDigit = (digit: string) => {
    if (calculated) {
      setDisplay(digit);
      setCalculated(false);
      setWaitingForOperand(false);
    } else if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (calculated) {
      setDisplay('0.');
      setCalculated(false);
      setWaitingForOperand(false);
      return;
    }

    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }

    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const performOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      let newValue: number;

      switch (operation) {
        case '+':
          newValue = currentValue + inputValue;
          break;
        case '-':
          newValue = currentValue - inputValue;
          break;
        case '×':
          newValue = currentValue * inputValue;
          break;
        case '÷':
          newValue = currentValue / inputValue;
          break;
        default:
          newValue = inputValue;
      }

      setPreviousValue(newValue);
      setDisplay(String(newValue));
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
    setCalculated(false);
  };

  const toggleSign = () => {
    const newValue = parseFloat(display) * -1;
    setDisplay(String(newValue));
  };

  const inputPercent = () => {
    const currentValue = parseFloat(display);
    const newValue = currentValue / 100;
    setDisplay(String(newValue));
  };

  const equals = () => {
    if (!operation || previousValue === null) return;
    
    const inputValue = parseFloat(display);
    let newValue: number;

    switch (operation) {
      case '+':
        newValue = previousValue + inputValue;
        break;
      case '-':
        newValue = previousValue - inputValue;
        break;
      case '×':
        newValue = previousValue * inputValue;
        break;
      case '÷':
        newValue = previousValue / inputValue;
        break;
      default:
        newValue = inputValue;
    }

    setDisplay(String(newValue));
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
    setCalculated(true);
  };

  return (
    <div className="calculator-container">
      <div className="calculator">
        <div className="calculator-header">
          <div className="calculator-title">Calculator</div>
        </div>
        
        <div className="display">{display}</div>
        
        <div className="buttons">
          <button className="function" onClick={clearAll}>AC</button>
          <button className="function" onClick={toggleSign}>±</button>
          <button className="function" onClick={inputPercent}>%</button>
          <button className="operation" onClick={() => performOperation('÷')}>÷</button>
          
          <button onClick={() => inputDigit('7')}>7</button>
          <button onClick={() => inputDigit('8')}>8</button>
          <button onClick={() => inputDigit('9')}>9</button>
          <button className="operation" onClick={() => performOperation('×')}>×</button>
          
          <button onClick={() => inputDigit('4')}>4</button>
          <button onClick={() => inputDigit('5')}>5</button>
          <button onClick={() => inputDigit('6')}>6</button>
          <button className="operation" onClick={() => performOperation('-')}>-</button>
          
          <button onClick={() => inputDigit('1')}>1</button>
          <button onClick={() => inputDigit('2')}>2</button>
          <button onClick={() => inputDigit('3')}>3</button>
          <button className="operation" onClick={() => performOperation('+')}>+</button>
          
          <button className="zero" onClick={() => inputDigit('0')}>0</button>
          <button onClick={inputDecimal}>.</button>
          <button className="operation" onClick={equals}>=</button>
        </div>
      </div>
    </div>
  );
};

export default Calculator;