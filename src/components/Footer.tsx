import Link from "next/link";
import { Flame } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative border-t border-[#1E1E1E] bg-[#0A0A0A] pb-20 md:pb-0 overflow-hidden">
      <img src="/characters/rage_peek.png" alt="" aria-hidden className="pointer-events-none select-none absolute right-4 top-0 hidden max-h-[120px] w-auto opacity-20 lg:block" />
      <div className="relative mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Flame className="h-6 w-6 text-[#FF3131]" />
              <span className="font-heading text-lg font-bold text-white">
                RAGE QUIT
              </span>
            </div>
            <p className="text-sm text-[#888888]">
              Stop bleeding money. Start fighting back.
            </p>
          </div>
          <div>
            <h4 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-white">
              Tools
            </h4>
            <ul className="space-y-2 text-sm text-[#888888]">
              <li>
                <Link href="/wall-of-shame" className="hover:text-[#FF3131] transition-colors">
                  Wall of Shame
                </Link>
              </li>
              <li>
                <Link href="/scan" className="hover:text-[#FF3131] transition-colors">
                  Contract Scanner
                </Link>
              </li>
              <li>
                <Link href="/calculator" className="hover:text-[#FF3131] transition-colors">
                  Cost Calculator
                </Link>
              </li>
              <li>
                <Link href="/alternatives" className="hover:text-[#FF3131] transition-colors">
                  Alternative Finder
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-[#FF3131] transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-white">
              Resources
            </h4>
            <ul className="space-y-2 text-sm text-[#888888]">
              <li>
                <Link href="/dark-patterns" className="hover:text-[#FF3131] transition-colors">
                  Dark Pattern Gallery
                </Link>
              </li>
              <li>
                <Link href="/rights" className="hover:text-[#FF3131] transition-colors">
                  Know Your Rights
                </Link>
              </li>
              <li>
                <Link href="/trending" className="hover:text-[#FF3131] transition-colors">
                  Trending Cancellations
                </Link>
              </li>
              <li>
                <Link href="/submit" className="hover:text-[#FF3131] transition-colors">
                  Submit a Guide
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-white">
              Legal
            </h4>
            <ul className="space-y-2 text-sm text-[#888888]">
              <li>
                <Link href="/rights" className="hover:text-[#FF3131] transition-colors">
                  Consumer Rights
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[#FF3131] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[#FF3131] transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-[#1E1E1E] pt-8 text-center text-xs text-[#888888]">
          &copy; {new Date().getFullYear()} Rage Quit. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
