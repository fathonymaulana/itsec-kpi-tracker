// One-time seed for the Supabase project. Run manually — never on app boot/cold start:
//   node --env-file=.env.local scripts/seed.mjs
//
// Ports the exact department/KPI/sub-metric data that used to live in server/db.js (now deleted),
// including the per-sub-metric numeric_target/direction and the CorCom "Media Share of Voice" A/B fix.
//
// Login PINs live in scripts/seed-pins.json (gitignored — these are real credentials, never commit
// them). Copy scripts/seed-pins.example.json to scripts/seed-pins.json and fill in real values first.
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/seed.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const pinsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-pins.json')
let pins
try {
  pins = JSON.parse(readFileSync(pinsPath, 'utf8'))
} catch {
  console.error(`Missing ${pinsPath}. Copy scripts/seed-pins.example.json to scripts/seed-pins.json and fill in the real PINs first.`)
  process.exit(1)
}

const depts = [
  { id: 'CorCom',             name: 'CorCom' },
  { id: 'CorSec',             name: 'CorSec' },
  { id: 'FAT',                name: 'FAT' },
  { id: 'HR_GA',              name: 'HR & GA' },
  { id: 'Internal_Audit',     name: 'Internal Audit' },
  { id: 'Investor_Relations', name: 'Investor Relations' },
  { id: 'Partner_Manager',    name: 'Partner Manager' },
  { id: 'PMO',                name: 'PMO' },
  { id: 'RD',                 name: 'R & D' },
  { id: 'Sales',              name: 'Sales' },
  { id: 'SecOps',             name: 'SecOps' },
  { id: 'Technical_Writer',   name: 'Technical Writer' },
].map(d => ({ ...d, pin: pins.departments[d.id] }))

const roles = [
  { role_key: 'corp_planning', display_name: 'Corporate Planning' },
  { role_key: 'board',         display_name: 'Board' },
].map(r => ({ ...r, pin: pins.roles[r.role_key] }))

// Collected by addKpi() below — same call shape as the old server/db.js so the KPI data itself is an
// unmodified carry-over. sm shape: { name, is_calc?, fk?, pos?, unit?, target?, dir? }. target/dir is this
// specific sub-metric's own numeric target + direction (per-row, not per-KPI), exactly as defined in the
// source spreadsheet's Monthly_Performance sheet — undefined means a pure feeder input with no individually
// tracked target (no status shown for it in the UI). dir=0 is a valid, meaningful value ("review manually"),
// distinct from null/undefined ("not tracked") — always use `?? null`, never `|| null`.
const kpiSeed = []
function addKpi(dept_id, kpi_name, target_text, numeric_target, direction, frequency, sms) {
  kpiSeed.push({ dept_id, kpi_name, target_text, numeric_target, direction, frequency, sms })
}

