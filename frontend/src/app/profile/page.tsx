"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { getProfileStats, getFavorites, tmdbImage } from "@/lib/api";
import type { ProfileStats, FavoriteMovie } from "@/types";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [favorites, setFavorites] = useState<FavoriteMovie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          const [statsRes, favsRes] = await Promise.all([
            getProfileStats(),
            getFavorites()
          ]);
          setStats(statsRes.data);
          setFavorites(favsRes.data);
        }
      } catch (err) {
        console.error("Failed to load profile data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const isGoogleLogin = user?.app_metadata?.provider === "google";
  const email = user?.email || "";
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";
  const initial = email ? email[0].toUpperCase() : "?";

  // Helpers for charts
  const maxRatingCount = stats?.rating_distribution
    ? Math.max(...stats.rating_distribution.map((b) => b.count), 1)
    : 1;

  // Render 5 fixed slots for favorites
  const renderFavoriteSlots = () => {
    const slots = [];
    for (let i = 0; i < 5; i++) {
      const fav = favorites[i];
      if (fav) {
        slots.push(
          <Link key={`fav-${fav.movie_id}`} href={`/movie/${fav.movie_id}`} className="block group">
            <div className="aspect-[2/3] relative rounded-lg overflow-hidden bg-surface-800 ring-1 ring-surface-700/50 transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:ring-primary-500/50">
              {fav.poster_path ? (
                <Image
                  src={tmdbImage(fav.poster_path, "w342")}
                  alt={fav.title}
                  fill
                  sizes="(max-width: 640px) 50vw, 20vw"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-surface-500">
                   <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M18 4v1h-2V4c0-.55-.45-1-1-1H9c-.55 0-1 .45-1 1v1H6V4c0-.55-.45-1-1-1s-1 .45-1 1v16c0 .55.45 1 1 1s1-.45 1-1v-1h2v1c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-1h2v1c0 .55.45 1 1 1s1-.45 1-1V4c0-.55-.45-1-1-1s-1 .45-1 1zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" /></svg>
                </div>
              )}
            </div>
          </Link>
        );
      } else {
        slots.push(
          <Link 
            key={`empty-${i}`} 
            href="/discover"
            className="aspect-[2/3] rounded-lg border border-dashed border-surface-700/60 bg-surface-800/30 flex flex-col items-center justify-center text-surface-500 hover:border-primary-500/40 hover:bg-surface-800/50 group transition-all duration-300 cursor-pointer"
          >
            <svg className="w-6 h-6 mb-2 opacity-50 group-hover:opacity-100 group-hover:text-primary-400 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="text-[10px] uppercase tracking-widest font-medium opacity-50 group-hover:opacity-100 group-hover:text-primary-400 transition-all">Empty</span>
          </Link>
        );
      }
    }
    return slots;
  };

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="animate-pulse space-y-12">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-surface-800 rounded-full"></div>
              <div className="space-y-3">
                <div className="w-48 h-8 bg-surface-800 rounded"></div>
                <div className="w-32 h-4 bg-surface-800 rounded"></div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-40 bg-surface-800 rounded-2xl"></div>
              <div className="h-40 bg-surface-800 rounded-2xl"></div>
            </div>
            <div className="h-64 bg-surface-800 rounded-2xl"></div>
          </div>
        ) : user ? (
          <div className="space-y-12 animate-fade-in-up">
            
            {/* 1. Header Section */}
            <section className="flex items-center gap-6 pb-8 border-b border-surface-800/60">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-surface-700/50 shadow-lg flex-shrink-0">
                {isGoogleLogin && avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Avatar"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary-500 flex items-center justify-center text-white text-3xl font-semibold">
                    {initial}
                  </div>
                )}
              </div>
              <div>
                {isGoogleLogin && fullName ? (
                  <>
                    <h1 className="text-3xl font-bold tracking-tight text-surface-100 mb-1">{fullName}</h1>
                    <p className="text-sm text-surface-400">{email}</p>
                  </>
                ) : (
                  <h1 className="text-3xl font-bold tracking-tight text-surface-100">{email}</h1>
                )}
              </div>
            </section>

            {/* 2. Top 5 Favorites */}
            <section>
              <h2 className="text-sm font-medium text-surface-400 uppercase tracking-widest mb-6">Top 5 Favorites</h2>
              <div className="grid grid-cols-5 gap-4">
                {renderFavoriteSlots()}
              </div>
            </section>

            {/* 3. Stats Dashboard Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Metric Cards */}
              <div className="grid grid-cols-2 gap-6">
                <div className="glass-card rounded-2xl p-6 flex flex-col justify-center">
                  <div className="text-sm font-medium text-surface-400 uppercase tracking-widest mb-2">Total Watched</div>
                  <div className="text-4xl font-semibold text-surface-100">{stats?.total_watched || 0}</div>
                </div>
                <div className="glass-card rounded-2xl p-6 flex flex-col justify-center">
                  <div className="text-sm font-medium text-surface-400 uppercase tracking-widest mb-2">Average Rating</div>
                  <div className="text-4xl font-semibold text-surface-100 flex items-baseline gap-1">
                    {stats?.average_rating ? stats.average_rating.toFixed(1) : "0.0"}
                    <span className="text-base font-normal text-surface-500">/ 5</span>
                  </div>
                </div>
              </div>

              {/* Top Genres */}
              <div className="glass-card rounded-2xl p-6">
                <div className="text-sm font-medium text-surface-400 uppercase tracking-widest mb-6">Top Genres</div>
                {stats?.top_genres && stats.top_genres.length > 0 ? (
                  <div className="space-y-5">
                    {stats.top_genres.map((genre) => (
                      <div key={genre.genre}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-medium text-surface-200">{genre.genre}</span>
                          <span className="text-surface-400">
                            {genre.avg_rating.toFixed(1)} <span className="text-surface-600 text-xs ml-1">({genre.count} movies)</span>
                          </span>
                        </div>
                        <div className="h-2 w-full bg-surface-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary-500/80 rounded-full" 
                            style={{ width: `${(genre.avg_rating / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-surface-500 pb-4">
                    Not enough ratings to determine top genres.
                  </div>
                )}
              </div>

            </section>

            {/* 4. Rating Distribution */}
            <section className="glass-card rounded-2xl p-6 md:p-8">
              <div className="text-sm font-medium text-surface-400 uppercase tracking-widest mb-8">Rating Distribution</div>
              
              <div className="flex items-end h-48 gap-1 sm:gap-2">
                {stats?.rating_distribution?.map((bucket) => (
                  <div key={bucket.rating} className="flex-1 flex flex-col items-center group">
                    <div className="w-full flex-1 flex flex-col justify-end relative">
                      {bucket.count > 0 && (
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-800 text-surface-200 text-xs px-2 py-1 rounded transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {bucket.count} movies
                        </div>
                      )}
                      <div 
                        className="w-full bg-primary-500/30 group-hover:bg-primary-500/70 transition-colors duration-300 rounded-t-sm"
                        style={{ 
                          height: bucket.count > 0 ? `${(bucket.count / maxRatingCount) * 100}%` : '2px',
                          minHeight: bucket.count > 0 ? '4px' : '2px'
                        }}
                      />
                    </div>
                    <div className="mt-3 text-[10px] sm:text-xs text-surface-500">
                      {bucket.rating}
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        ) : (
          <div className="text-center py-20">
            <h1 className="text-2xl font-semibold text-surface-100 mb-4">Not Signed In</h1>
            <p className="text-surface-400 mb-8">Please sign in to view your profile dashboard.</p>
          </div>
        )}
      </main>
    </>
  );
}
