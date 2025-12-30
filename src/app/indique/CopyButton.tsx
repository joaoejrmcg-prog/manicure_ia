"use client";

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className={`p-3 rounded-lg transition-all duration-200 ${copied
                    ? 'bg-green-500 text-white shadow-lg scale-105'
                    : 'bg-gray-900 text-white hover:bg-gray-800 active:scale-95'
                }`}
            title="Copiar Link"
        >
            {copied ? <Check size={20} /> : <Copy size={20} />}
        </button>
    );
}
