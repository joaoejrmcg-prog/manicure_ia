"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, DollarSign, Settings, LogOut, X, Calendar, Gift, HelpCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import { cn } from "../lib/utils";

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    };

    const menuItems = [
        { icon: Home, label: "Início", href: "/" },
        { icon: Calendar, label: "Agenda", href: "/agenda" },
        { icon: Users, label: "Clientes", href: "/clients" },
        { icon: DollarSign, label: "Financeiro", href: "/financial" },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Sidebar */}
            <aside className={cn(
                "w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-300 lg:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 flex justify-between items-start">
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                            Meu Negócio
                        </h1>
                        <p className="text-xs text-neutral-500 mt-1">Um produto NeoManager</p>
                    </div>
                    <button onClick={onClose} className="lg:hidden text-neutral-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => onClose?.()}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                                    isActive
                                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                        : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Quick Actions */}
                <div className="px-4 pb-4 space-y-2">
                    <Link
                        href="/ajuda"
                        onClick={() => onClose?.()}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                            pathname === "/ajuda"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                        )}
                    >
                        <HelpCircle className="w-5 h-5" />
                        <span className="font-medium">Ajuda</span>
                    </Link>
                    <Link
                        href="/perfil"
                        onClick={() => onClose?.()}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                            pathname === "/perfil"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                        )}
                    >
                        <Settings className="w-5 h-5" />
                        <span className="font-medium">Perfil</span>
                    </Link>
                    <Link
                        href="/indique"
                        onClick={() => onClose?.()}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border",
                            pathname === "/indique"
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                : "text-blue-400 border-blue-500/20 hover:bg-blue-500/10"
                        )}
                    >
                        <Gift className="w-5 h-5" />
                        <span className="font-medium">Indicar Amigos</span>
                    </Link>
                </div>

                <div className="p-4 border-t border-neutral-800">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-neutral-400 hover:bg-red-950/30 hover:text-red-400 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Sair</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
