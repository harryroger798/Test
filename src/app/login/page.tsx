"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Flame, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "register") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <Flame className="mx-auto mb-3 h-10 w-10 text-[#FF3131]" />
          <h1 className="text-2xl font-bold">
            {mode === "login" ? "Welcome Back" : "Join the Fight"}
          </h1>
          <p className="mt-1 text-sm text-[#888888]">
            {mode === "login"
              ? "Sign in to your account"
              : "Create a free account to start saving"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-xs text-[#888888]">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131]"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-[#888888]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131]"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#888888]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full border border-[#1E1E1E] bg-[#141414] px-4 py-2 text-sm text-white placeholder-[#888888] outline-none focus:border-[#FF3131]"
              required
            />
          </div>

          {error && (
            <div className="border border-[#FF3131]/30 bg-[#FF3131]/10 px-3 py-2 text-sm text-[#FF3131]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF3131] py-3 font-semibold text-white transition-all hover:bg-[#FF3131]/80 disabled:opacity-50"
          >
            {loading
              ? "..."
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-[#888888]">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => setMode("register")}
                className="text-[#FF3131] hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-[#FF3131] hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
