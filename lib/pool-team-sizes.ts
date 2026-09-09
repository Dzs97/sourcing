// Estimated software-engineering team size per pool.
//
// Rules of thumb applied consistently below:
//   • For companies: SWE-only headcount. Excludes hardware/chip engineers,
//     ML researchers, PMs, designers, ops, sales, non-tech staff. When a
//     company has hardware or manufacturing as a big fraction (Apple,
//     NVIDIA, Tesla, SpaceX), SWE is a small slice of total headcount.
//   • For universities: current CS + closely-adjacent-major undergrads
//     across all four years. This is the pool the sourcer can realistically
//     reach at any given moment (not lifetime alumni).
//   • For research labs: active researchers + PhD students + eng staff.
//
// Numbers are rounded to nice figures per Diego's guidance (512 → 500,
// 24 → 20, 1121 → 1100). All keys are the CANONICAL name from
// POOL_ALIASES so lookups work after the alias merge.
//
// Top-50 by sourced-count carefully researched (2026-09-08 pass). Long tail
// below is best-effort. Regenerate/extend when a company's size changes
// materially.

export const POOL_TEAM_SIZES: Record<string, number> = {
  // ═════ TOP 50 by sourced count (canonical names) ═════

  // 1. Meta — ~78k total. SWE (product + infra + ML SWE): ~25k. Excludes
  //    UX researchers, PMs, hardware (Reality Labs). Facebook + Instagram
  //    fold in here via alias.
  "Meta": 25000,

  // 2. Palantir — ~4700 total. Split: FDEs ~800, Foundry SWE ~800,
  //    core software SWE ~600. Rounded to ~1500 SWE.
  "Palantir": 1500,

  // 3. Google — ~185k total. Eng ~55k of which SWE-titled ~35k
  //    (excludes SRE, hardware, quant/research).
  "Google": 35000,

  // 4. MIT — CS undergrads ~800 across 4 years + EECS ~700, plus graduate
  //    CS/EE ~500. Addressable undergrad+grad ~1500.
  "MIT": 1500,

  // 5. Databricks — ~7500 total. Eng ~3000, SWE ~2000 (rest are ML
  //    researchers + data eng + solutions).
  "Databricks": 2000,

  // 6. OpenAI — ~4000 total (late 2025). Split: research ~800, SWE ~1500,
  //    remainder ops/product/GTM.
  "OpenAI": 1500,

  // 7. Waterloo — ~4000 CS + Software Eng + CE undergrads across all
  //    years (huge co-op program feeds heavily into US tech). Includes
  //    the ~1200 SE/CE cohort separate from CS majors.
  "Waterloo": 4000,

  // 8. Robinhood — ~3000 total. Eng ~1200, SWE ~1000.
  "Robinhood": 1000,

  // 9. Amazon — ~1.5M total (mostly logistics). Global SWE ~30k
  //    (Retail + Alexa + Ads + Prime Video + subsidiaries; AWS below).
  "Amazon": 30000,

  // 10. Tesla — ~140k total but mostly manufacturing. Autopilot ~3000 +
  //     Vehicle Software ~1500 + Charging/Grid SW ~500 = ~5000 SWE.
  "Tesla": 5000,

  // 11. Princeton — CS undergrads ~500 across 4 years plus ~100 grad. 600.
  "Princeton": 600,

  // 12. xAI — ~1500 total, mostly technical. SWE (not research) ~800.
  "xAI": 800,

  // 13. Anduril — ~7000 total (grew fast). Split: hardware ~3500,
  //     software eng ~1500, GTM/ops ~2000.
  "Anduril": 1500,

  // 14. AWS — subset of Amazon at ~120k. SWE ~20k (services + infra).
  "AWS": 20000,

  // 15. Figma — ~2000 total. Eng ~900, SWE ~750.
  "Figma": 750,

  // 16. Anthropic — ~1500 total (late 2025). Research ~400, SWE ~700
  //     (product, infra, applied ML), remainder policy/ops/GTM.
  "Anthropic": 700,

  // 17. Bloomberg — ~21k total. Eng ~8k, SWE ~6k (Terminal + backend).
  "Bloomberg": 6000,

  // 18. Jane Street — ~3000 total. Tech ~1800 (mix). Pure SWE (not
  //     quant researchers) ~1000.
  "Jane Street": 1000,

  // 19. Applied Intuition — ~1000 total. Eng ~600, SWE ~500.
  "Applied Intuition": 500,

  // 20. Ramp — ~1200 total. Eng ~700, SWE ~500.
  "Ramp": 500,

  // 21. Apple — ~165k total. Eng ~30k (majority hardware/silicon).
  //     Pure SWE ~15k (Services, OS, apps, ML platforms).
  "Apple": 15000,

  // 22. SAIL — Stanford AI Lab. ~500 active (faculty + PhDs + postdocs
  //     + eng staff across affiliated groups).
  "SAIL": 500,

  // 23. UIUC — CS + CS+X undergrads ~2500 + grads ~500 = 3000.
  "UIUC": 3000,

  // 24. Harvard — CS undergrads ~450 across 4 years, plus ~100 grad. 550.
  "Harvard": 550,

  // 25. Stripe — ~9000 total. Eng ~4000, SWE ~3000.
  "Stripe": 3000,

  // 26. Microsoft — ~230k total. Eng ~90k, SWE ~50k (excludes CX, ops,
  //     sales). Azure + Copilot + Office + Windows.
  "Microsoft": 50000,

  // 27. Rippling — ~3500 total. Eng ~1500, SWE ~1200.
  "Rippling": 1200,

  // 28. Glean — ~600 total. Eng ~350, SWE ~300.
  "Glean": 300,

  // 29. Scale AI — ~1500 total (excluding contractors). Eng ~800, SWE ~600.
  "Scale AI": 600,

  // 30. Waymo — ~2500 total. Eng ~1500, SWE ~1200 (excludes hardware +
  //     research scientists).
  "Waymo": 1200,

  // 31. Stanford — CS undergrads ~1200 + CS/EE grad ~800 = 2000.
  "Stanford": 2000,

  // 32. Uber — ~30k total. Eng ~7000, SWE ~5000.
  "Uber": 5000,

  // 33. BAIR — Berkeley AI Research. ~400 active researchers + PhD.
  "BAIR": 400,

  // 34. Cornell — CIS + CS undergrads ~1500 across 4 years, plus grad ~300.
  "Cornell": 1500,

  // 35. Yale — CS undergrads ~350 across 4 years, small grad program. 400.
  "Yale": 400,

  // 36. Citadel — ~4600 total across Citadel + Citadel Securities.
  //     Tech ~1500, SWE ~1000 (rest are quant researchers).
  "Citadel": 1000,

  // 37. SpaceX — ~13k total, majority hardware/manufacturing. SW eng
  //     ~2000 (Starlink, Dragon avionics, ground software).
  "SpaceX": 2000,

  // 38. Snowflake — ~7500 total. Eng ~3000, SWE ~2500.
  "Snowflake": 2500,

  // 39. NVIDIA — ~35k total. Chip design ~15k, driver + CUDA + DGX SW
  //     ~5000, robotics/AV software ~2000. Total SWE ~5000.
  "NVIDIA": 5000,

  // 40. Notion — ~800 total. Eng ~400, SWE ~350.
  "Notion": 350,

  // 41. Google DeepMind — ~5000 total. Research heavy. SWE (not
  //     researchers) ~2000.
  "Google DeepMind": 2000,

  // 42. TikTok — global engineering ~15k. US-focused SWE more like ~8k.
  //     Using global-facing number since sourcing includes offshore.
  "TikTok": 8000,

  // 43. Columbia — CS undergrads + SEAS ~1200 + grads ~300 = 1500.
  "Columbia": 1500,

  // 44. Roblox — ~2500 total. Eng ~1500, SWE ~1200.
  "Roblox": 1200,

  // 45. UChicago — CS undergrads ~500 (smaller than the T5 peers).
  "UChicago": 500,

  // 46. Northwestern — CS undergrads ~600 across 4 years.
  "Northwestern": 600,

  // 47. DoorDash — ~15k total. Eng ~3500, SWE ~2500.
  "DoorDash": 2500,

  // 48. Perplexity — ~200 total, most technical. SWE ~150.
  "Perplexity": 150,

  // 49. Coinbase — ~4500 total. Eng ~2000, SWE ~1500.
  "Coinbase": 1500,

  // 50. UPenn — CS undergrads + CIS ~800 + grads ~200 = 1000.
  "UPenn": 1000,

  // ══════ Long tail — earlier best-effort estimates ══════

  // Foundation labs
  "Mistral AI": 200,
  "Cohere": 400,
  "Character.AI": 50,
  "Thinking Machines Lab": 100,
  "World Labs": 80,
  "Liquid AI": 120,
  "SambaNova Systems": 300,
  "Reka": 60,
  "Inflection": 30,
  "Microsoft AI": 1500,
  "SpaceXAI": 50,

  // Big tech tail
  "Netflix": 3000,
  "ByteDance": 25000,
  "Snap Inc.": 1500,
  "LinkedIn": 5000,
  "Salesforce": 10000,
  "Slack": 2000,
  "ServiceNow": 6000,
  "Adobe": 7000,
  "Cisco": 8000,
  "Atlassian": 3500,
  "Dropbox": 1000,
  "HubSpot": 2000,
  "Intuit": 5000,
  "Spotify": 2500,
  "X": 1000,
  "Oracle": 25000,
  "IBM": 25000,
  "Veeva Systems": 2000,
  "Twitch": 1500,
  "YouTube": 4000,

  // AI startups
  // Mercor grew fast in 2025 — closer to ~250 now (was 100).
  "Mercor": 250,
  "Decagon": 50,
  "Sierra": 100,
  "Cognition": 50,
  "Harvey": 150,
  "Codeium": 100,
  "Cursor": 150,
  "Anyscale": 200,
  "Together AI": 150,
  "Etched": 40,
  "Cartesia": 60,
  "Suno": 80,
  "Nooks": 80,
  "Moveworks": 500,
  "Clay": 100,
  "LangChain": 80,
  "EliseAI": 200,
  "Snorkel AI": 100,
  "Rox": 40,
  "Nominal": 50,
  "Actively AI": 30,
  "Rogo": 40,
  "Resolve AI": 30,
  "Baseten": 50,
  "Factory": 30,
  "HeyGen": 100,
  "Otter.ai": 150,
  "Tennr": 40,
  "InstaLILY AI": 20,
  "Watershed": 200,
  "Magic": 30,
  "Fireworks AI": 80,
  "Chalk": 60,
  "Reve": 30,
  "Arize AI": 100,
  "DatologyAI": 40,
  "Doppel": 50,
  "Serval": 20,
  "Salient": 30,
  "Distyl AI": 40,
  "Abacus.AI": 150,
  "Augment Code": 100,
  "Transluce": 30,
  "Goodfire": 30,
  "Pika": 40,
  "Vultron": 30,
  "Hebbia": 150,
  "Tavus": 50,
  "ElevenLabs": 150,
  "Adept": 30,
  "Physical Intelligence": 50,
  "Applied Compute": 30,
  "Surge AI": 150,
  "Mechanize, Inc.": 40,
  "Latent": 20,
  "David AI": 30,
  "Poetic": 15,
  "AfterQuery": 30,
  "Unify": 40,
  "Traversal": 30,
  "Datacurve": 30,
  "Rilla": 50,
  "Assembled": 100,
  "Profound": 30,
  "Netic": 20,
  "Reevo": 20,
  "OpenEvidence": 60,
  "Listen Labs": 20,
  "Browserbase": 30,
  "Corridor": 20,
  "Adaptive Security": 30,
  "Outtake": 20,
  "Vocara": 20,
  "Medra": 20,
  "Fleet AI, Inc.": 20,
  "Cogent Security": 30,
  "Yuzu": 20,
  "Roadrunner": 30,
  "Silna": 20,
  "Auctor": 20,
  "&AI": 20,
  "Mintlify": 40,
  "Neo": 30,

  // Data / infra tail
  "Datadog": 2500,
  "MongoDB": 1500,
  "Crusoe": 500,
  "Cockroach Labs": 300,
  "Hightouch": 100,
  "Sigma Computing": 200,
  "C3 AI": 400,
  "Fastly": 500,
  "Nutanix": 3000,
  "InterSystems": 2000,
  "Vanta": 400,
  "Vectra AI": 300,
  "Palo Alto Networks": 5000,
  "Rubrik": 1500,
  "Okta": 2500,
  "Semgrep": 100,
  "Abnormal AI": 200,
  "Fluidstack": 100,
  "Moloco": 400,

  // Devtools tail
  "Vercel": 250,
  "Retool": 200,
  "Airtable": 400,
  "Replit": 80,
  "Warp": 50,
  "Sentry": 250,
  "Coda": 150,
  "Webflow": 500,
  "Superhuman": 80,
  "Merge": 200,
  "Gem": 200,
  "Loop": 100,
  "Klaviyo": 600,

  // Fintech tail
  "Brex": 500,
  "Plaid": 700,
  "Wealthfront": 150,
  "Affirm": 800,
  "Block": 5000,
  "Square": 5000,
  "Chime": 400,
  "Zip": 200,
  "Parafin": 100,
  "Kikoff": 200,
  "Kalshi": 80,
  "Valon": 500,
  "Cedar": 500,
  "Capital One": 15000,
  "BlackRock": 5000,
  "Goldman Sachs": 15000,
  "JPMorganChase": 50000,
  "AppLovin": 700,
  "Circle": 400,
  "Addepar": 300,
  "Basis": 30,

  // Trading tail
  "Citadel Securities": 1200,
  "Hudson River Trading": 400,
  "Two Sigma": 800,
  "Optiver": 600,
  "Five Rings": 150,
  "IMC Trading": 500,
  "Jump Trading Group": 500,
  "DRW": 500,
  "Radix Trading LLC": 100,
  "The Voleon Group": 80,
  "Millennium": 1000,
  "Point72": 500,
  "Susquehanna International Group": 700,

  // Robotics tail
  "Cruise": 500,
  "Zoox": 1000,
  "Aurora": 800,
  "Nuro": 400,
  "WeRide": 400,
  "Rivian": 2500,
  "Waabi": 150,
  "Viam": 100,
  "Gecko Robotics": 200,

  // Defense tail
  "Blue Origin": 4000,
  "Neuralink": 300,
  "MIT Lincoln Laboratory": 4000,

  // Research labs tail
  "Arc Institute": 150,
  "CSAIL": 1500,
  "Stanford HAI": 100,

  // Universities tail
  "Duke": 500,
  "Brown": 400,
  "Georgia Tech": 3000,
  "UT Austin": 2500,
  "UC Berkeley": 3000,
  "CMU": 3500,             // CMU CS is massive: undergrad + huge SCS grad program
  "NYU": 1500,

  // Consumer tail
  "Airbnb": 2000,
  "Lyft": 1000,
  "Discord": 400,
  "Reddit": 800,
  "Pinterest": 1500,
  "Strava": 250,
  "Whatnot": 300,
  "Patreon": 200,
  "Duolingo": 400,
  "Handshake": 150,
  "IXL Learning": 500,
  "Epic": 2000,
  "Nourish": 200,

  // Health tech tail
  "Genesis Therapeutics": 150,
  "Benchling": 300,
  "Brain Co.": 200,

  // ═════════════════════════════════════════════════════════════
  // Pools 51-150 additions (2026-09-08 careful pass)
  // ═════════════════════════════════════════════════════════════

  // Companies
  "Modal": 100,             // AI infra startup — small elite team
  "Verkada": 500,          // Enterprise cameras/security. ~2000 total, ~800 eng, ~500 SWE
  "Coca-Cola": 500,        // Massive company but tech is small; Freestyle IoT + digital ~500 SWE
  "Quora": 80,             // Small; ~200 total, ~80 SWE (Poe team lifts this)
  "Persona": 100,          // Identity verification; ~500 total, ~200 eng, ~100 SWE

  // Universities (CS undergrads across 4 years, + grad)
  "U. Toronto": 2500,      // Large CS program, huge Vector Institute pipeline
  "Rice": 400,             // Small elite; CS ~350 + grad ~50
  "Williams": 150,         // Small liberal arts college; CS ~120-150
  "Johns Hopkins": 500,    // CS ~400 + grad ~100
  "Amherst": 120,          // Small liberal arts; CS ~100
  "Dartmouth": 300,        // CS ~250 + grad ~50

  // Top STEM high schools (total enrollment — these are magnet
  // schools where nearly all students are technical)
  "The Harker School": 200,  // Bay Area private, ~750 students, ~200 heaviest-STEM
  "Lynbrook": 500,           // Cupertino public, ~1800 students, ~500 heaviest CS
  "TJ": 1900,                // Thomas Jefferson HSST, all STEM ~1900
  "Stuy": 3300,              // Stuyvesant HS NYC, all STEM ~3300

  // Research institutes
  "Vector Institute": 150,   // Toronto AI research institute; researchers + PhDs
  "Broad": 400,              // Broad Institute — MIT/Harvard genomics; ~1500 total, ~400 computational

  // More universities
  "UCLA": 1500,              // Large public CS program, undergrad + grad
  "IMSA": 650,
  "Bronx High School": 3000,     // Bronx Science — top NYC STEM HS               // Illinois Math & Science Academy — top STEM HS, ~650 students

  // Missed AI startups
  "Anysphere": 150,          // Cursor's parent org (aliases would make these one)
  "Windsurf": 100,           // AI IDE company

  // ═════════════════════════════════════════════════════════════
};
