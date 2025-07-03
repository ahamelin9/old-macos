import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import './Calculator.css';
const Calculator = () => {
    const [display, setDisplay] = useState('0');
    const [previousValue, setPreviousValue] = useState(null);
    const [operation, setOperation] = useState(null);
    const [waitingForOperand, setWaitingForOperand] = useState(false);
    const [calculated, setCalculated] = useState(false);
    const clearAll = () => {
        setDisplay('0');
        setPreviousValue(null);
        setOperation(null);
        setWaitingForOperand(false);
        setCalculated(false);
    };
    const inputDigit = (digit) => {
        if (calculated) {
            setDisplay(digit);
            setCalculated(false);
            setWaitingForOperand(false);
        }
        else if (waitingForOperand) {
            setDisplay(digit);
            setWaitingForOperand(false);
        }
        else {
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
    const performOperation = (nextOperation) => {
        const inputValue = parseFloat(display);
        if (previousValue === null) {
            setPreviousValue(inputValue);
        }
        else if (operation) {
            const currentValue = previousValue || 0;
            let newValue;
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
        if (!operation || previousValue === null)
            return;
        const inputValue = parseFloat(display);
        let newValue;
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
    return (_jsx("div", { className: "calculator-container", children: _jsxs("div", { className: "calculator", children: [_jsx("div", { className: "calculator-header", children: _jsx("div", { className: "calculator-title", children: "Calculator" }) }), _jsx("div", { className: "display", children: display }), _jsxs("div", { className: "buttons", children: [_jsx("button", { className: "function", onClick: clearAll, children: "AC" }), _jsx("button", { className: "function", onClick: toggleSign, children: "\u00B1" }), _jsx("button", { className: "function", onClick: inputPercent, children: "%" }), _jsx("button", { className: "operation", onClick: () => performOperation('÷'), children: "\u00F7" }), _jsx("button", { onClick: () => inputDigit('7'), children: "7" }), _jsx("button", { onClick: () => inputDigit('8'), children: "8" }), _jsx("button", { onClick: () => inputDigit('9'), children: "9" }), _jsx("button", { className: "operation", onClick: () => performOperation('×'), children: "\u00D7" }), _jsx("button", { onClick: () => inputDigit('4'), children: "4" }), _jsx("button", { onClick: () => inputDigit('5'), children: "5" }), _jsx("button", { onClick: () => inputDigit('6'), children: "6" }), _jsx("button", { className: "operation", onClick: () => performOperation('-'), children: "-" }), _jsx("button", { onClick: () => inputDigit('1'), children: "1" }), _jsx("button", { onClick: () => inputDigit('2'), children: "2" }), _jsx("button", { onClick: () => inputDigit('3'), children: "3" }), _jsx("button", { className: "operation", onClick: () => performOperation('+'), children: "+" }), _jsx("button", { className: "zero", onClick: () => inputDigit('0'), children: "0" }), _jsx("button", { onClick: inputDecimal, children: "." }), _jsx("button", { className: "operation", onClick: equals, children: "=" })] })] }) }));
};
export default Calculator;
