"use client";

import { useState, useEffect } from "react";
import { Share2, Copy, X, Check, Twitter, Linkedin, ImageOff } from "lucide-react";
import Image from "next/image";

export default function ShareModal({
  isOpen,
  onClose,
  minutesToMidnight,
}: {
  isOpen: boolean;
  onClose: () => void;
  minutesToMidnight?: number;
}) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [imageError, setImageError] = useState(false);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  // Use a cache-busting query parameter so the browser always fetches the fresh OG image
  const ogImageUrl = `${siteUrl}/api/og?t=${Date.now()}`;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "https://aibubbleclock.com";
  
  const formattedMinutes = minutesToMidnight !== undefined ? minutesToMidnight.toFixed(1) : "XX";
  const shareText = `The AI Bubble Doomsday Clock is at ${formattedMinutes} hours to midnight. Real-time LPPLS market fragility model:`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      setImageError(false); // Reset error state on open
    }
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareToLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-card border border-primary/20 rounded-xl shadow-2xl p-6 overflow-hidden flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close share modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-text-primary font-bold text-xl uppercase tracking-wide border-b border-primary/20 pb-4">
          <Share2 className="w-5 h-5 text-secondary" />
          <h2>Share Doomsday Clock</h2>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-text-secondary text-sm">
            Spread awareness. Share the live real-time LPPLS market fragility model.
          </p>
          
          <div className="w-full bg-black/50 rounded-lg overflow-hidden border border-primary/30 aspect-[1200/630] relative shadow-inner flex flex-col items-center justify-center">
             {/* Thumbnail preview of the OG image */}
             {!imageError ? (
               <Image 
                 src={ogImageUrl}
                 alt="OG Image Preview"
                 fill
                 className="object-cover"
                 unoptimized
                 onError={() => setImageError(true)}
               />
             ) : (
               <div className="flex flex-col items-center justify-center text-text-muted gap-2">
                 <ImageOff className="w-8 h-8 opacity-50" />
                 <span className="text-sm">Preview unavailable</span>
               </div>
             )}
          </div>

          <div className="flex items-center justify-between gap-2 bg-black/40 border border-primary/20 rounded-md p-2">
            <span className="text-text-muted text-sm truncate flex-1 px-2 font-mono">
              {shareUrl}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded transition-colors text-sm font-medium"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={shareToTwitter}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-black border border-white/20 hover:bg-white/10 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Twitter className="w-4 h-4" />
              <span>Share on X</span>
            </button>
            <button
              onClick={shareToLinkedIn}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#0077b5] border border-[#0077b5] hover:bg-[#0077b5]/80 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Linkedin className="w-4 h-4" />
              <span>LinkedIn</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
