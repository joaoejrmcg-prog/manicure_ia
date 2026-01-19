"use client";

import { useState, useEffect } from "react";

interface TypewriterProps {
    text: string;
    delay?: number;
    onComplete?: () => void;
    className?: string;
}

export default function Typewriter({
    text,
    delay = 40,
    onComplete,
    className = ""
}: TypewriterProps) {
    const [displayedText, setDisplayedText] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [isReady, setIsReady] = useState(false);

    // Initial delay before starting animation
    useEffect(() => {
        const readyTimeout = setTimeout(() => {
            setIsReady(true);
        }, 100);
        return () => clearTimeout(readyTimeout);
    }, []);

    useEffect(() => {
        // Reset when text changes
        setDisplayedText("");
        setCurrentIndex(0);
        setIsComplete(false);
        setIsReady(false);
        // Re-trigger ready after reset
        const timeout = setTimeout(() => setIsReady(true), 100);
        return () => clearTimeout(timeout);
    }, [text]);

    useEffect(() => {
        if (!isReady) return;

        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, delay);

            return () => clearTimeout(timeout);
        } else if (currentIndex === text.length && text.length > 0 && !isComplete) {
            setIsComplete(true);
            onComplete?.();
        }
    }, [currentIndex, text, delay, onComplete, isComplete, isReady]);

    // Parse markdown bold (**text**)
    const parseMarkdown = (str: string) => {
        const parts = str.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <strong key={index} className="font-semibold text-blue-300">
                        {part.slice(2, -2)}
                    </strong>
                );
            }
            return part;
        });
    };

    return (
        <span className={className}>
            {parseMarkdown(displayedText)}
            {!isComplete && <span className="animate-pulse">|</span>}
        </span>
    );
}
