import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.saasCompany.findMany({ take: 20, orderBy: { totalCancellations: "desc" } });
  const companyMap = new Map(companies.map(c => [c.slug, c.id]));

  const alerts = [
    {
      companyId: companyMap.get("netflix") || companyMap.get("amazon-prime") || null,
      alertType: "price_increase",
      title: "Netflix Standard Plan Price Increase",
      message: "Netflix has announced a price increase for Standard plans from $15.49 to $17.99/month, effective next billing cycle. Consider downgrading to Basic with Ads ($6.99) or canceling before your next renewal.",
      severity: "warning",
      regions: ["US", "Canada"],
    },
    {
      companyId: companyMap.get("adobe-creative-cloud") || null,
      alertType: "legal_action",
      title: "FTC Action Against Adobe Subscription Practices",
      message: "The FTC has filed a complaint against Adobe for hidden early termination fees and making it difficult to cancel Creative Cloud subscriptions. You may be eligible for a refund if you were charged unexpected fees.",
      severity: "critical",
      regions: ["US"],
    },
    {
      companyId: companyMap.get("amazon-prime") || null,
      alertType: "dark_pattern_change",
      title: "Amazon Prime Cancellation Flow Updated",
      message: "Amazon has updated their Prime cancellation flow with additional retention screens. The process now requires 6+ clicks to complete. Navigate to Account > Prime Membership > End Membership to cancel.",
      severity: "warning",
      regions: ["US", "UK", "EU", "GLOBAL"],
    },
    {
      companyId: companyMap.get("spotify") || companyMap.get("spotify-premium") || null,
      alertType: "retention_offer",
      title: "Spotify Offering 50% Off for 3 Months",
      message: "Multiple users report that Spotify is currently offering 50% off Premium for 3 months to users who initiate cancellation. Try canceling to see if you receive this offer before completing the process.",
      severity: "info",
      regions: ["US", "UK", "EU", "GLOBAL"],
    },
    {
      alertType: "renewal",
      title: "Subscription Renewal Season Alert",
      message: "Many annual subscriptions renew in January-February. Check your dashboard to review upcoming renewals and cancel any services you no longer use before being charged for another year.",
      severity: "info",
      regions: ["GLOBAL"],
    },
    {
      companyId: companyMap.get("planet-fitness") || companyMap.get("la-fitness") || null,
      alertType: "cancel_window",
      title: "Gym Membership Cancellation Window Closing",
      message: "Most gym chains require 30-day written notice before your annual renewal date. If your gym membership renews in March, you need to submit cancellation now to avoid being locked in for another year.",
      severity: "warning",
      regions: ["US"],
    },
    {
      alertType: "free_trial",
      title: "Free Trial Conversion Alert",
      message: "Reminder: Free trials from holiday promotions are converting to paid subscriptions this month. Check your subscriptions dashboard for any trials that need to be canceled before they auto-charge.",
      severity: "warning",
      regions: ["GLOBAL"],
    },
    {
      companyId: companyMap.get("hulu") || null,
      alertType: "price_increase",
      title: "Hulu Live TV Price Increase",
      message: "Hulu has increased the price of Hulu + Live TV from $76.99 to $82.99/month. Consider switching to YouTube TV or canceling if you don't use the live TV features regularly.",
      severity: "warning",
      regions: ["US"],
    },
    {
      companyId: companyMap.get("xfinity") || companyMap.get("comcast") || null,
      alertType: "legal_action",
      title: "FTC Investigating ISP Cancellation Practices",
      message: "The FTC is investigating multiple ISPs for making cancellation deliberately difficult, including long hold times and aggressive retention tactics. File a complaint at ftc.gov if you experience issues.",
      severity: "critical",
      regions: ["US"],
    },
    {
      companyId: companyMap.get("youtube-premium") || null,
      alertType: "retention_offer",
      title: "YouTube Premium Family Plan Discount",
      message: "Users report YouTube is offering a discounted Family Plan at $16.99/month (normally $22.99) to users attempting to cancel their individual Premium subscription.",
      severity: "info",
      regions: ["US", "Canada", "UK"],
    },
    {
      alertType: "dark_pattern_change",
      title: "New EU Digital Fairness Act Requirements",
      message: "The EU Digital Fairness Act now requires all subscription services to provide a prominent cancel button. Companies operating in the EU must comply or face fines up to 10% of global turnover.",
      severity: "info",
      regions: ["EU", "Germany", "France"],
    },
    {
      companyId: companyMap.get("nyt") || companyMap.get("new-york-times") || companyMap.get("the-new-york-times") || null,
      alertType: "cancel_window",
      title: "News Subscription Annual Renewal Notice",
      message: "Major news subscriptions (NYT, WSJ, Washington Post) typically auto-renew at higher rates after promotional periods. Check if your promotional rate is expiring and cancel before being charged full price.",
      severity: "warning",
      regions: ["US"],
    },
    {
      alertType: "price_increase",
      title: "Streaming Services Price Hike Wave",
      message: "Multiple streaming services have announced price increases for this quarter. Review your streaming subscriptions and consider which ones you actually use regularly to avoid paying more for services you rarely watch.",
      severity: "warning",
      regions: ["GLOBAL"],
    },
    {
      companyId: companyMap.get("mcafee") || companyMap.get("norton") || null,
      alertType: "dark_pattern_change",
      title: "Antivirus Auto-Renewal Dark Patterns",
      message: "Several antivirus companies have been reported for using aggressive auto-renewal tactics with prices 2-3x the initial rate. Check your antivirus subscription and consider free alternatives like Windows Defender.",
      severity: "warning",
      regions: ["GLOBAL"],
    },
  ];

  let seeded = 0;
  for (const a of alerts) {
    try {
      await prisma.alert.create({
        data: {
          companyId: a.companyId || null,
          alertType: a.alertType,
          title: a.title,
          message: a.message,
          severity: a.severity,
          regions: a.regions,
          isActive: true,
        },
      });
      seeded++;
    } catch (e) {
      console.log("Skip alert: " + a.title, e);
    }
  }
  console.log(`Seeded ${seeded} alerts across all 7 types.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
