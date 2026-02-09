"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, Flame, Shield, BarChart3, Home, LogOut, LogIn, User, Scale, Eye, Users, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { href: "/wall-of-shame", label: "Wall of Shame", icon: Flame },
  { href: "/dark-patterns", label: "Dark Patterns", icon: Eye },
  { href: "/rights", label: "Your Rights", icon: Scale },
  { href: "/community", label: "Community", icon: Users },
  { href: "/scan", label: "Scanner", icon: Shield },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
];

interface NotifItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { data: session } = useSession();
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/notifications")
      .then(r => r.json())
      .then(data => {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      })
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setUnreadCount(0);
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

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
                <div ref={bellRef} className="relative">
                  <button onClick={() => setBellOpen(!bellOpen)} className="relative text-[#888888] transition-colors hover:text-[#FF3131]">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF3131] text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  <AnimatePresence>
                    {bellOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 top-8 w-80 border border-[#1E1E1E] bg-[#0A0A0A] shadow-xl"
                      >
                        <div className="flex items-center justify-between border-b border-[#1E1E1E] px-4 py-3">
                          <span className="text-sm font-bold">Notifications</span>
                          {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-xs text-[#FF3131] hover:underline">
                              Mark all read
                            </button>
                          )}
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-4 text-center text-sm text-[#888888]">No notifications yet</div>
                          ) : (
                            notifications.slice(0, 10).map(n => (
                              <div key={n.id} className={`border-b border-[#1E1E1E] px-4 py-3 ${!n.isRead ? "bg-[#141414]" : ""}`}>
                                <p className="text-sm font-semibold">{n.title}</p>
                                <p className="text-xs text-[#888888]">{n.message}</p>
                                {n.link && (
                                  <Link href={n.link} onClick={() => setBellOpen(false)} className="mt-1 inline-block text-xs text-[#FF3131] hover:underline">
                                    View details &rarr;
                                  </Link>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                        <Link href="/dashboard/alerts" onClick={() => setBellOpen(false)}
                          className="block border-t border-[#1E1E1E] px-4 py-2 text-center text-xs text-[#888888] hover:text-white">
                          Alert Preferences
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
          <Link href="/community" className="flex flex-col items-center gap-1 px-3 py-1 text-[#888888] hover:text-[#FF3131]">
            <Users className="h-5 w-5" />
            <span className="text-[10px]">Community</span>
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
