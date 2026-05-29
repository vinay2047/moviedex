"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      }
    };
    checkAuth();

    // Load theme
    const saved = localStorage.getItem("moviedex-theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
    } else {
      // Check system preference if no saved theme
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme("light");
      }
    }
  }, [router, supabase]);

  const toggleTheme = (newTheme: "dark" | "light") => {
    setTheme(newTheme);
    localStorage.setItem("moviedex-theme", newTheme);
    document.documentElement.classList.toggle("light", newTheme === "light");
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in-up">
        <h1 className="text-3xl font-semibold tracking-tight text-surface-100 mb-8">
          Settings
        </h1>

        <div className="space-y-8">
          {/* Appearance Section */}
          <section className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-medium text-surface-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.965 0M9.53 16.122A1.5 1.5 0 0111 17.5a1.5 1.5 0 01-1.5 1.5M9.53 16.122c.168-.691.865-1.122 1.562-.97m0 0l2.5-2.5m-2.5 2.5l-2.5-2.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
              </svg>
              Appearance
            </h2>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-t border-surface-800/60">
              <div>
                <h3 className="font-medium text-surface-200">Theme</h3>
                <p className="text-sm text-surface-400 mt-1">Select your preferred color scheme.</p>
              </div>
              
              <div className="flex bg-surface-900 border border-surface-700/60 rounded-lg p-1">
                <button
                  onClick={() => toggleTheme("light")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    theme === "light"
                      ? "bg-surface-100 text-surface-900 shadow-sm"
                      : "text-surface-400 hover:text-surface-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                    </svg>
                    Light
                  </div>
                </button>
                <button
                  onClick={() => toggleTheme("dark")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    theme === "dark"
                      ? "bg-surface-700 text-surface-100 shadow-sm"
                      : "text-surface-400 hover:text-surface-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    </svg>
                    Dark
                  </div>
                </button>
              </div>
            </div>
          </section>

          {/* Account Section */}
          <section className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-medium text-surface-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Account
            </h2>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-t border-surface-800/60">
              <div>
                <h3 className="font-medium text-surface-200">Sign Out</h3>
                <p className="text-sm text-surface-400 mt-1">Sign out of your MovieDex account on this device.</p>
              </div>
              
              <button
                onClick={handleSignOut}
                disabled={loading}
                className="btn-secondary flex items-center gap-2 !text-red-400 hover:!bg-red-500/10 hover:!border-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                {loading ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
