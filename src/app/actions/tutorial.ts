"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Create a server-side Supabase client
const getSupabase = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export interface TutorialStatus {
    tutorialLevel: number;
    interactionCount: number;
    shouldShowTutorialButton: boolean;
}

/**
 * Get the current tutorial status for a user
 */
export async function getTutorialStatus(userId: string): Promise<TutorialStatus> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('profiles')
        .select('tutorial_level, interaction_count')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        console.error('Error fetching tutorial status:', error);
        return {
            tutorialLevel: 0,
            interactionCount: 0,
            shouldShowTutorialButton: true,
        };
    }

    const tutorialLevel = data.tutorial_level || 0;
    const interactionCount = data.interaction_count || 0;

    // Show tutorial button if:
    // 1. User hasn't completed all levels (< 3)
    // 2. AND user has less than 10 interactions (or always show if they started a tutorial)
    const shouldShowTutorialButton = tutorialLevel < 3 && (interactionCount < 10 || tutorialLevel > 0);

    return {
        tutorialLevel,
        interactionCount,
        shouldShowTutorialButton,
    };
}

/**
 * Update the tutorial level after completing a level
 */
export async function completeTutorialLevel(userId: string, level: number): Promise<boolean> {
    const supabase = getSupabase();

    const { error } = await supabase
        .from('profiles')
        .update({ tutorial_level: level })
        .eq('user_id', userId);

    if (error) {
        console.error('Error updating tutorial level:', error);
        return false;
    }

    return true;
}

/**
 * Increment the interaction count (called after each AI interaction)
 */
export async function incrementInteractionCount(userId: string): Promise<void> {
    const supabase = getSupabase();

    // Use RPC or raw SQL for atomic increment
    const { error } = await supabase.rpc('increment_interaction_count', {
        p_user_id: userId
    });

    // If RPC doesn't exist, fallback to regular update
    if (error) {
        // Fallback: fetch current count and increment
        const { data } = await supabase
            .from('profiles')
            .select('interaction_count')
            .eq('user_id', userId)
            .single();

        const currentCount = data?.interaction_count || 0;

        await supabase
            .from('profiles')
            .update({ interaction_count: currentCount + 1 })
            .eq('user_id', userId);
    }
}