// ── CorCom ──────────────────────────────────────────────────────────────
addKpi('CorCom','Revenue Contribution (ROAS)','≥ 2x ROAS',2,1,'Quarterly, Annually',[
  {name:'Marketing-Attributed Revenue (IDR)'},
  {name:'Total Marketing Spend (IDR)'},
  {name:'ROAS (Auto-calculated)',is_calc:1,fk:'A/B',unit:'x',target:2,dir:1},
])
addKpi('CorCom','Media Share of Voice (SoV)','≥ 30% SoV',0.30,1,'Monthly',[
  {name:'ITSEC Media Mentions'},
  {name:'Total Competitor Media Mentions'},
  {name:'Share of Voice % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.3,dir:1},
])
addKpi('CorCom','PR Value (Advertising Value Equivalency)','≥ 5x AVE vs. comms spend',5,1,'Monthly, Annually',[
  {name:'Sum of AVE of Secured Media Placements (IDR)'},
  {name:'Total Communications Spend (IDR)'},
  {name:'AVE Ratio (Auto-calc)',is_calc:1,fk:'A/B',unit:'x',target:5,dir:1},
])
addKpi('CorCom','Government & Regulatory Relationship Index','≥ 3 meetings/quarter; ≥ 20% partnership conversion',3,1,'Quarterly',[
  {name:'(1) No. of Formal Govt/Regulatory Meetings',target:3,dir:1},
  {name:'(2) No. of Partnerships / MOUs Secured'},
  {name:'Partnership Conversion Rate % (Auto-calc)',is_calc:1,fk:'B/A',unit:'%',target:0.2,dir:1},
])
addKpi('CorCom','Strategic Partnership Initiative','≥ 4 formal partnership agreements/year',4,1,'Quarterly, Annually',[
  {name:'(1) No. of Partnership Agreements / MOUs Signed',target:4,dir:1},
  {name:'(2) No. of Qualified Leads from Partnership Programs',target:100,dir:1},
  {name:'(3) Pipeline Value from Partnership Leads (IDR)',target:5000000000,dir:1},
])
addKpi('CorCom','Corporate Social Media Performance','≥ 5% monthly follower growth',0.05,1,'Monthly',[
  {name:'(1) LinkedIn Followers — End of Period'},
  {name:'(1) LinkedIn Followers — Start of Period'},
  {name:'(1) LinkedIn Follower Growth Rate % (Auto-calc)',is_calc:1,fk:'(A-B)/B',unit:'%',target:0.05,dir:1},
  {name:'(2) Instagram Followers — End of Period'},
  {name:'(2) Instagram Followers — Start of Period'},
  {name:'(2) Instagram Follower Growth Rate % (Auto-calc)',is_calc:1,fk:'(C-D)/D',unit:'%',target:0.05,dir:1},
  {name:'(3) Organic Reach (Unique Accounts Reached)'},
  {name:'(4) Leads Generated from Digital'},
])
addKpi('CorCom','Internal Communications Adoption Rate','≥ 75% key message recall score',0.75,1,'Quarterly',[
  {name:'No. of Employees Correctly Identifying ≥3 of 5 Key Messages'},
  {name:'Total Survey Respondents'},
  {name:'Key Message Recall Score % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.75,dir:1},
])
addKpi('CorCom','ESG & CSR Impact Index','≥ 1000 unique beneficiaries/year; ≥ 90% program execution',1000,1,'Quarterly, Annually',[
  {name:'(1) No. of Unique Beneficiaries (Women & Children)',target:1000,dir:1},
  {name:'(2) No. of CSR Programs Delivered'},
  {name:'(2) No. of CSR Programs Planned'},
  {name:'Program Execution Rate % (Auto-calc)',is_calc:1,fk:'B/C',unit:'%',target:0.9,dir:1},
])

// ── CorSec ──────────────────────────────────────────────────────────────
addKpi('CorSec','Zero Regulatory Breaches','0 breaches',0,-1,'Monthly, Quarterly, Annually',[
  {name:'No. of Breaches / Incidents Reported by Regulators',target:0,dir:-1},
])
addKpi('CorSec','Corporate Governance Execution','100% completion rate',1,1,'Monthly, Quarterly, Annually',[
  {name:'No. of Meetings Held & Documents Completed'},
  {name:'Total Required Agenda Items'},
  {name:'Completion Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:1,dir:1},
])
addKpi('CorSec','Corporate Compliance & Reporting','100% compliance rate',1,1,'Monthly, Quarterly, Annually',[
  {name:'No. of Timely Reports & Compliance Updates Submitted'},
  {name:'Total Reporting Obligations'},
  {name:'Compliance Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:1,dir:1},
])
addKpi('CorSec','Corporate Secretary Admin & Public Relations','100% completion rate',1,1,'Monthly, Quarterly, Annually',[
  {name:'No. of Documents / Correspondences Completed On Time'},
  {name:'Total Documents / Correspondences Due'},
  {name:'Completion Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:1,dir:1},
])
addKpi('CorSec','Legal Policy & Contract Management','95%–100% SLA compliance',0.95,1,'Monthly',[
  {name:'No. of Legal Documents / Contracts Finalized Within SLA'},
  {name:'Total Legal Documents / Contracts Due'},
  {name:'SLA Compliance Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.95,dir:1},
])
addKpi('CorSec','Risk Management & Audit Compliance','100% CAPA completion rate',1,1,'Annually',[
  {name:'(1) No. of Major Non-Conformities (NC) Found',target:0,dir:-1},
  {name:'(2) No. of Corrective Actions Submitted Within 5 WD'},
  {name:'(2) Total Corrective Actions Required'},
  {name:'CAPA Completion Rate % (Auto-calc)',is_calc:1,fk:'B/C',unit:'%',target:1,dir:1},
])

// ── FAT ─────────────────────────────────────────────────────────────────
addKpi('FAT','Financial Reporting Timeliness','100% on time (≤10 WD)',1,1,'Monthly',[
  {name:'No. of Reports Submitted On Time (≤10 WD)'},
  {name:'Total Reports Due'},
  {name:'Timeliness Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:1,dir:1},
])
addKpi('FAT','Financial Accuracy (Cost & Revenue Mapping)','≥ 98–99%',0.98,1,'Monthly',[
  {name:'No. of Validated Transactions'},
  {name:'Total Transactions'},
  {name:'Accuracy Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.98,dir:1},
])
addKpi('FAT','Cash Flow Health','≥ 1.5 OCF ratio',1.5,1,'Monthly',[
  {name:'Operating Cash Flow (IDR)'},
  {name:'Current Liabilities (IDR)'},
  {name:'OCF Ratio (Auto-calc)',is_calc:1,fk:'A/B',unit:'x',target:1.5,dir:1},
])
addKpi('FAT','AR Quality (Collection Discipline)','AR >90 days ≤ 10%',0.10,-1,'Monthly',[
  {name:'AR >90 Days (IDR)'},
  {name:'Total AR (IDR)'},
  {name:'AR >90 Days Ratio % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.1,dir:-1},
])
addKpi('FAT','Audit & Compliance Score','1 (Unqualified); < 5% adjustments',1,1,'Quarterly',[
  {name:'(1) Audit Result (1 = Unqualified, 0 = Qualified)',target:1,dir:1},
  {name:'(2) Audit Adjustments Value (IDR)'},
  {name:'(2) Total P&L (IDR)'},
  {name:'% of Adjustments Required (Auto-calc)',is_calc:1,fk:'B/C',unit:'%',target:0.05,dir:1},
])
addKpi('FAT','Tax Compliance','≥ 95%',0.95,1,'Monthly',[
  {name:'No. of Missing / Late Tax Reports (Excl. Cash Flow Delays)'},
  {name:'Total Tax Reporting Obligations'},
  {name:'Tax Compliance Rate % (Auto-calc)',is_calc:1,fk:'1-(A/B)',unit:'%',target:0.95,dir:1},
])
addKpi('FAT','Compliance with Government Regulations','100%',1,1,'Monthly, Quarterly, Annually',[
  {name:'No. of Regulatory Reports Submitted On Time'},
  {name:'Total Regulatory Reports Due'},
  {name:'Compliance Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:1,dir:1},
])
addKpi('FAT','Providing manpower costing accurately','≥ 95%',0.95,1,'Monthly, Quarterly',[
  {name:'Estimated Manpower Cost (IDR)'},
  {name:'Approved Actual Cost (IDR)'},
  {name:'Accuracy & Timeliness Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.95,dir:1},
])

// ── HR & GA ─────────────────────────────────────────────────────────────
addKpi('HR_GA','Time to fill vacancies','≤ 60 days average',60,-1,'Quarterly',[
  {name:'Total Days to Fill (All Roles Combined)'},
  {name:'No. of Roles Filled'},
  {name:'Average Days to Fill (Auto-calc)',is_calc:1,fk:'A/B',unit:'days',target:60,dir:-1},
])
addKpi('HR_GA','Employee Engagement Response Rate','≥ 85%',0.85,1,'Bi-Annually',[
  {name:'No. of Employees Who Filled the Survey'},
  {name:'Total Active Employees Invited'},
  {name:'Response Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.85,dir:1},
])
addKpi('HR_GA','Key talent attrition','< 5%',0.05,-1,'Quarterly',[
  {name:'No. of Key Talent Who Left'},
  {name:'Total Employees (End of Period)'},
  {name:'Key Talent Attrition Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.05,dir:-1},
])
addKpi('HR_GA','Cost Control','Positive cost variance vs budget',0.05,1,'Quarterly',[
  {name:'HRGA Budgeted Cost (IDR)'},
  {name:'HRGA Actual Cost (IDR)'},
  {name:'Cost Variance % (Auto-calc)',is_calc:1,fk:'(A-B)/A',unit:'%',target:0.05,dir:1},
])
addKpi('HR_GA','90-Day Retention','≥ 80%',0.80,1,'Quarterly',[
  {name:'No. of New Hires Still Employed After 90 Days'},
  {name:'Total New Hires in the Period'},
  {name:'90-Day Retention Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.8,dir:1},
])
addKpi('HR_GA','Smooth HR Operations (Compliance)','Zero errors',0,-1,'Monthly',[
  {name:'No. of Payroll / Tax Calculation Errors Found',target:0,dir:-1},
])

// ── Internal Audit ───────────────────────────────────────────────────────
addKpi('Internal_Audit','Risk Coverage at Internal Audit Plans and Activity','≥ 80% risk area coverage',0.80,1,'Monthly, Quarterly, Annually',[
  {name:'No. of Risk Areas / Processes Covered in Audit Plan'},
  {name:'Total Risk Areas / Processes Identified'},
  {name:'Coverage Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',dir:0},
])
addKpi('Internal_Audit','Internal Audit Plans and Activities (Strategy Management)','6 MoM AC/year; 12 BOD meetings/year; SOP review completed',null,0,'Monthly, Quarterly, Annually',[
  {name:'No. of Annual Plan Submitted Before 31 Dec'},
  {name:'Total Audit Plan Due'},
  {name:'Compliance Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:1,dir:1},
  {name:'No. of AC Meeting MoMs Documented',target:6,dir:1},
  {name:'No. of BOD Meetings Attended',target:12,dir:1},
  {name:'SOP & Risk Rating Review Completed (1=Yes, 0=No)',target:1,dir:1},
])
addKpi('Internal_Audit','Realization of Internal Audit Plan','≥ 6 of 8 entities audited; budget realization ≥ 90%',0.75,1,'Quarterly, Annually',[
  {name:'No. of Entities Audited',target:6,dir:1},
  {name:'No. of Entities Planned for Audit',target:8,dir:1},
  {name:'Plan Realization Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.75,dir:1},
  {name:'Budget Utilized (IDR)'},
  {name:'Budget Planned (IDR)'},
  {name:'Budget Utilization Rate % (Auto-calc)',is_calc:1,fk:'A/B',pos:'3,4',unit:'%',target:1,dir:-1},
])
addKpi('Internal_Audit','Periodic monitoring and follow-up to audit findings','2 follow-ups/year (June, December); ≥ 80% resolution',0.80,1,'Bi-Annually',[
  {name:'No. of Follow-Up Reviews Conducted',target:2,dir:1},
  {name:'No. of Action Plans Resolved'},
  {name:'Total Action Plans Monitored'},
  {name:'Action Plan Resolution Rate % (Auto-calc)',is_calc:1,fk:'B/C',unit:'%',target:1,dir:1},
])
addKpi('Internal_Audit','Significant findings and recommendations','≥ IDR 10M identified; ≥ 1 SOP recommendation',10000000,1,'Monthly, Quarterly',[
  {name:'Total Financial Value of Recovery / Loss Identified (IDR)',target:10000000,dir:1},
  {name:'No. of SOP / Policy Recommendations Issued',dir:0},
])

// ── Investor Relations ───────────────────────────────────────────────────
addKpi('Investor_Relations','Analyst Coverage Expansion (Rated Report)','5–10 rated reports per year',5,1,'Quarterly, Bi-Annually',[
  {name:'No. of Rated Analyst Reports Published',target:5,dir:1},
  {name:'No. of Analyst Meetings Held (Related to Rated Reports)',target:5,dir:1},
])
addKpi('Investor_Relations','Analyst Coverage Expansion (Non-Rated Report)','5–10 non-rated reports per year',5,1,'Quarterly, Bi-Annually',[
  {name:'No. of Non-Rated Analyst Reports Published',target:5,dir:1},
  {name:'No. of Analyst Meetings Held (Related to Non-Rated Reports)',target:5,dir:1},
])
addKpi('Investor_Relations','Corporate Actions','All corporate actions completed on time',null,0,'As needed',[
  {name:'No. of Corporate Actions Completed',dir:0},
  {name:'No. of Regulatory Filings / Responses Submitted',dir:0},
])
addKpi('Investor_Relations','Share Price Monitoring','Responsive shareholder engagement',null,0,'Monthly',[
  {name:'No. of Shareholder Queries Responded To',dir:0},
  {name:'No. of Investor Calls / Roadshows Conducted',dir:0},
])
addKpi('Investor_Relations','Regulatory Reporting','100% on-time disclosures',1,1,'As required',[
  {name:'No. of Disclosures Released On Time',dir:0},
  {name:'Total Regulatory Disclosures Due',dir:0},
  {name:'On-Time Disclosure Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',dir:0},
])

// ── Partner Manager ──────────────────────────────────────────────────────
addKpi('Partner_Manager','Partner Onboarding, Enablement & Engagement','≥ 3 partners/year; ≥ 80% internal enablement; ≥ 5 participations',3,1,'Annually',[
  {name:'No. of Strategic Partners Onboarded & Activated',target:3,dir:1},
  {name:'% of Internal Sales & Technical Teams Enabled on Partner Solutions',target:0.8,dir:1},
  {name:'No. of Partner Participations in Events / Campaigns / Joint Initiatives',target:5,dir:1},
])
addKpi('Partner_Manager','Partner Sponsorship and Value Leverage','≥ USD 250,000 total value per year',250000,1,'Annually',[
  {name:'Total Value of Partner-Contributed Benefits & PM-Sourced Revenue (USD)',target:250000,dir:1},
])
addKpi('Partner_Manager','Partner-Driven Lead Generation','Target TBD by management',null,1,'Annually',[
  {name:'No. of Qualified Leads Generated through Partner Activities',dir:0},
])

// ── PMO ─────────────────────────────────────────────────────────────────
addKpi('PMO','Project Budget Variance','≤ 5% variance',0.05,-1,'Quarterly',[
  {name:'Actual Project Cost (IDR)'},
  {name:'Budgeted Project Cost (IDR)'},
  {name:'Budget Variance % (Auto-calc)',is_calc:1,fk:'(A-B)/B',unit:'%',target:0.05,dir:-1},
])
addKpi('PMO','Client Satisfaction','Average score ≥ 3 out of 4',3,1,'Quarterly',[
  {name:'Sum of Client Survey Scores'},
  {name:'No. of Survey Responses'},
  {name:'Average Client Satisfaction Score (Auto-calc)',is_calc:1,fk:'A/B',unit:'score',target:3,dir:1},
])
addKpi('PMO','Project Data Accuracy','≥ 100% accuracy (zero anomalies)',1,1,'Monthly',[
  {name:'No. of Anomalies / Data Errors Found in PSO Hub'},
  {name:'Total Projects Reviewed'},
  {name:'Accuracy Rate % (Auto-calc)',is_calc:1,fk:'1-(A/B)',unit:'%',target:1,dir:1},
])
addKpi('PMO','Closure & Invoicing Timeliness','100% on time',1,1,'Monthly',[
  {name:'No. of BAST / Closures / Invoice Requests Submitted On Time'},
  {name:'Total BAST / Closures / Invoice Requests Due'},
  {name:'Timeliness Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:1,dir:1},
])
addKpi('PMO','Reporting','100% compliance',1,1,'Weekly, Monthly',[
  {name:'No. of Reports Submitted On Time and Complete'},
  {name:'Total Reports Due'},
  {name:'Reporting Compliance Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:1,dir:1},
])
addKpi('PMO','Capacity allocation efficiency','≥ 80%',0.80,1,'Monthly',[
  {name:'Total Billable & Scheduled Project Hours'},
  {name:'Total Available Internal Capacity (Man-Hours)'},
  {name:'Allocation Efficiency % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.8,dir:1},
])
addKpi('PMO','Planning & Forward Visibility (Mid Q3)','≥ 90% forecasting accuracy',0.90,1,'Monthly',[
  {name:'Forecasted Resource Demand Hours'},
  {name:'Actual Utilized Hours'},
  {name:'Forecasting Accuracy % (Auto-calc)',is_calc:1,fk:'1-((A-B)/B)',unit:'%',dir:0},
])

// ── R & D ────────────────────────────────────────────────────────────────
addKpi('RD','Internal Tools Developed','≥ 80% completion',0.80,1,'Annually',[
  {name:'No. of Internal Tools Developed'},
  {name:'No. of Internal Tools Planned'},
  {name:'Completion Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.8,dir:1},
])
addKpi('RD','Features Developed','≥ 90% feature delivery rate',0.90,1,'Quarterly',[
  {name:'No. of Features Shipped (IntelliBroń)'},
  {name:'No. of Features Planned'},
  {name:'Feature Delivery Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.9,dir:1},
])
addKpi('RD','Prototype Developed','≥ 80% delivery rate',0.80,1,'Annually',[
  {name:'No. of Prototypes / MVPs Developed'},
  {name:'No. of Prototypes Planned'},
  {name:'Prototype Delivery Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.8,dir:1},
])
addKpi('RD','Training or Certification','≥ 80% completion',0.80,1,'Annually',[
  {name:'No. of Trainings / Certifications Obtained'},
  {name:'No. of Trainings / Certifications Planned'},
  {name:'Training Completion Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.8,dir:1},
])
addKpi('RD','Cost Reduction','≥ 10% YoY cost reduction',0.10,1,'Annually',[
  {name:'R&D Cost Last Year (IDR)'},
  {name:'R&D Cost This Year (IDR)'},
  {name:'Cost Reduction % (Auto-calc)',is_calc:1,fk:'(A-B)/A',unit:'%',target:0.1,dir:1},
])
addKpi('RD','External Event Contribution','≥ 7 events/year',7,1,'Annually',[
  {name:'No. of External Events R&D Team Participated / Spoke At',target:7,dir:1},
])
addKpi('RD','Internal Tools Satisfaction','Average score ≥ 3 out of 5',3,1,'Annually',[
  {name:'Sum of User Satisfaction Score (Scale 1–5)'},
  {name:'No. of Respondents'},
  {name:'Average User Satisfaction Score (Auto-calc)',is_calc:1,fk:'A/B',unit:'score',target:3,dir:1},
])

// ── Sales ────────────────────────────────────────────────────────────────
addKpi('Sales','Sales Target','≥ 90% achievement',0.90,1,'Monthly, Quarterly',[
  {name:'Actual PO Received (IDR)'},
  {name:'Sales Target (IDR)'},
  {name:'Target Achievement % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.9,dir:1},
])
addKpi('Sales','New Business','≥ 10 new clients/year (≥ 90% achievement)',0.90,1,'Annually',[
  {name:'No. of New Customers / Logos Acquired'},
  {name:'New Business Target (clients)'},
  {name:'Achievement % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.9,dir:1},
])
addKpi('Sales','Sales Growth','≥ 20% YoY growth',0.20,1,'Annually',[
  {name:'Current Year Sales (IDR)'},
  {name:'Last Year Sales (IDR)'},
  {name:'YoY Sales Growth % (Auto-calc)',is_calc:1,fk:'(A-B)/B',unit:'%',target:0.2,dir:1},
])
addKpi('Sales','Pipeline Management','≥ 3x pipeline coverage; 100% deal activity',3,1,'Monthly, Quarterly',[
  {name:'Total Pipeline Value (IDR)'},
  {name:'Sales Target (IDR)'},
  {name:'Pipeline Coverage Ratio (Auto-calc)',is_calc:1,fk:'A/B',unit:'x',target:3,dir:1},
  {name:'% of Deals with Activity in Last 30 Days',target:1,dir:1},
])
addKpi('Sales','Revenue Run Rate Stability','≥ 95%',0.95,1,'Quarterly',[
  {name:'Actual Revenue from Existing Clients (IDR)'},
  {name:'Planned Run Rate — Existing Clients (IDR)'},
  {name:'Run Rate Stability % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.95,dir:1},
])
addKpi('Sales','Performance Reporting','100% compliance',1,1,'Monthly',[
  {name:'No. of Sales / Pipeline Reports Submitted On Time & Complete'},
  {name:'Total Reports Due'},
  {name:'Reporting Compliance Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:1,dir:1},
])
addKpi('Sales','Data Governance','≥ 100% data quality (zero anomalies)',1,1,'Monthly',[
  {name:'No. of Data Anomalies / Errors Found in Pipedrive & PSO'},
  {name:'Total Records Reviewed'},
  {name:'Data Quality Rate % (Auto-calc)',is_calc:1,fk:'1-(A/B)',unit:'%',target:1,dir:1},
])
addKpi('Sales','Churn Rate','< 10%',0.10,-1,'Annually',[
  {name:'No. of Clients Lost During Period'},
  {name:'No. of Clients at Start of Period'},
  {name:'Churn Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.1,dir:-1},
])
addKpi('Sales','Quarterly PO Forecast and Margin','≥ 90% forecast accuracy; gross margin > 40%',0.90,1,'Quarterly',[
  {name:'Forecasted PO Value (IDR)'},
  {name:'Actual PO Value Received (IDR)'},
  {name:'Forecast Accuracy % (Auto-calc)',is_calc:1,fk:'B/A',unit:'%',target:0.9,dir:1},
  {name:'Actual Gross Profit (IDR)'},
  {name:'Actual Gross Margin % (Auto-calc)',is_calc:1,fk:'C/B',unit:'%',target:0.4,dir:1},
])

// ── SecOps ───────────────────────────────────────────────────────────────
addKpi('SecOps','Mean Time To Detect','TBD by management',null,-1,'Monthly',[
  {name:'Total Detection Time (hours, all incidents)'},
  {name:'No. of Incidents'},
  {name:'Mean Time To Detect — hours (Auto-calc)',is_calc:1,fk:'A/B',unit:'hours',dir:0},
])
addKpi('SecOps','Mean Time To Respond','TBD by management',null,-1,'Monthly',[
  {name:'Total Response Time (hours, all incidents)'},
  {name:'No. of Incidents'},
  {name:'Mean Time To Respond — hours (Auto-calc)',is_calc:1,fk:'A/B',unit:'hours',dir:0},
])
addKpi('SecOps','Analytical Precision (False Positive Ratio)','≤ 5%',0.05,-1,'Monthly',[
  {name:'No. of False Positive Alerts'},
  {name:'Total Alerts Triaged'},
  {name:'False Positive Ratio % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.05,dir:-1},
])
addKpi('SecOps','Operational Scaling (Automation & Scripting)','≥ 50% automation coverage',0.50,1,'Quarterly',[
  {name:'No. of Manual Tasks Converted to Automated Workflows'},
  {name:'Total Manual Tasks Identified for Automation'},
  {name:'Automation Coverage % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.5,dir:1},
])
addKpi('SecOps','Security Hygiene (Vulnerability SLA)','≥ 95% patched within SLA',0.95,1,'Monthly',[
  {name:'No. of Vulnerabilities Patched Within SLA'},
  {name:'Total Vulnerabilities Identified'},
  {name:'SLA Compliance Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.95,dir:1},
])
addKpi('SecOps','Asset Visibility & Inventory Accuracy','≥ 95% accuracy',0.95,1,'Quarterly',[
  {name:'No. of Assets Accurately Documented'},
  {name:'Total Known Assets'},
  {name:'Inventory Accuracy % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.95,dir:1},
])
addKpi('SecOps','Technical Support & Security Enablement','≥ 95% ticket resolution rate',0.95,1,'Monthly',[
  {name:'No. of Security Tickets Resolved (MFA, VPN, Access)'},
  {name:'Total Tickets Received'},
  {name:'Resolution Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.95,dir:1},
])

// ── Technical Writer ─────────────────────────────────────────────────────
addKpi('Technical_Writer','Report delivery timeliness','≥ 95%',0.95,1,'Bi-Weekly',[
  {name:'No. of Reports Delivered On Time (Per Project Deadline)'},
  {name:'Total Reports Due'},
  {name:'Delivery Timeliness Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.95,dir:1},
])
addKpi('Technical_Writer','Report quality/rework rate','≤ 5% rework rate',0.05,-1,'Monthly',[
  {name:'No. of Reports Requiring Client-Driven Revisions'},
  {name:'Total Reports Submitted'},
  {name:'Rework Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:0.05,dir:-1},
])
addKpi('Technical_Writer','Internal knowledge base contribution','2–4 contributions per person per quarter',2,1,'Quarterly',[
  {name:'No. of Internal Knowledge Entries Added (Library, Templates, Docs)',target:2,dir:1},
])
addKpi('Technical_Writer','External knowledge base contribution','2–4 contributions per person per month',2,1,'Quarterly',[
  {name:'No. of Posts / Contributions to External Channels / Forums',target:2,dir:1},
])
addKpi('Technical_Writer','Data governance','≥ 100% accuracy (zero anomalies)',1,1,'Bi-Weekly',[
  {name:'No. of Anomalies / Issues Found in Project Tracker'},
  {name:'Total Records Reviewed'},
  {name:'Accuracy Rate % (Auto-calc)',is_calc:1,fk:'1-(A/B)',unit:'%',target:1,dir:1},
])
addKpi('Technical_Writer','% of AI-driven reports/deliverables','100% of relevant reports utilising AI',1,1,'Weekly',[
  {name:'No. of Reports Utilizing AI for Drafting / Research'},
  {name:'Total Reports Produced'},
  {name:'AI Utilisation Rate % (Auto-calc)',is_calc:1,fk:'A/B',unit:'%',target:1,dir:1},
])

async function main() {
  const { count } = await supabase.from('departments').select('*', { count: 'exact', head: true })
  if (count && count > 0) {
    console.error(`departments table already has ${count} rows — refusing to reseed. Truncate the tables first if you really want to reseed.`)
    process.exit(1)
  }

  console.log('Seeding departments & roles...')
  const deptRows = depts.map(d => ({ id: d.id, name: d.name, pin_hash: bcrypt.hashSync(d.pin, 10) }))
  const { error: deptErr } = await supabase.from('departments').insert(deptRows)
  if (deptErr) throw deptErr

  const roleRows = roles.map(r => ({ role_key: r.role_key, pin_hash: bcrypt.hashSync(r.pin, 10), display_name: r.display_name }))
  const { error: roleErr } = await supabase.from('roles').insert(roleRows)
  if (roleErr) throw roleErr

  console.log(`Seeding ${kpiSeed.length} KPIs...`)
  let subMetricCount = 0
  for (const k of kpiSeed) {
    const { data: kpiRow, error: kpiErr } = await supabase
      .from('kpis')
      .insert({
        dept_id: k.dept_id,
        kpi_name: k.kpi_name,
        target_text: k.target_text,
        numeric_target: k.numeric_target,
        direction: k.direction,
        frequency: k.frequency,
      })
      .select('id')
      .single()
    if (kpiErr) throw kpiErr

    const smRows = k.sms.map((sm, i) => ({
      kpi_id: kpiRow.id,
      name: sm.name,
      is_calc: !!sm.is_calc,
      formula_key: sm.fk ?? null,
      calc_input_positions: sm.pos ?? null,
      unit: sm.unit ?? '',
      display_order: i,
      numeric_target: sm.target ?? null,
      direction: sm.dir ?? null,
    }))
    const { error: smErr } = await supabase.from('sub_metrics').insert(smRows)
    if (smErr) throw smErr
    subMetricCount += smRows.length
  }

  console.log(`Done: ${depts.length} departments, ${kpiSeed.length} KPIs, ${subMetricCount} sub-metrics.`)
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
