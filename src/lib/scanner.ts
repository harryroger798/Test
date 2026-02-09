interface Finding {
  category: string;
  matchedText: string;
  context: string;
  risk: "low" | "medium" | "high";
  explanation: string;
}

interface ScanResult {
  score: number;
  findings: Finding[];
  autoRenewal: boolean;
  cancellationWindow: string | null;
  penaltyClauses: Finding[];
}

const DANGER_PATTERNS: Record<string, RegExp[]> = {
  autoRenewal: [
    /auto[-\s]?renew/i,
    /automatically\s+renew/i,
    /renewal\s+will\s+occur/i,
    /unless\s+you\s+cancel/i,
    /will\s+be\s+charged\s+automatically/i,
  ],
  cancellationPenalty: [
    /early\s+termination\s+fee/i,
    /cancellation\s+fee/i,
    /penalty\s+for\s+cancel/i,
    /remaining\s+balance.*due/i,
  ],
  priceIncrease: [
    /reserve\s+the\s+right\s+to.*(?:change|increase|modify)\s+(?:the\s+)?price/i,
    /prices?\s+(?:may|can|will)\s+(?:change|increase)/i,
    /adjust.*(?:fee|price|rate)/i,
  ],
  dataRetention: [
    /retain.*data.*after.*cancel/i,
    /data.*(?:may|will)\s+be\s+(?:retained|kept|stored)/i,
  ],
  arbitration: [
    /binding\s+arbitration/i,
    /waive.*(?:right|ability).*(?:sue|class\s+action|court)/i,
    /class\s+action\s+waiver/i,
  ],
  noRefund: [
    /no\s+refund/i,
    /non[-\s]?refundable/i,
    /all\s+(?:fees|payments)\s+are\s+final/i,
  ],
  autoCollection: [
    /authorize.*(?:charge|debit|collect)/i,
    /consent\s+to\s+(?:automatic|recurring)\s+(?:charge|payment)/i,
  ],
  liabilityLimit: [
    /(?:limit|cap).*liability/i,
    /(?:shall|will)\s+not\s+(?:be\s+)?(?:liable|responsible)/i,
    /in\s+no\s+event.*(?:liable|responsible)/i,
  ],
};

const CATEGORY_WEIGHTS: Record<string, number> = {
  autoRenewal: 1.5,
  cancellationPenalty: 2,
  priceIncrease: 1.5,
  dataRetention: 1,
  arbitration: 2,
  noRefund: 1.5,
  autoCollection: 1,
  liabilityLimit: 0.5,
};

const RISK_LEVELS: Record<string, "low" | "medium" | "high"> = {
  autoRenewal: "medium",
  cancellationPenalty: "high",
  priceIncrease: "medium",
  dataRetention: "low",
  arbitration: "high",
  noRefund: "high",
  autoCollection: "medium",
  liabilityLimit: "low",
};

const EXPLANATIONS: Record<string, string> = {
  autoRenewal:
    "This contract will automatically renew and charge you unless you manually cancel before the renewal date.",
  cancellationPenalty:
    "You may be charged a fee or penalty if you cancel before the contract term ends.",
  priceIncrease:
    "The company reserves the right to increase prices, possibly without adequate notice.",
  dataRetention:
    "Your personal data may be retained even after you cancel the service.",
  arbitration:
    "You are waiving your right to sue or participate in a class action lawsuit. Disputes must go through private arbitration.",
  noRefund:
    "All payments are final. You will not receive a refund if you cancel or are unsatisfied.",
  autoCollection:
    "You are authorizing automatic charges to your payment method.",
  liabilityLimit:
    "The company limits their liability, meaning they may not be responsible for damages or losses.",
};

function extractContext(text: string, index: number, chars: number): string {
  const start = Math.max(0, index - chars);
  const end = Math.min(text.length, index + chars);
  let context = text.slice(start, end).trim();
  if (start > 0) context = "..." + context;
  if (end < text.length) context = context + "...";
  return context;
}

export function scanContract(text: string): ScanResult {
  let score = 0;
  const findings: Finding[] = [];
  let autoRenewal = false;
  let cancellationWindow: string | null = null;
  const penaltyClauses: Finding[] = [];

  for (const [category, patterns] of Object.entries(DANGER_PATTERNS)) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match.index !== undefined) {
        const weight = CATEGORY_WEIGHTS[category] || 1;
        score += weight;

        const finding: Finding = {
          category,
          matchedText: match[0],
          context: extractContext(text, match.index, 100),
          risk: RISK_LEVELS[category] || "medium",
          explanation: EXPLANATIONS[category] || "Potentially concerning clause detected.",
        };

        findings.push(finding);

        if (category === "autoRenewal") autoRenewal = true;
        if (category === "cancellationPenalty") penaltyClauses.push(finding);

        break;
      }
    }
  }

  const windowMatch = text.match(
    /cancel.*?(\d+)\s*(?:day|business\s+day|calendar\s+day)/i
  );
  if (windowMatch) {
    cancellationWindow = `${windowMatch[1]} days`;
  }

  return {
    score: Math.min(Math.round(score * 10) / 10, 10),
    findings,
    autoRenewal,
    cancellationWindow,
    penaltyClauses,
  };
}
