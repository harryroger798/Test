"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Scale, Shield, Globe, AlertTriangle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

const REGIONS = [
  {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    summary: "The FTC's Click-to-Cancel rule (2024) requires cancellation to be as easy as sign-up. The Restore Online Shoppers' Confidence Act prohibits negative option marketing without clear disclosure.",
    rights: [
      { title: "Right to Easy Cancellation", description: "Under the FTC Click-to-Cancel rule, companies must provide a simple mechanism to cancel that is at least as easy as the method used to sign up.", agency: "Federal Trade Commission (FTC)" },
      { title: "Right to Clear Disclosure", description: "Companies must clearly disclose all material terms before obtaining billing information. Hidden fees and surprise charges are prohibited.", agency: "FTC Act, Section 5" },
      { title: "Right to Refund for Unauthorized Charges", description: "If you were charged without proper consent or after cancellation, you can dispute charges through your bank (Fair Credit Billing Act) or file an FTC complaint.", agency: "CFPB / FTC" },
      { title: "State-Level Protections", description: "Many states (CA, NY, IL) have additional automatic renewal laws requiring clear disclosure of auto-renewal terms and easy cancellation mechanisms.", agency: "State Attorney General" },
    ],
    agencies: [
      { name: "Federal Trade Commission (FTC)", url: "https://reportfraud.ftc.gov/", description: "File complaints about deceptive subscription practices" },
      { name: "Consumer Financial Protection Bureau (CFPB)", url: "https://www.consumerfinance.gov/complaint/", description: "Dispute unauthorized charges on your accounts" },
      { name: "State Attorney General", url: "https://www.naag.org/find-my-ag/", description: "File complaints with your state's consumer protection office" },
    ],
    stats: { complaintsPerDay: 70, avgFine: "$50,120", enforcementActions: 47 },
  },
  {
    code: "UK",
    name: "United Kingdom",
    flag: "🇬🇧",
    summary: "The Digital Markets, Competition and Consumers Act 2024 bans subscription traps. Companies face fines up to 10% of global turnover for non-compliance.",
    rights: [
      { title: "Right to Transparent Subscription Terms", description: "Companies must provide clear pre-contract information including total costs, renewal terms, and cancellation procedures before you sign up.", agency: "Competition and Markets Authority (CMA)" },
      { title: "14-Day Cooling-Off Period", description: "You have 14 days to cancel most online purchases and subscriptions without giving any reason under the Consumer Contracts Regulations 2013.", agency: "Consumer Rights Act 2015" },
      { title: "Right to Cancel Without Barriers", description: "The DMCC Act 2024 requires companies to send renewal reminders and provide easy, accessible cancellation mechanisms. No phone-only cancellation for online sign-ups.", agency: "DMCC Act 2024" },
      { title: "Protection Against Unfair Terms", description: "Contract terms that create a significant imbalance to the consumer's detriment are unenforceable under the Consumer Rights Act 2015.", agency: "CMA" },
    ],
    agencies: [
      { name: "Competition and Markets Authority (CMA)", url: "https://www.gov.uk/government/organisations/competition-and-markets-authority", description: "UK's primary competition and consumer authority" },
      { name: "Citizens Advice", url: "https://www.citizensadvice.org.uk/", description: "Free consumer advice and complaint assistance" },
    ],
    stats: { complaintsPerDay: 45, avgFine: "10% of global turnover", enforcementActions: 23 },
  },
  {
    code: "EU",
    name: "European Union",
    flag: "🇪🇺",
    summary: "The Consumer Rights Directive provides a 14-day withdrawal right. The proposed Digital Fairness Act targets dark patterns with fines up to 4% of global turnover.",
    rights: [
      { title: "14-Day Right of Withdrawal", description: "You can withdraw from any online contract within 14 days without giving reasons. The trader must refund you within 14 days of receiving your withdrawal notice.", agency: "Consumer Rights Directive 2011/83/EU" },
      { title: "Right to Pre-Contractual Information", description: "Before purchase, you must be informed about total price, payment terms, cancellation rights, and complaint procedures in a clear and comprehensible manner.", agency: "Consumer Rights Directive" },
      { title: "Protection Against Unfair Commercial Practices", description: "Aggressive practices like making cancellation deliberately difficult, using confusing language, or hiding cancellation options are prohibited.", agency: "Unfair Commercial Practices Directive" },
      { title: "GDPR Data Deletion Rights", description: "Under GDPR Article 17, you have the right to request deletion of your personal data. Companies must comply within 30 days.", agency: "GDPR" },
    ],
    agencies: [
      { name: "European Consumer Centre (ECC-Net)", url: "https://commission.europa.eu/live-work-travel-eu/consumer-rights-and-complaints/resolve-your-consumer-complaint/european-consumer-centres-network-ecc-net_en", description: "Free advice for cross-border consumer disputes" },
    ],
    stats: { complaintsPerDay: 120, avgFine: "4% of global turnover", enforcementActions: 89 },
  },
  {
    code: "GERMANY",
    name: "Germany",
    flag: "🇩🇪",
    summary: "Germany's Kuendigungs-Button law (2022) requires a visible cancellation button on every subscription website. Violations can result in fines up to EUR 50,000.",
    rights: [
      { title: "Kuendigungs-Button (Cancellation Button)", description: "Every website offering subscriptions must have a clearly labeled, easily accessible cancellation button. Maximum two clicks to initiate cancellation. Effective since July 2022.", agency: "BGB Section 312k" },
      { title: "Contract Term Limits", description: "Initial subscription terms cannot exceed 2 years. After the initial term, contracts automatically convert to month-to-month with 1-month cancellation notice.", agency: "BGB Sections 309, 310" },
      { title: "Confirmation of Cancellation", description: "Companies must immediately provide written confirmation of your cancellation, including the effective date and any remaining obligations.", agency: "German Civil Code" },
      { title: "14-Day Withdrawal Right", description: "Standard EU 14-day cooling-off period applies. For digital content, withdrawal right may be waived only with explicit consent.", agency: "EU Consumer Rights Directive (German implementation)" },
    ],
    agencies: [
      { name: "Verbraucherzentrale (Consumer Center)", url: "https://www.verbraucherzentrale.de/", description: "Germany's network of consumer advice centers" },
    ],
    stats: { complaintsPerDay: 35, avgFine: "EUR 50,000", enforcementActions: 156 },
  },
  {
    code: "FRANCE",
    name: "France",
    flag: "🇫🇷",
    summary: "France enforces a three-click maximum rule for online cancellations. The Hamon Law provides strong consumer protections with penalties up to EUR 75,000.",
    rights: [
      { title: "Three-Click Cancellation Rule", description: "Online subscription cancellations must be completable within three clicks. Companies cannot require phone calls or physical mail for services signed up online.", agency: "French Consumer Code" },
      { title: "14-Day Cooling-Off Period (Hamon Law)", description: "Extended consumer protections for distance selling. Full refund within 14 days for any online purchase, no questions asked.", agency: "Law No. 2014-344" },
      { title: "Ban on Automatic Renewal Without Notice", description: "Companies must notify you at least 1 month before automatic renewal. Failure to notify allows you to cancel at any time without penalty.", agency: "French Consumer Code L215-1" },
      { title: "Right to Terminate Multi-Year Contracts", description: "After the first year of a multi-year contract, you can terminate at any time with 1 month notice.", agency: "Chatel Law" },
    ],
    agencies: [
      { name: "DGCCRF", url: "https://www.economie.gouv.fr/dgccrf", description: "France's consumer protection and fraud prevention authority" },
    ],
    stats: { complaintsPerDay: 28, avgFine: "EUR 75,000", enforcementActions: 67 },
  },
  {
    code: "INDIA",
    name: "India",
    flag: "🇮🇳",
    summary: "India's Consumer Protection Act 2019 and Dark Pattern Guidelines 2023 explicitly ban 13 types of dark patterns. Penalties up to INR 50 lakh for repeat offenders.",
    rights: [
      { title: "Protection Against Dark Patterns", description: "The Guidelines for Prevention of Dark Patterns 2023 explicitly ban subscription traps, forced continuity, hidden costs, confirmshaming, and 10 other dark pattern categories.", agency: "Ministry of Consumer Affairs" },
      { title: "Right to Easy Cancellation", description: "Subscription services must provide cancellation mechanisms that are at least as easy as the sign-up process. Phone-only cancellation for online services is prohibited.", agency: "Consumer Protection Act 2019" },
      { title: "Right to Refund", description: "If dark patterns were used to obtain your subscription, you are entitled to a full refund. The CCPA can order refunds suo motu.", agency: "CCPA" },
      { title: "Right to File E-Complaints", description: "File consumer complaints online through the National Consumer Helpline or e-Daakhil portal. No need for a lawyer.", agency: "Consumer Protection Act 2019" },
    ],
    agencies: [
      { name: "National Consumer Helpline", url: "https://consumerhelpline.gov.in/", description: "Toll-free helpline: 1800-11-4000" },
      { name: "e-Daakhil Portal", url: "https://edaakhil.nic.in/", description: "Online consumer complaint filing system" },
    ],
    stats: { complaintsPerDay: 85, avgFine: "INR 50 lakh", enforcementActions: 34 },
  },
  {
    code: "AU",
    name: "Australia",
    flag: "🇦🇺",
    summary: "Australian Consumer Law prohibits misleading conduct with fines up to AUD 50 million. The ACCC actively pursues subscription trap cases. 75% of Australians reported negative experiences.",
    rights: [
      { title: "Protection Against Misleading Conduct", description: "The Australian Consumer Law prohibits businesses from engaging in misleading or deceptive conduct, including making cancellation deliberately confusing or difficult.", agency: "ACCC" },
      { title: "Right to Cancel Unfair Contracts", description: "Unfair contract terms in standard form consumer contracts are void and unenforceable. This includes excessive cancellation fees and unreasonable notice periods.", agency: "Competition and Consumer Act 2010" },
      { title: "Cooling-Off Periods", description: "Various cooling-off periods apply depending on the type of purchase. Door-to-door and phone sales have a 10-business-day cooling-off period.", agency: "ACL" },
      { title: "Right to Dispute Resolution", description: "Free dispute resolution through state/territory consumer affairs agencies. The ACCC can take legal action on behalf of consumers.", agency: "ACCC / State Fair Trading" },
    ],
    agencies: [
      { name: "ACCC (Australian Competition and Consumer Commission)", url: "https://www.accc.gov.au/", description: "Australia's primary consumer protection regulator" },
    ],
    stats: { complaintsPerDay: 40, avgFine: "AUD 50 million", enforcementActions: 28 },
  },
  {
    code: "SOUTH_KOREA",
    name: "South Korea",
    flag: "🇰🇷",
    summary: "South Korea's E-Commerce Consumer Protection Act strictly regulates auto-renewal. The KFTC actively cracks down on dark patterns with fines up to KRW 100 million.",
    rights: [
      { title: "Strict Auto-Renewal Regulations", description: "Companies must explicitly notify consumers before renewal and provide easy opt-out mechanisms. Unauthorized renewals entitle consumers to full refunds.", agency: "E-Commerce Consumer Protection Act" },
      { title: "7-Day Withdrawal Right", description: "Consumers can withdraw from digital content purchases within 7 days if the content has not been used or accessed.", agency: "E-Commerce Act" },
      { title: "Protection Against Dark Patterns", description: "The KFTC has issued guidelines banning manipulative UI patterns in subscription services, including hidden cancellation options and confirmshaming.", agency: "Korea Fair Trade Commission" },
      { title: "Right to Clear Pricing", description: "All subscription costs must be clearly displayed, including renewal prices. Drip pricing and hidden fees are prohibited.", agency: "KFTC" },
    ],
    agencies: [
      { name: "Korea Fair Trade Commission (KFTC)", url: "https://www.ftc.go.kr/eng/", description: "South Korea's competition and consumer protection authority" },
      { name: "Korea Consumer Agency (KCA)", url: "https://www.kca.go.kr/eng/", description: "Consumer complaints and dispute resolution" },
    ],
    stats: { complaintsPerDay: 22, avgFine: "KRW 100 million", enforcementActions: 45 },
  },
  {
    code: "CANADA",
    name: "Canada",
    flag: "🇨🇦",
    summary: "Canada's Competition Act prohibits drip pricing and hidden fees with fines up to CAD 10 million. CASL provides additional protections for electronic subscriptions.",
    rights: [
      { title: "Protection Against Drip Pricing", description: "The Competition Act prohibits drip pricing - businesses must display the total price including all mandatory fees upfront.", agency: "Competition Bureau" },
      { title: "Right to Cancel Within Cooling-Off Period", description: "Provincial consumer protection laws provide cooling-off periods (typically 10 days) for certain types of contracts.", agency: "Provincial Consumer Protection Acts" },
      { title: "Protection Against False or Misleading Claims", description: "Making false or misleading representations about subscription terms, including cancellation difficulty, is a criminal offense.", agency: "Competition Act, Section 52" },
      { title: "Electronic Commerce Protection", description: "CASL requires express consent for commercial electronic messages. Companies must provide a clear unsubscribe mechanism in every communication.", agency: "CASL" },
    ],
    agencies: [
      { name: "Competition Bureau Canada", url: "https://www.competitionbureau.gc.ca/", description: "Federal competition and consumer protection agency" },
    ],
    stats: { complaintsPerDay: 18, avgFine: "CAD 10 million", enforcementActions: 19 },
  },
];

