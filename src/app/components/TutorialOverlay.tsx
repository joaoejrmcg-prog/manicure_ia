"use client";

import { useRef, useEffect } from "react";
import { useTutorial, LEVEL_NAMES } from "../context/TutorialContext";
import Typewriter from "./Typewriter";
import { Bot, X, Lock, Check, Play, BookOpen } from "lucide-react";
import { cn } from "../lib/utils";

export default function TutorialOverlay() {
    const {
        tutorialState,
        currentLevel,
        completedLevels,
        currentStepIndex,
        currentSteps,
        isTypewriterComplete,
        selectLevel,
        nextStep,
        endTutorial,
        setTypewriterComplete,
    } = useTutorial();

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new message appears
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [currentStepIndex, isTypewriterComplete]);

    // Don't render if not in tutorial mode
    if (tutorialState === 'IDLE' || tutorialState === 'COMPLETED') {
        return null;
    }

    const currentStep = currentSteps[currentStepIndex];

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

    // Level selection UI
    if (tutorialState === 'LEVEL_SELECT') {
        return (
            <div className="flex flex-col gap-4 p-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-300">
                        <BookOpen className="w-5 h-5" />
                        <span className="font-medium">Escolha um nível</span>
                    </div>
                    <button
                        onClick={endTutorial}
                        className="p-1 text-neutral-500 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Level buttons */}
                <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((level) => {
                        const isCompleted = level <= completedLevels;
                        const isLocked = level > completedLevels + 1;
                        const isNext = level === completedLevels + 1;

                        return (
                            <button
                                key={level}
                                onClick={() => !isLocked && selectLevel(level)}
                                disabled={isLocked}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                                    isCompleted && "bg-green-500/10 border-green-500/50 text-green-300",
                                    isNext && "bg-blue-500/10 border-blue-400 text-blue-300 hover:bg-blue-500/20",
                                    isLocked && "bg-neutral-800/50 border-neutral-700 text-neutral-500 cursor-not-allowed",
                                    !isCompleted && !isLocked && !isNext && "bg-neutral-800 border-neutral-600 text-neutral-300 hover:border-neutral-500"
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center",
                                    isCompleted && "bg-green-500/20",
                                    isNext && "bg-blue-500/20",
                                    isLocked && "bg-neutral-700"
                                )}>
                                    {isCompleted && <Check className="w-4 h-4" />}
                                    {isNext && <Play className="w-4 h-4" />}
                                    {isLocked && <Lock className="w-4 h-4" />}
                                </div>
                                <span className="font-medium">{LEVEL_NAMES[level as keyof typeof LEVEL_NAMES]}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Refazer hint */}
                {completedLevels > 0 && (
                    <p className="text-xs text-neutral-500 text-center">
                        Clique em um nível completo para refazer
                    </p>
                )}
            </div>
        );
    }

    // Tutorial content (INTRO or RUNNING) - with message history
    return (
        <div className="flex flex-col gap-3 p-4">
            {/* Close button */}
            <div className="flex justify-end">
                <button
                    onClick={endTutorial}
                    className="p-1 text-neutral-500 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Previous messages (completed) */}
            {currentSteps.slice(0, currentStepIndex).map((step) => (
                <div key={step.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 bg-neutral-800 rounded-2xl rounded-tl-none border-2 border-neutral-600 p-3">
                        <span className="text-white">{parseMarkdown(step.text)}</span>
                    </div>
                </div>
            ))}

            {/* Current message with typewriter */}
            {currentStep && (
                <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 bg-neutral-800 rounded-2xl rounded-tl-none border-2 border-neutral-600 p-3">
                        <Typewriter
                            key={currentStep.id}
                            text={currentStep.text}
                            delay={currentStep.delay}
                            onComplete={() => {
                                if (currentStep.autoAdvance) {
                                    // Auto advance after a short delay
                                    setTimeout(() => nextStep(), 500);
                                } else {
                                    setTypewriterComplete(true);
                                }
                            }}
                            className="text-white"
                        />
                    </div>
                </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />

            {/* Continue button - only if not autoAdvance */}
            {isTypewriterComplete && currentStep && !currentStep.autoAdvance && (
                <div className="flex justify-end">
                    <button
                        onClick={nextStep}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl border-2 border-blue-400 transition-colors"
                    >
                        Continuar
                    </button>
                </div>
            )}
        </div>
    );
}

