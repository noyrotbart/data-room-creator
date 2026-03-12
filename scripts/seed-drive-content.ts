/**
 * One-time script to seed document_chunks with content read from Google Drive.
 * Includes the Churney Technical Overview, Series A FAQ, and key spreadsheet data.
 *
 * Run with: npx tsx scripts/seed-drive-content.ts
 */
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

// Load .env.local manually for local runs
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const [k, ...rest] = line.split("=");
    if (k && rest.length && !process.env[k.trim()]) {
      process.env[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const db = neon(process.env.DATABASE_URL);

const CHUNK_SIZE = 1000;
const OVERLAP = 100;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const normalized = text.replace(/\s+/g, " ").trim();
  let start = 0;
  while (start < normalized.length) {
    let end = start + CHUNK_SIZE;
    if (end < normalized.length) {
      const space = normalized.lastIndexOf(" ", end);
      if (space > start) end = space;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start = end - OVERLAP;
  }
  return chunks;
}

async function upsert(filePath: string, text: string) {
  const chunks = chunkText(text);
  if (!chunks.length) return 0;
  for (let i = 0; i < chunks.length; i++) {
    await db(
      `INSERT INTO document_chunks (file_path, chunk_index, chunk_text)
       VALUES ($1, $2, $3)
       ON CONFLICT (file_path, chunk_index) DO UPDATE SET chunk_text = EXCLUDED.chunk_text`,
      [filePath, i, chunks[i]]
    );
  }
  return chunks.length;
}

// ─── Document content (from Google Drive) ─────────────────────────────────────

const TECHNICAL_OVERVIEW = `Churney - The AI Signal Layer for Long-Term Value

Technical Overview

Executive Summary
Churney moves beyond standard LTV forecasting into causal reinforcement learning. Our core contribution is the Signal Engineering layer: a proprietary Contextual Bandit setup designed for delayed feedback. We detail how this system navigates critical trade-offs. Specifically we focus on distribution shifts and signal variance to outperform naive predictive models. We overview our algorithmic mechanics for optimizing black-box ad platforms.

The Problem
AI systems are incredible at delivering on any timely, high-volume training signal. If there was no requirement for timeliness, one could simply use long-term value as the correct training signal, but this is practically infeasible because these systems need signals to learn from long before this delayed feedback is available.
This requirement for timeliness means that most AI systems are trained on short-term proxy signals which in turn drive suboptimal outcomes. We estimate that ~65% of the ~$650B annual performance marketing spend would stand to benefit from being optimized for long-term value with expected long-term ROAS gains of more than 30%. The economic loss in performance marketing alone from training on these suboptimal outcomes is profound. As business applications of Generative AI proliferate, the opportunity there will quickly become even larger in the years to come.

High Level Solution
Churney's position in the AI ecosystem is to function as a training signal layer for long-term value optimized AI systems. In short, we operate as a layer between company first-party data and the AI systems, replacing short-term proxy signals with predicted long-term value signals. Even at this early stage in our company history the average long-term increase in ROI from switching to our training signals is greater than 30%.

Architecture Outline
Churney sits between company first-party data and the AI systems. To be more concrete, in the following, we will focus on the ad optimization use case, where the goal is to acquire new customers or users with the greatest possible lifetime value. Our objective is to produce a predicted value signal for each user which can be sent to the ad platform within the optimization window (usually within 7 days of the ad impression/click).

Core Components
1. Data Integration and Transformation
Our entire pipeline is automated once we have onboarded a new client. An onboarding starts with a replication of the relevant data from the client's data warehouse with PII hashed. The initial onboarding is relatively lightweight, essentially requiring only 3 things to be manually annotated so that the client's data can be transformed to our common data model: User IDs (to map all entries associated with a user across the tables), Timestamps (the time at which each event occurred), and Value (the value of each user, which is what we're trying to predict). All other columns and properties of the client's data are treated as a black box that may be useful to our modeling, but do not need to be understood.

2. Predictive Modeling and Signal Constraints
Value prediction: Our basic challenge is to predict the future value of a user based only on their first hours or days of activity. In order to do so, we employ an ensemble approach that combines more traditional tabular approaches with deep sequential models, in particular transformers. These models need to be trained under heavy censoring, and specifically to account for the fact that we only observe hours or days of behavior, and to be extremely quick to self correct if their online performance becomes upwards or downwards biased.
Signal Engineering and causal feedback loop: For a given user, we have the entire optimization window to send our predicted value to the ad platform. A constraint imposed by most of the ad platform optimization algorithms is that you can update your prediction, but only to increase it. Additionally, you are more likely to win an auction where you over-estimate a user's value. These two points create an asymmetric risk where it is significantly worse to overestimate a user's value than under-estimate it.
Some trade-offs that need to be handled include: Prediction confidence vs delay (the ad platform generally learns better if the signal is sent early, but the predictions are less confident early on), Prediction variance vs signal volume (even though some users may be worth much more than other users, the ad platform will struggle to learn from a high variance signal with insufficient volume), Causally robust predictors (when new users start to be acquired based on the predicted value signal, this causes a distribution shift), and Information asymmetry (a given feature might be useful for our predictive model, but if the ad platform doesn't have features on its side which are correlated with it, then using these features in our modeling will only add noise to the ad platform's optimization).

3. The Optimization Algorithm (Post-Processing)
Our signal engineering approach: Our goal is to learn a post-processing that takes as input the raw predictions from our predictive models, our confidence about those predictions, and other contextual features about the user, company, ad platform etc. This post-processing should output a single post-processed value which is sent to the ad platform at a given point in time.
We learn this post processing based on how the users that are acquired via campaigns optimized towards our signal mature in the long-term. This means that we are ourselves dealing with a delayed feedback problem setting. Additionally, the environment shifts over time, and can even tend to do so adversarially because of the competitive auction dynamics of ad optimization.
The Contextual Bandit: Our signal engineering post processor is a best of both worlds contextual bandit algorithm with delayed feedback. The algorithm is an extension of the provably optimal algorithm designed by our research engineer Saeed Masoudian for a simplified version of our problem setting as part of his PhD (with his PhD supervisor Yevgeny Seldin, who was also my co-supervisor).

The Moat
We argue that the deepest moats in AI lie in the exploration-exploitation trade-off. We produce signals for training black box AI models. These black boxes are related but distinct, moving targets, necessitating continuous exploration on both the client and AI system level for optimal signals. Data moats are deepest when data is expensive to collect. Here you can only collect data in large scale experiments on client's production systems. Transfer learning is only viable shortcut to the cost of exploration, creating powerful network effects for market leader. The performance gap to the nearest competitor is a lower bound on the switching cost. Combined, these factors will ensure a durable, and self-reinforcing edge for us as market leader over even the most sophisticated competitors and clients.

Conclusion
The performance impact of our signals is large and easy to measure via A/B testing. As a result, we know very well, as do our clients, the long-term ROI improvement we deliver for them. It's therefore natural to charge a percentage of the spend we optimize. Additionally, our signal layer moat ensures that regardless of the sophistication of a client, we can expect to deliver larger improvements than an in-house model would. This ensures that this percentage we charge never needs to be capped at some fixed maximum and can instead in principle scale freely with the spend optimized for even the largest of clients.`;

const SERIES_A_FAQ = `Churney - Series A Investor FAQ
Confidential - Strategic, Operational & Technical Deep Dive

I. Market and Vision

Q: Is Churney an "Adtech" company? How do you avoid the volatility of that sector?
We are not Adtech; we are Signal Infrastructure. Traditional Adtech sits on the "media buying" layer (focused on media execution and dashboards). Churney sits on the "data infrastructure" layer (alongside the warehouse), acting as the mission-critical pipe between a company's first-party data and the AI platforms.

Q: Is the TAM for a "signal layer" actually large enough for a venture-scale outcome?
Absolutely. There are currently between 20,000-35,000 companies globally spending at least $300k/month on digital ads. By servicing just 10% of this market (approx. 2,000 clients) at an average ARR of $150k, Churney becomes a $300M ARR business within the advertising vertical alone.

Q: How do you evolve beyond the current landscape?
We are the signal layer for all business-facing AI. While we focus on ad platforms today, we are already moving toward the "LLM fine-tuning" space. The Proof: Google Cloud recently granted Churney $300k in credits specifically to pilot the use of our Causal ML signals for fine-tuning enterprise LLMs.

Q: Why won't Google and Meta just build this themselves?
Platform giants are actually our biggest proponents. They are actively financing customer pilots. The Trust & Privacy Barrier: Enterprises will not hand over raw, first-party data warehouses (Snowflake/BigQuery) to inventory sellers like Meta/TikTok/Google Ads. Cross-Platform Neutrality: Platforms are incentivized to optimize for their own silo. Clients need a neutral layer that optimizes across TikTok, Meta, and Google simultaneously. Experimental Advantage: Our moat is our ability to run simultaneous experiments across the entire market to find the best signal, a "learning loop" no single platform can replicate.

Q: How do you address the "Build vs. Buy" argument from savvy internal teams?
Most "savvy" companies have cohort-level pLTV for reporting, but almost none have user-level pLTV that can be injected into real-time bidding. For example, Zapier had an internal model, but Churney's model outperformed theirs by 190% (reference call available). pLTV Modeling can, with difficulty, be done in-house, but the signal engineering required to maximize ROI for each black box AI system is effectively impossible for any one company to do.

II. Business Model, Pricing and Growth

Q: What is your pricing model and how does it scale?
We use a Value-Based structure to ensure high-intent pilots and long-term alignment: Pilot Phase: A monthly fee ($8k-$10k) to incentivize on-time delivery. Post-Pilot: The base monthly fee + 2-2.5% of the ad spend optimized by Churney signals. While we currently have monthly caps for enterprise comfort, we are phasing these out as the market recognizes our incremental value.

Q: Your NRR is 200%. Is this sustainable?
Yes, because our revenue scales with our clients' success. Our growth follows a predictable three-step expansion loop: Land (we start on a single advertiser or app with a base fee), Validate (once we prove a +30% ROAS lift, the client expands Churney's coverage to handle 60%+ of their total account spend), Scale (as the client's ROAS improves, they increase their total ad budget, which directly increases Churney's 2.5% take-rate).

Q: How do you address concerns regarding Revenue Concentration?
Early in our journey, we prioritized "Signal Value" over immediate diversification, leading to concentration in early champions like Leadtech and Codeway. We are now executing a "Parent Group" strategy with Pixocial, HubX and Teknasyon, which will naturally diversify our revenue base as these multi-app deals mature throughout 2026.

Q: How capital-efficient is the business currently?
Highly. We reached $2.7M ARR with a GTM team of only two people handling all sales until late 2025. Our CAC remains exceptionally low because we have an "unpaid sales force": the ad platforms themselves. Google, Meta and TikTok frequently bring us into their largest accounts because when we improve a client's ROAS, that client spends more on their platform.

III. Technology and Methodology Deep Dive

Q: Is "Causal AI" just a buzzword?
No. Standard propensity models look for correlations. Our Causal AI ranks users based on predicted long-term behavior and is constantly re-trained to account for audience shifts. This feedback loop is the core technical challenge that prevents "signal drift" (the biggest killer of in-house models, and where our R&D is strongest).

Q: How do you handle external shocks (e.g. COVID, seasonality, macro trends)?
Our core ad optimization is relative, not absolute. Our signals differentiate the value of users at the same point in time. While we use time-based splits to weight recent data, the bidding signal remains robust because it focuses on identifying which users are 5x more valuable than others today, regardless of the macro environment.

IV. Operational Lessons and Specific Cases

Q: Why did some early Meta pilots (Ilyon, Modivo) not convert?
We have been intellectually honest about our pivot away from Gaming due to two specific technical hurdles: IAP (In-App Purchase) games - most IAP games rely on "whales" customers which are notoriously difficult to model, and for whom it is extremely expensive to prove an impact with statistical significance. IAA (In-App Advertising) games - The correlation between early users revenue and late revenue is extremely high. Ad Network Limitations: Gaming companies rely heavily on AppLovin advertising (Applovin has 40-50% market share in gaming advertising), which does not yet support the pLTV signals we generate.

Q: Why are certain companies on a fixed fee (e.g. Zapier) and therefore with relatively low ARR?
Some were strategic "Signal Value" deals. The credibility of winning a brand like Zapier in the B2B SaaS market was worth the initial discount. We are now "maturing out" of these early deals as our category leadership is established. We will be moving them towards success based pricing by end of 2026.

V. Financials and The Ask

Q: What is the primary use of the Series A capital?
Execution speed on productization, GTM, and technical expansion to GenAI. Currently, lead volume (inbound/ad platforms) exceeds our manual onboarding capacity. To resolve this, we are deploying capital into Engineering and Product to automate the integration layer (Client Data Warehouse -> Churney -> Ad Platform). This automation is essential for sustaining our growth trajectory. Simultaneously, we are scaling GTM resources across sales, partnerships, and marketing. Lastly, we will devote significant resources to expanding our offering to the fine-tuning of Generative AI systems.

Q: What is the current Cap Table status?
Our cap table is clean. In addition to primary equity holders, we have a 5% SAFE from 2023 and a $2M SAFE from TLV Partners with a 15% discount. We have addressed historical concerns regarding Danish legal/tax counsel to ensure we are "Series A ready" for institutional due diligence.`;

const CONTRACTS_LIST = `CHURNEY CONTRACT LIST - Active and Historical Contracts

ACTIVE CONTRACTS (ongoing):
Pixa - Start: 13.02.26 - Status: ongoing
Babbel - Start: 3.26 - Status: ongoing
Leadtech Group - Translator Go - Start: 10.11.25 - Status: ongoing
Leadtech Group - Video Up - Start: 10.11.25 - Status: ongoing
Leadtech Group - Scanshot - Start: 10.11.25 - Status: ongoing
Leadtech Group - QR Now - Start: 25.09.25 - Status: ongoing
Leadtech Group - AI Cleaner - Start: 17.03.25 - Status: ongoing
Codeway - Cleanup - Start: 12.10.23 - Status: ongoing
Codeway - Drama Pops - Start: 03.12.25 - Status: ongoing
Codeway - Learna - Start: 03.12.25 - Status: ongoing
Codeway - Retake - Start: 13.10.25 - Status: ongoing
Codeway - IQ Masters - Start: 06.01.26 - Status: ongoing
HubX - TunesAI - Start: 05.11.25 - Status: ongoing
HubX - Nova - Start: 13.08.25 - Status: ongoing
Headway - Start: 09.07.25 - Status: ongoing
Zapier - Start: 11.07.24 - Status: ongoing
Podimo - Start: 24.03.22 - Status: ongoing
Supersonic - Screwmaster - Start: 15.08.25 - Status: ongoing
Stillfront - Bytro WWIII - Start: 05.09.25 - Status: ongoing
Manychat - Start: 01.05.25 - Status: ongoing
River Game - Top War - Start: 01.11.25 - Status: ongoing
River Game - Top Heroes - Start: 01.11.25 - Status: ongoing
Pixocial - Airbrush - Start: 18.02.25 - Status: ongoing
Pixocial - Beauty Plus - Start: 18.02.25 - Status: ongoing
Trading Point - Start: 20.03.24 - Status: ongoing
Underoutfit - Start: 15.08.24 - Status: ongoing
Lessmore - We Are Warriors - Start: 01.07.25 - Status: ongoing
Lessmore - Forge Master - Start: 01.07.25 - Status: ongoing
Lessmore - Eatventure - Start: 10.06.24 - Status: ongoing
Teaching.com - Start: 15.09.25 - Status: ongoing
Sostrene Grene - Start: 27.03.23 - Status: ongoing
Teknasyon - Videa - Start: 23.05.23 - Status: ongoing
Teknasyon - 2nd app - Start: 26.01.26 - Status: ongoing
Teknasyon - 3rd app - Start: 26.01.26 - Status: ongoing
Scandinavian Biolabs - Start: 18.10.24 - Status: ongoing
Smol - Start: 10.01.24 - Status: ongoing
Beer52.com - Start: 18.07.23 - Status: ongoing
Diet Doctor - Start: 27.10.25 - Status: ongoing
ReciMe - Start: 30.10.25 - Status: ongoing
Jatapp - Start: 02.12.25 - Status: ongoing
Los Angeles Apparel - Start: 29.09.25 - Status: ongoing
Mobiversite - Donna - Start: 09.12.25 - Status: ongoing
Kamee - Start: 07.01.25 - Status: ongoing
Faire - Start: 01.07.25 - Status: ongoing
SevenApps - FaceAI - Start: 16.07.25 - Status: ongoing

ENDED/CHURNED CONTRACTS:
Codeway - WordVoyage - Start: 01.06.25 - End: 26.01.26
Rootsbyga - Start: 01.03.25 - End: 31.12.25
Plummy Games - Start: 05.02.25 - End: 11.02.26
Strawberry - Start: 04.09.25 - End: 31.12.25
DoorLoop - Start: 09.06.25 - End: 16.12.25
Asana Rebel - Visual Mind - Start: 01.08.25 - End: 20.10.25
Asana Rebel - Filterly - Start: 01.07.25 - End: 20.10.25
LPP - Start: 28.07.25 - End: 13.11.25
Dream Games - Start: 20.12.24 - End: 29.09.25
ReasonLabs - Start: 10.11.24 - End: 21.07.25
Pocket FM - Start: 09.12.24 - End: 20.06.25
Modivo - Start: 04.10.24 - End: 20.06.25
SevenApps - VideoAI - Start: 11.11.24 - End: 20.06.25
Ilyon - Start: 26.09.24 - End: 23.05.25
Pundit - Start: 07.08.24 - End: 06.06.25
Mindvalley - Start: 23.05.23 - End: 07.03.25
Burny Games - Start: 27.11.23 - End: 03.01.25
Trophy Games - Start: 15.11.22 - End: 30.08.24`;

const REVENUE_PIPELINE = `CHURNEY REVENUE PIPELINE - Pilots and Sales Pipeline

EXPECTED REVENUE IN 12 MONTHS:
Total Expected ARR: $3,643,830
Total Expected MRR: $303,653
  - In Pilot: ARR $1,617,000 | MRR $134,750
  - In Sales Process: ARR $2,026,830 | MRR $168,903

CUSTOMERS CURRENTLY IN PILOT:
Babbel | Vertical: Consumer Apps | Months in Pilot: 5 | Expected Conversion: 75% | Expected MRR: $45,000 | Ad Spend %: 2.5% | Minimum: $12,000 | Monthly Ad Spend: $10M | Deal Source: Outbound (agency) | Notes: Agreed to case study and become an ambassador pending successful pilot
Manychat | Vertical: SaaS | Months in Pilot: 4 | Expected Conversion: 75% | Expected MRR: $10,000 | Ad Spend %: 1.75% | Minimum: $8,000 | Monthly Ad Spend: $1M | Deal Source: Inbound
Teaching.com | Vertical: Consumer Apps | Months in Pilot: 2 | Expected Conversion: 75% | Expected MRR: $18,000 | Ad Spend %: 1% | Minimum: $9,000 | Monthly Ad Spend: $1M | Deal Source: Inbound | Notes: Studio with potential for 2 additional apps
Diet Doctor | Vertical: Consumer Apps | Months in Pilot: 2 | Expected Conversion: 75% | Expected MRR: $8,000 | Ad Spend %: 2.5% | Minimum: $8,000 | Monthly Ad Spend: $300K | Deal Source: Outbound (in-house) | Notes: Agreed to case study
ReciMe | Vertical: Consumer Apps | Months in Pilot: 2 | Expected Conversion: 75% | Expected MRR: $20,000 | Ad Spend %: 2% | Minimum: $8,000 | Monthly Ad Spend: $1.5M | Deal Source: Ad Platform Intro | Notes: Agreed to case study
Jatapp | Vertical: Consumer Apps | Months in Pilot: 3 | Expected Conversion: 75% | Expected MRR: $15,000 | Ad Spend %: 1.5% | Minimum: $10,000 | Monthly Ad Spend: $1.5M | Deal Source: Inbound | Notes: Studio with potential for 3 additional apps
Supersonic | Vertical: Gaming | Months in Pilot: 3 | Expected Conversion: 40% | Expected MRR: $15,000 | Ad Spend %: n/a | Monthly Ad Spend: $10M | Deal Source: Ad Platform Intro | Notes: Studio with potential for 3 additional apps
Stillfront | Vertical: Gaming | Months in Pilot: 2 | Expected Conversion: 50% | Expected MRR: $20,000 | Ad Spend %: 2.5% | Minimum: $11,000 | Monthly Ad Spend: $10M | Deal Source: Outbound (in-house) | Notes: Studio with potential for 7 additional apps
Mobiversite | Vertical: Consumer Apps | Months in Pilot: 3 | Expected Conversion: 70% | Expected MRR: $15,000 | Ad Spend %: 2.5% | Minimum: $10,000 | Monthly Ad Spend: $1M | Deal Source: Outbound (in-house) | Notes: Studio with potential for 1 additional app
Pixa | Vertical: Consumer Apps | Months in Pilot: 5 | Expected Conversion: 75% | Expected MRR: $15,000 | Ad Spend %: 2% | Minimum: $8,000 | Deal Source: Inbound | Notes: Agreed to case study
Kamee | Vertical: E-comm | Months in Pilot: 4 | Expected Conversion: 50% | Expected MRR: $20,000 | Ad Spend %: 2.5% | Minimum: $10,000 | Monthly Ad Spend: $1M | Deal Source: Ad Platform Intro`;

const PRODUCT_USAGE = `CHURNEY PRODUCT USAGE AND CLIENT AD SPEND DATA

CLIENT AD SPEND (Last 30 Days on Churney-integrated platforms):
Leadtech: $4.4M last 30D | Estimated: +$15M/month
Codeway: $5.3M last 30D | Estimated: +$30M/month
Pixocial: $0.6M last 30D | Estimated: +$3M/month
Underoutfit: $2.5M last 30D | Estimated: +$3M/month
Zapier: $1.2M last 30D | Estimated: +$2.5M/month
HubX: $1.2M last 30D | Estimated: +$20M/month
Lessmore: $0.9M last 30D | Estimated: +$15M/month
Teaching.com: $1.1M last 30D | Estimated: +$2M/month
ReciMe: $0.9M last 30D | Estimated: +$3M/month
Scandinavian Biolabs: $0.5M last 30D | Estimated: +$1M/month
Sostrene Grene: $1.5M last 30D | Estimated: +$2M/month
Smol: $0.5M last 30D | Estimated: +$0.7M/month
Los Angeles Apparel: $0.5M last 30D | Estimated: +$0.5M/month
Teknasyon: $0.9M last 30D | Estimated: +$3M/month
Trading Point: $3M last 30D | Estimated: +$4M/month
River Game: Currently $0M (onboarding) | Estimated: +$15M/month
Beer52.com: Currently $0M | Estimated: +$0.250M/month
Podimo: Currently $0M | Estimated: +$0.7M/month

CHURNEY OPTIMIZED AD SPEND BY MONTH:
Feb 2026 (up to Feb 13): Google $382K | Meta $1.08M | TikTok $48K | TOTAL $3.02M optimized | MRR $250,000 | Take-rate on clients total ad spend: 1.6%
Jan 2026: Google $800K | Meta $2.72M | TikTok $70K | TOTAL $3.59M optimized | MRR $237,325 | Take-rate: 1.2%
Dec 2025: Google $686K | Meta $2.83M | TikTok $33K | TOTAL $3.55M optimized | MRR $224,312 | Take-rate: 1.4%
Nov 2025: Google $609K | Meta $1.35M | TikTok $6K | TOTAL $1.97M optimized | MRR $186,360 | Take-rate: 1.6%
Oct 2025: Google $530K | Meta $899K | TOTAL $1.43M optimized | MRR $126,620 | Take-rate: 1.2%
Sep 2025: Google $438K | Meta $858K | TOTAL $1.30M optimized | MRR $99,100 | Take-rate: 1.1%
Aug 2025: Google $476K | Meta $408K | TOTAL $884K optimized | MRR $81,435 | Take-rate: 0.8%
Jul 2025: Google $520K | Meta $173K | TOTAL $693K optimized | MRR $47,900 | Take-rate: 0.7%
Jun 2025: Google $508K | Meta $159K | TOTAL $667K optimized | MRR $50,400 | Take-rate: 0.6%
May 2025: Google $333K | Meta $80K | TOTAL $414K optimized | MRR $38,000 | Take-rate: 0.5%
Apr 2025: Google $188K | Meta $71K | TOTAL $260K optimized | MRR $43,900 | Take-rate: 0.6%
Mar 2025: Google $112K | Meta $55K | TOTAL $167K optimized | MRR $56,500 | Take-rate: 1.0%

TOTAL CLIENT AD SPEND BY MONTH:
Jan 2026: Google $4.73M | Meta $14.49M | TikTok $460K | Total $19.68M | Portfolio (incl. Pilots) $27.02M
Dec 2025: Google $3.85M | Meta $11.59M | TikTok $171K | Total $15.61M | Portfolio $20.73M
Nov 2025: Google $3.80M | Meta $8.03M | TikTok $95K | Total $11.93M | Portfolio $17.18M
Oct 2025: Google $3.69M | Meta $6.95M | Total $10.64M | Portfolio $15.21M
Sep 2025: Google $2.52M | Meta $6.49M | Total $9.01M | Portfolio $14.48M
Aug 2025: Google $2.48M | Meta $7.32M | Total $9.79M | Portfolio $14.96M`;

const FINANCIAL_MODEL_SUMMARY = `CHURNEY ROUND A FINANCIAL MODEL - EXECUTIVE SUMMARY

PROJECTIONS BY FISCAL YEAR:
                    FY 2025      FY 2026       FY 2027
MRR:               $224,312     $863,646      $3,288,955
ARR:             $2,691,744  $10,363,750     $39,467,461
# Clients:               16           42              147
YoY Growth:           4.57x        3.85x           3.81x
Gross Margin (Clients): 72%          88%              90%
NRR:                   209%         207%             180%
CAC Payback:           n/a          5.7              4.7
FTE (End of Period):     20           65               99
Burn Rate:       -$2,028,000  -$5,989,822    -$3,016,011
Cash (End of Period): $1,590,000  $11,900,178    $8,884,167

KEY METRICS:
- FY 2025 ARR: $2.7M (actual, reached with 2-person GTM team)
- FY 2026 ARR target: $10.4M (3.85x growth)
- FY 2027 ARR target: $39.5M (3.81x growth)
- Burn rate FY 2025: $2M (highly capital efficient)
- Burn rate FY 2026 (with Series A): $6M
- NRR 200%+ means existing clients more than double their spend with Churney year over year
- Gross margin improving from 72% to 88% to 90% as business scales
- Series A capital needed to fund FY 2026 growth from $2.7M to $10.4M ARR`;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding database with Google Drive document content...\n");

  const docs = [
    {
      filePath: "Churney Technical Overview.gdoc",
      text: TECHNICAL_OVERVIEW,
    },
    {
      filePath: "Churney – Series A Investor FAQ.gdoc",
      text: SERIES_A_FAQ,
    },
    {
      filePath: "Financial reports/Churney_Revenue - Contracts.gsheet",
      text: CONTRACTS_LIST,
    },
    {
      filePath: "Churney_Current Revenue Pipeline.gsheet",
      text: REVENUE_PIPELINE,
    },
    {
      filePath: "Financial reports/Churney_product usage & take-rate.gsheet",
      text: PRODUCT_USAGE,
    },
    {
      filePath: "Financial reports/Churney_Round A Financial Model.gsheet",
      text: FINANCIAL_MODEL_SUMMARY,
    },
  ];

  for (const doc of docs) {
    process.stdout.write(`  ${doc.filePath} … `);
    const count = await upsert(doc.filePath, doc.text);
    console.log(`${count} chunks`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
