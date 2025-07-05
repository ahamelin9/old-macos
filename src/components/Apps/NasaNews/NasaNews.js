var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import './NasaNews.css';
const NasaNews = () => {
    const [apodData, setApodData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showHD, setShowHD] = useState(false);
    useEffect(() => {
        const fetchApodData = () => __awaiter(void 0, void 0, void 0, function* () {
            const nasaApiKey = import.meta.env.VITE_NASA_API_KEY;
            try {
                const response = yield fetch(`https://api.nasa.gov/planetary/apod?api_key=${nasaApiKey}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = yield response.json();
                setApodData(data);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
            }
            finally {
                setLoading(false);
            }
        });
        fetchApodData();
    }, []);
    if (loading) {
        return _jsx("div", { className: "nasa-container loading", children: "Loading NASA data..." });
    }
    if (error) {
        return _jsxs("div", { className: "nasa-container error", children: ["Error: ", error] });
    }
    if (!apodData) {
        return _jsx("div", { className: "nasa-container", children: "No data available" });
    }
    return (_jsxs("div", { className: "nasa-container", children: [_jsx("h2", { className: "nasa-title", children: "NASA Astronomy Picture of the Day" }), _jsxs("div", { className: "apod-container", children: [_jsx("h3", { className: "apod-title", children: apodData.title }), _jsx("p", { className: "apod-date", children: apodData.date }), apodData.media_type === 'image' ? (_jsxs("div", { className: "apod-image-container", children: [_jsx("img", { src: showHD && apodData.hdurl ? apodData.hdurl : apodData.url, alt: apodData.title, className: "apod-image", onError: (e) => {
                                    const target = e.target;
                                    target.src = apodData.url || '';
                                } }), apodData.hdurl && (_jsx("button", { className: "hd-toggle", onClick: () => setShowHD(!showHD), children: showHD ? 'Show Standard Quality' : 'Show HD Quality' }))] })) : apodData.media_type === 'video' ? (_jsx("div", { className: "apod-video-container", children: _jsx("iframe", { src: apodData.url, title: apodData.title, className: "apod-video", allowFullScreen: true }) })) : null, _jsx("p", { className: "apod-explanation", children: apodData.explanation }), apodData.copyright && (_jsxs("p", { className: "apod-copyright", children: ["Copyright: ", apodData.copyright] }))] }), _jsxs("div", { className: "nasa-links", children: [_jsx("h4", { children: "More NASA Content:" }), _jsxs("ul", { children: [_jsx("li", { children: _jsx("a", { href: "https://www.nasa.gov", target: "_blank", rel: "noopener noreferrer", children: "NASA Official Website" }) }), _jsx("li", { children: _jsx("a", { href: "https://apod.nasa.gov/apod/archivepix.html", target: "_blank", rel: "noopener noreferrer", children: "APOD Archive" }) }), _jsx("li", { children: _jsx("a", { href: "https://www.nasa.gov/multimedia/imagegallery/iotd.html", target: "_blank", rel: "noopener noreferrer", children: "NASA Image of the Day" }) }), _jsx("li", { children: _jsx("a", { href: "https://mars.nasa.gov/", target: "_blank", rel: "noopener noreferrer", children: "Mars Exploration Program" }) })] })] })] }));
};
export default NasaNews;
