"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { User } from "@supabase/supabase-js";
import { Bell, Menu } from "lucide-react";
import TipOfTheDay from "./TipOfTheDay";

interface HeaderProps {
    onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    return (
        <header className="h-16 border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40 lg:ml-64">
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 text-neutral-400 hover:text-white"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <h2 className="text-neutral-200 font-medium">
                    Olá, <span className="text-blue-400">{user?.email?.split('@')[0] || 'Visitante'}</span>
                </h2>
            </div>

            <div className="flex items-center gap-4">
                <TipOfTheDay />
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                    {user?.email?.[0].toUpperCase()}
                </div>
            </div>
        </header>
    );
}
