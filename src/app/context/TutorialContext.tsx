"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getTutorialStatus, completeTutorialLevel, TutorialStatus } from "../actions/tutorial";
import { supabase } from "../lib/supabase";
import {
    TUTORIAL_INTRO,
    TUTORIAL_LEVEL_1,
    TUTORIAL_LEVEL_2,
    TUTORIAL_LEVEL_3,
    LEVEL_NAMES
} from "../lib/tutorial-content";

type TutorialStep = {
    id: string;
    text: string;
    delay: number;
    autoAdvance?: boolean;
};

type TutorialState = 'IDLE' | 'INTRO' | 'LEVEL_SELECT' | 'RUNNING' | 'COMPLETED';

interface TutorialContextType {
    // State
    tutorialState: TutorialState;
    currentLevel: number;
    completedLevels: number;
    currentStepIndex: number;
    currentSteps: TutorialStep[];
    shouldShowTutorialButton: boolean;
    isTypewriterComplete: boolean;

    // Actions
    startTutorial: () => void;
    selectLevel: (level: number) => void;
    nextStep: () => void;
    endTutorial: () => void;
    setTypewriterComplete: (complete: boolean) => void;
    refreshStatus: () => Promise<void>;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null);
    const [tutorialState, setTutorialState] = useState<TutorialState>('IDLE');
    const [currentLevel, setCurrentLevel] = useState(0);
    const [completedLevels, setCompletedLevels] = useState(0);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [currentSteps, setCurrentSteps] = useState<TutorialStep[]>([]);
    const [shouldShowTutorialButton, setShouldShowTutorialButton] = useState(false);
    const [isTypewriterComplete, setIsTypewriterComplete] = useState(false);

    // Get user on mount
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
            }
        };
        getUser();
    }, []);

    // Fetch tutorial status when userId is available
    const refreshStatus = useCallback(async () => {
        if (!userId) return;

        const status = await getTutorialStatus(userId);
        setCompletedLevels(status.tutorialLevel);
        setShouldShowTutorialButton(status.shouldShowTutorialButton);
    }, [userId]);

    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    // Get steps for a specific level
    const getStepsForLevel = (level: number): TutorialStep[] => {
        switch (level) {
            case 1: return TUTORIAL_LEVEL_1;
            case 2: return TUTORIAL_LEVEL_2;
            case 3: return TUTORIAL_LEVEL_3;
            default: return [];
        }
    };

    // Start tutorial (show intro)
    const startTutorial = useCallback(() => {
        setTutorialState('INTRO');
        setCurrentSteps(TUTORIAL_INTRO);
        setCurrentStepIndex(0);
        setIsTypewriterComplete(false);
    }, []);

    // Listen for "tutorial" command from chat input
    useEffect(() => {
        const handleStartTutorial = () => {
            startTutorial();
        };

        window.addEventListener('start-tutorial', handleStartTutorial);
        return () => window.removeEventListener('start-tutorial', handleStartTutorial);
    }, [startTutorial]);

    // After intro, show level selection
    const showLevelSelect = useCallback(() => {
        setTutorialState('LEVEL_SELECT');
        setCurrentSteps([]);
        setCurrentStepIndex(0);
    }, []);

    // Select and start a level
    const selectLevel = useCallback((level: number) => {
        setCurrentLevel(level);
        setTutorialState('RUNNING');
        setCurrentSteps(getStepsForLevel(level));
        setCurrentStepIndex(0);
        setIsTypewriterComplete(false);
    }, []);

    // Go to next step or finish
    const nextStep = useCallback(async () => {
        setIsTypewriterComplete(false);

        // If in INTRO and finished all intro steps, go to level select
        if (tutorialState === 'INTRO' && currentStepIndex >= TUTORIAL_INTRO.length - 1) {
            showLevelSelect();
            return;
        }

        // If running tutorial and finished all steps
        if (tutorialState === 'RUNNING' && currentStepIndex >= currentSteps.length - 1) {
            // Mark level as completed
            if (userId && currentLevel > completedLevels) {
                await completeTutorialLevel(userId, currentLevel);
                setCompletedLevels(currentLevel);
            }

            // Show level select again or end if all done
            if (currentLevel >= 3) {
                setTutorialState('COMPLETED');
                // Auto-hide after 3 seconds
                setTimeout(() => {
                    setTutorialState('IDLE');
                    setShouldShowTutorialButton(false);
                }, 3000);
            } else {
                showLevelSelect();
            }
            return;
        }

        // Otherwise, go to next step
        setCurrentStepIndex(prev => prev + 1);
    }, [tutorialState, currentStepIndex, currentSteps.length, currentLevel, completedLevels, userId, showLevelSelect]);

    // End tutorial prematurely
    const endTutorial = useCallback(() => {
        setTutorialState('IDLE');
        setCurrentSteps([]);
        setCurrentStepIndex(0);
        setCurrentLevel(0);
    }, []);

    const setTypewriterComplete = useCallback((complete: boolean) => {
        setIsTypewriterComplete(complete);
    }, []);

    return (
        <TutorialContext.Provider
            value={{
                tutorialState,
                currentLevel,
                completedLevels,
                currentStepIndex,
                currentSteps,
                shouldShowTutorialButton,
                isTypewriterComplete,
                startTutorial,
                selectLevel,
                nextStep,
                endTutorial,
                setTypewriterComplete,
                refreshStatus,
            }}
        >
            {children}
        </TutorialContext.Provider>
    );
}

export function useTutorial() {
    const context = useContext(TutorialContext);
    if (!context) {
        throw new Error("useTutorial must be used within a TutorialProvider");
    }
    return context;
}

export { LEVEL_NAMES };
