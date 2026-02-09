"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, Flame, Shield, BarChart3, Send, Home, LogOut, LogIn, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { href: "/wall-of-shame", label: "Wall of Shame", icon: Flame },
  { href: "/scan", label: "Scanner", icon: Shield },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/submit", label: "Submit", icon: Send },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1E1E1E] bg-[#0A0A0A]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 group">
            <Flame className="h-7 w-7 text-[#FF3131] group-hover:animate-pulse" />
            <span className="font-heading text-xl font-bold text-white">
              RAGE QUIT
            </span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-[#888888] transition-colors hover:text-[#FF3131]"
              >
                {link.label}
              </Link>
            ))}
            {session ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#888888]">
                  {session.user?.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1 text-sm text-[#888888] transition-colors hover:text-[#FF3131]"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-[#FF3131] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#FF3131]/80 hover:shadow-[0_0_20px_rgba(255,49,49,0.3)]"
              >
                Sign In
              </Link>
            )}
          </div>

          <button
            className="text-white md:hidden"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-[#1E1E1E] bg-[#0A0A0A] md:hidden"
            >
              <div className="flex flex-col gap-1 p-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded px-3 py-3 text-[#888888] transition-colors hover:bg-[#141414] hover:text-[#FF3131]"
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                ))}
                {session ? (
                  <button
                    onClick={() => {
                      signOut();
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 rounded px-3 py-3 text-[#888888] transition-colors hover:bg-[#141414] hover:text-[#FF3131]"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded px-3 py-3 text-[#888888] transition-colors hover:bg-[#141414] hover:text-[#FF3131]"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1E1E1E] bg-[#0A0A0A]/95 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-around py-2">
          <Link href="/" className="flex flex-col items-center gap-1 px-3 py-1 text-[#888888] hover:text-[#FF3131]">
            <Home className="h-5 w-5" />
            <span className="text-[10px]">Home</span>
          </Link>
          <Link href="/wall-of-shame" className="flex flex-col items-center gap-1 px-3 py-1 text-[#888888] hover:text-[#FF3131]">
            <Flame className="h-5 w-5" />
            <span className="text-[10px]">Shame</span>
          </Link>
          <Link href="/scan" className="flex flex-col items-center gap-1 px-3 py-1 text-[#888888] hover:text-[#FF3131]">
            <Shield className="h-5 w-5" />
            <span className="text-[10px]">Scan</span>
          </Link>
          <Link href="/dashboard" className="flex flex-col items-center gap-1 px-3 py-1 text-[#888888] hover:text-[#FF3131]">
            {session ? <User className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            <span className="text-[10px]">{session ? "Dash" : "Login"}</span>
          </Link>
        </div>
      </div>
    </>
  );
}
