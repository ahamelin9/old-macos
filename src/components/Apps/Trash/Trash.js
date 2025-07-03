var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// React
import { useState, useRef, useEffect } from 'react';
//Styling
import './Trash.css';
const Trash = () => {
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);
    const [photo, setPhoto] = useState(null);
    const canvasRef = useRef(null);
    // Start the camera when component mounts
    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, []);
    const startCamera = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const mediaStream = yield navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: false,
            });
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setStream(mediaStream);
            setError(null);
        }
        catch (err) {
            setError('Could not access the camera.');
            console.error('Camera error:', err);
        }
    });
    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };
    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context === null || context === void 0 ? void 0 : context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const photoDataUrl = canvas.toDataURL('image/jpeg');
            setPhoto(photoDataUrl);
        }
    };
    const clearPhoto = () => {
        setPhoto(null);
    };
    return (_jsxs("div", { className: "camera-container", children: [error && _jsx("div", { className: "error-message", children: error }), !photo ? (_jsxs(_Fragment, { children: [_jsx("video", { ref: videoRef, autoPlay: true, playsInline: true, muted: true, className: "camera-view" }), _jsx("button", { onClick: takePhoto, className: "capture-button", children: "Take Photo" })] })) : (_jsxs(_Fragment, { children: [_jsx("img", { src: photo, alt: "Captured", className: "photo-preview" }), _jsxs("div", { className: "photo-actions", children: [_jsx("button", { onClick: clearPhoto, className: "action-button", children: "Retake" }), _jsx("button", { onClick: () => alert('Photo saved!'), className: "action-button", children: "Save" })] })] })), _jsx("canvas", { ref: canvasRef, style: { display: 'none' } })] }));
};
export default Trash;
