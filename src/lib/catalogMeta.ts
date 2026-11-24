export type CatalogIconKey =
  | 'shield'
  | 'briefcase'
  | 'target'
  | 'sprout'
  | 'globe'
  | 'boxes'
  | 'heart-pulse'
  | 'truck'
  | 'hard-hat'
  | 'compass'
  | 'lock'
  | 'sun'
  | 'users'
  | 'building'
  | 'graduation-cap'
  | 'recycle'
  | 'landmark'
  | 'plane'
  | 'file-shield'
  | 'shopping-bag';

export interface ProductRichMeta {
  slug: string;
  wave: number;
  icon: CatalogIconKey;
  problemSolved: string;
  whoItServes: string;
  features: string[];
  badgeText: string;
}

export const FOUR_CATEGORIES = [
  'Business & workforce',
  'Agriculture, trade & logistics',
  'Finance, property & infrastructure',
  'Education, tourism & commerce',
] as const;

export const PRODUCT_RICH_META: Record<string, ProductRichMeta> = {
  fieldforce: {
    slug: 'fieldforce',
    wave: 1,
    icon: 'shield',
    problemSolved: 'Eliminates ghost workers, double-booked rosters, unverified attendance, and paper incident logs.',
    whoItServes: 'Private security, cleaning, and facilities management firms across East Africa.',
    features: ['Shift & roster overlap guard', 'Mobile attendance & GPS snapshot', 'Human-approved AI incident reports'],
    badgeText: 'Building now · Active V1',
  },
  'biashara-os': {
    slug: 'biashara-os',
    wave: 2,
    icon: 'briefcase',
    problemSolved: 'Replaces scattered spreadsheets with clean invoicing, M-Pesa reconciliation, and cashflow books.',
    whoItServes: 'Growing African SMEs and multi-branch service businesses.',
    features: ['KES invoicing & receipts', 'M-Pesa payment matching', 'Monthly profit & expense ledger'],
    badgeText: 'Next · Coming soon',
  },
  'ai-sales-agent': {
    slug: 'ai-sales-agent',
    wave: 3,
    icon: 'target',
    problemSolved: 'Prevents dropped B2B inquiries by structuring lead qualification and follow-up discipline.',
    whoItServes: 'Commercial sales teams and B2B distributors.',
    features: ['Lead intake & scoring', 'Pipeline stage tracking', 'Draft follow-up proposals'],
    badgeText: 'Coming soon',
  },
  'farmlink-ai': {
    slug: 'farmlink-ai',
    wave: 4,
    icon: 'sprout',
    problemSolved: 'Standardizes weigh-station collection logs and transparent smallholder farmer payouts.',
    whoItServes: 'Agri-aggregators, SACCOs, and agricultural cooperatives.',
    features: ['Produce collection capture', 'Quality grading records', 'Verified farmer payout ledgers'],
    badgeText: 'Coming soon',
  },
  'tradepilot-ai': {
    slug: 'tradepilot-ai',
    wave: 5,
    icon: 'globe',
    problemSolved: 'Simplifies supplier bid preparation and tender compliance tracking across East Africa.',
    whoItServes: 'Importers, wholesalers, and government/corporate suppliers.',
    features: ['Tender compliance checklists', 'Supplier document expiry alerts', 'Bid milestone tracking'],
    badgeText: 'Coming soon',
  },
  'stocksmart-ai': {
    slug: 'stocksmart-ai',
    wave: 6,
    icon: 'boxes',
    problemSolved: 'Stops stock-outs, dead inventory, and untracked multi-branch shrinkage.',
    whoItServes: 'Retailers, pharmacies, and hardware distributors.',
    features: ['Multi-branch stock counts', 'Batch & expiry monitoring', 'Reorder threshold alerts'],
    badgeText: 'Coming soon',
  },
  'mediflow-ai': {
    slug: 'mediflow-ai',
    wave: 7,
    icon: 'heart-pulse',
    problemSolved: 'Reduces outpatient clinic bottlenecks and fragmented patient billing.',
    whoItServes: 'Community clinics, diagnostics centres, and outpatient providers.',
    features: ['Outpatient queue flow', 'Structured triage intake', 'Clinic billing & SHA/NHIF logs'],
    badgeText: 'Coming soon',
  },
  'routeiq-africa': {
    slug: 'routeiq-africa',
    wave: 8,
    icon: 'truck',
    problemSolved: 'Gives dispatchers verifiable proof of delivery and route exception visibility.',
    whoItServes: 'Regional hauliers, FMCG distributors, and courier fleets.',
    features: ['Trip dispatch scheduling', 'Proof-of-delivery logs', 'Delivery exception alerts'],
    badgeText: 'Coming soon',
  },
  'buildwise-ai': {
    slug: 'buildwise-ai',
    wave: 9,
    icon: 'hard-hat',
    problemSolved: 'Controls site material leakage, subcontractor sign-offs, and BOQ budget drift.',
    whoItServes: 'Contractors, civil engineers, and real-estate developers.',
    features: ['Site material issue logs', 'Contractor milestone tracking', 'BOQ variance alerts'],
    badgeText: 'Coming soon',
  },
  'safaribiz-ai': {
    slug: 'safaribiz-ai',
    wave: 10,
    icon: 'compass',
    problemSolved: 'Coordinates lodge bookings, guide rosters, and park-fee operations cleanly.',
    whoItServes: 'Tour operators, safari camps, and hospitality groups.',
    features: ['Itinerary & lodge schedules', 'Driver/guide rostering', 'Guest arrival checklists'],
    badgeText: 'Coming soon',
  },
  'cyberguard-ai': {
    slug: 'cyberguard-ai',
    wave: 11,
    icon: 'lock',
    problemSolved: 'Helps mid-market businesses track ODPC privacy obligations and vendor security posture.',
    whoItServes: 'Regulated SMEs, fintechs, and enterprise IT leads.',
    features: ['ODPC compliance checklists', 'Vendor risk register', 'Access review schedules'],
    badgeText: 'Coming soon',
  },
  'solarcare-ai': {
    slug: 'solarcare-ai',
    wave: 12,
    icon: 'sun',
    problemSolved: 'Organizes field technician maintenance tickets for distributed clean-energy assets.',
    whoItServes: 'Mini-grid operators and commercial solar installers.',
    features: ['Asset installation logs', 'Preventive service dispatch', 'Fault resolution tracking'],
    badgeText: 'Coming soon',
  },
  'talentbridge-ai': {
    slug: 'talentbridge-ai',
    wave: 13,
    icon: 'users',
    problemSolved: 'Structures high-volume candidate screening, vetting checks, and onboarding.',
    whoItServes: 'HR departments and staffing agencies.',
    features: ['Applicant screening workflows', 'Reference & vetting logs', 'Interview scorecards'],
    badgeText: 'Coming soon',
  },
  'propmanager-ai': {
    slug: 'propmanager-ai',
    wave: 14,
    icon: 'building',
    problemSolved: 'Automates tenant rent ledgers, service charge tracking, and repair ticketing.',
    whoItServes: 'Property managers, landlords, and estate agencies.',
    features: ['Unit & lease registers', 'Rent & service-charge tracking', 'Maintenance ticket logs'],
    badgeText: 'Coming soon',
  },
  'skillcoach-ai': {
    slug: 'skillcoach-ai',
    wave: 15,
    icon: 'graduation-cap',
    problemSolved: 'Tracks cohort attendance, practical skills assessments, and employer readiness.',
    whoItServes: 'TVET institutions, academies, and corporate training teams.',
    features: ['Cohort attendance logs', 'Practical skill rubrics', 'Certificate tracking'],
    badgeText: 'Coming soon',
  },
  'recyclelink-ai': {
    slug: 'recyclelink-ai',
    wave: 16,
    icon: 'recycle',
    problemSolved: 'Audits collection route weights and verified material recovery chains.',
    whoItServes: 'Waste management operators and circular-economy recyclers.',
    features: ['Route collection manifests', 'Material weight logs', 'Recovery chain reporting'],
    badgeText: 'Coming soon',
  },
  'agricredit-intel': {
    slug: 'agricredit-intel',
    wave: 17,
    icon: 'landmark',
    problemSolved: 'Turns verified harvest and cooperative delivery histories into structured credit underwriting.',
    whoItServes: 'SACCOs, MFIs, and agri-input lenders.',
    features: ['Farmer repayment records', 'Input-loan tracking', 'Portfolio risk summaries'],
    badgeText: 'Coming soon',
  },
  'diasporaconnect-ai': {
    slug: 'diasporaconnect-ai',
    wave: 18,
    icon: 'plane',
    problemSolved: 'Provides verified milestone reporting for diaspora-funded home and commercial projects.',
    whoItServes: 'Diaspora investors and local project oversight firms.',
    features: ['Milestone verification logs', 'Disbursement approvals', 'Structured progress summaries'],
    badgeText: 'Coming soon',
  },
  'insureflow-ai': {
    slug: 'insureflow-ai',
    wave: 19,
    icon: 'file-shield',
    problemSolved: 'Streamlines policy renewal reminders and structured claims intake.',
    whoItServes: 'Insurance brokers and underwriting administrators.',
    features: ['Policy renewal tracking', 'Structured claims intake', 'Broker commission logs'],
    badgeText: 'Coming soon',
  },
  'commercepilot-ai': {
    slug: 'commercepilot-ai',
    wave: 20,
    icon: 'shopping-bag',
    problemSolved: 'Connects social/WhatsApp order confirmations directly to last-mile rider dispatch.',
    whoItServes: 'Online merchants and direct-to-consumer brands.',
    features: ['Order confirmation queue', 'Rider dispatch status', 'Cash-on-delivery reconciliation'],
    badgeText: 'Coming soon',
  },
};
