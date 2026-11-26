import React, { useState } from 'react';
import { RefreshCw, FileMusic, Users, ArrowRight } from 'lucide-react';
import { signInWithGoogle } from '../services/firebase';

export const AuthScreen: React.FC = () => {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in right now.';
      if (!msg.includes('popup-closed-by-user')) {
        setError(msg);
      }
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F1F5F9] flex flex-col justify-between">
      <header className="flex items-center justify-between gap-8 px-8 py-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3.5 whitespace-nowrap shrink-0">
          <div className="w-16 h-14 rounded-xl overflow-hidden border border-white/15 bg-[#060C19] shrink-0">
            <img
              src={`${import.meta.env.BASE_URL}assets/aistudio/image_b9eac5aa.png`}
              alt="The ex-LEAR Network Germany logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
            />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-white">
            StageDeck
          </span>
        </div>
        <div className="text-xs text-slate-400 whitespace-nowrap shrink-0">
          Collaborative Band Setlist &amp; Rehearsal Console
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <h1 className="text-4xl lg:text-5xl font-bold text-white leading-[1.12] tracking-tight">
              Replace your shared setlist spreadsheet with a live rehearsal console.
            </h1>
            <p className="text-base text-slate-400 max-w-xl leading-relaxed">
              Assign vocals, guitars, keys, bass, and percussion in real time, and click any track to view its full-page chords and lyrics with instant key transposition and auto-scroll.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-white/[0.08]">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Users className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Live Role Matrix</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Click any instrument cell to assign bandmates and coordinate every part together.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <FileMusic className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Chords &amp; Lyrics</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Full-page transposable chord and lyric sheets with auto-scroll plus direct reference links.
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <RefreshCw className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Shared Cloud Sync</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Invite the whole band with one code so everyone edits the same setlist live.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="bg-[#131822] border border-white/[0.08] rounded-xl p-7 space-y-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-full max-w-[300px] aspect-[11/10] rounded-2xl overflow-hidden border border-white/15 bg-[#060C19] shadow-2xl shrink-0">
                  <img
                    src={`${import.meta.env.BASE_URL}assets/aistudio/image_b9eac5aa.png`}
                    alt="The ex-LEAR Network Germany emblem"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold text-white">Enter your Jam setlist</h2>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Sign in with Google to sync your band&apos;s setlist across devices or join an existing workspace with an invite code.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="w-full flex items-center justify-center gap-3 px-5 py-3 text-sm font-semibold bg-amber-500 text-[#0B0E14] rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                <span>{signingIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-xs text-slate-500 leading-relaxed">
                Your first workspace starts pre-loaded with your band&apos;s roster and tracks, ready to edit or share via a single invite code.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-8 py-4 border-t border-white/[0.06] text-xs text-slate-500 flex items-center justify-between">
        <span>StageDeck Rehearsal Workspace</span>
        <span>Real-time Cloud Sync</span>
      </footer>
    </div>
  );
};