export default function RightsPage() {
  const [selectedRegion, setSelectedRegion] = useState("US");
  const [expandedRight, setExpandedRight] = useState<string | null>(null);

  const region = REGIONS.find((r) => r.code === selectedRegion) || REGIONS[0];

  return (
    <div>
      <div className="relative overflow-hidden px-4 py-16 md:py-20">
        <div className="absolute inset-0">
          <img src="/images/rights-bg.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#0A0A0A]/85" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0A0A]" />
        </div>
        <div className="relative mx-auto max-w-5xl">
          <img src="/characters/rage_shield.png" alt="" aria-hidden className="pointer-events-none select-none absolute right-2 top-0 hidden max-h-[200px] w-auto opacity-80 md:block" />
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="mb-2 text-3xl font-bold md:text-4xl">
              <Scale className="mr-2 inline h-8 w-8 text-[#FF6B35]" />
              Know Your Rights
            </h1>
            <p className="text-[#888888]">
              Consumer protection laws by region. Know what protections you have and how to use them.
            </p>
          </motion.div>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <button
              key={r.code}
              onClick={() => setSelectedRegion(r.code)}
              className={`flex items-center gap-1.5 border px-3 py-1.5 text-sm transition-all ${
                selectedRegion === r.code
                  ? "border-[#FF6B35] bg-[#FF6B35]/10 text-[#FF6B35]"
                  : "border-[#1E1E1E] text-[#888888] hover:border-[#FF6B35]/50 hover:text-white"
              }`}
            >
              <span>{r.flag}</span> {r.name}
            </button>
          ))}
        </div>

        <motion.div key={selectedRegion} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-6 border border-[#1E1E1E] bg-[#141414] p-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl">{region.flag}</span>
              <h2 className="text-xl font-bold">{region.name}</h2>
            </div>
            <p className="mb-4 text-sm text-[#888888]">{region.summary}</p>
            <div className="grid gap-3 grid-cols-3">
              <div className="border border-[#1E1E1E] bg-[#0A0A0A] p-3 text-center">
                <div className="font-mono text-lg font-bold text-[#FF3131]">{region.stats.complaintsPerDay}</div>
                <div className="text-xs text-[#888888]">Complaints/Day</div>
              </div>
              <div className="border border-[#1E1E1E] bg-[#0A0A0A] p-3 text-center">
                <div className="font-mono text-lg font-bold text-[#FF6B35]">{region.stats.avgFine}</div>
                <div className="text-xs text-[#888888]">Max Penalty</div>
              </div>
              <div className="border border-[#1E1E1E] bg-[#0A0A0A] p-3 text-center">
                <div className="font-mono text-lg font-bold text-[#00FF88]">{region.stats.enforcementActions}</div>
                <div className="text-xs text-[#888888]">Enforcement Actions</div>
              </div>
            </div>
          </div>

          <h3 className="mb-4 text-lg font-bold">
            <Shield className="mr-2 inline h-5 w-5 text-[#00FF88]" />
            Your Rights in {region.name}
          </h3>
          <div className="mb-8 space-y-2">
            {region.rights.map((right) => (
              <div key={right.title} className="border border-[#1E1E1E] bg-[#141414]">
                <button
                  onClick={() => setExpandedRight(expandedRight === right.title ? null : right.title)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div>
                    <span className="font-semibold text-white">{right.title}</span>
                    <span className="ml-2 text-xs text-[#888888]">{right.agency}</span>
                  </div>
                  {expandedRight === right.title ? (
                    <ChevronUp className="h-4 w-4 text-[#888888]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#888888]" />
                  )}
                </button>
                {expandedRight === right.title && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="border-t border-[#1E1E1E] px-4 pb-4 pt-3"
                  >
                    <p className="text-sm text-[#888888]">{right.description}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          <h3 className="mb-4 text-lg font-bold">
            <Globe className="mr-2 inline h-5 w-5 text-[#FF6B35]" />
            Where to File Complaints
          </h3>
          <div className="mb-8 space-y-3">
            {region.agencies.map((agency) => (
              <a
                key={agency.name}
                href={agency.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between border border-[#1E1E1E] bg-[#141414] p-4 transition-all hover:border-[#FF6B35]/30"
              >
                <div>
                  <div className="font-semibold text-white">{agency.name}</div>
                  <div className="text-sm text-[#888888]">{agency.description}</div>
                </div>
                <ExternalLink className="h-4 w-4 text-[#FF6B35]" />
              </a>
            ))}
          </div>

          <div className="border border-[#FF6B35]/30 bg-[#FF6B35]/5 p-6">
            <h3 className="mb-2 flex items-center gap-2 font-bold">
              <AlertTriangle className="h-5 w-5 text-[#FF6B35]" />
              Quick Action Steps
            </h3>
            <ol className="space-y-2 text-sm text-[#888888]">
              <li>1. Document everything - screenshot cancellation attempts, save emails and chat logs</li>
              <li>2. Try the company&apos;s cancellation process first - use our guides for step-by-step help</li>
              <li>3. If blocked, file a complaint with the relevant consumer protection agency above</li>
              <li>4. Dispute unauthorized charges with your bank/credit card company</li>
              <li>5. Consider small claims court for significant losses (typically under $10,000)</li>
            </ol>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
