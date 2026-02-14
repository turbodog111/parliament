/* ============================================================
   config.js — Party definitions, policy axes, constants
   ============================================================ */

const CONFIG = {
  TOTAL_SEATS: 650,
  MAJORITY: 326,
  TURNS_PER_PARLIAMENT: 60, // 5 years = 60 months
  MIN_ELECTION_TURNS: 12,   // earliest election after 1 year
  MONTHS: ['January','February','March','April','May','June',
           'July','August','September','October','November','December'],
  START_YEAR: 2024,
  START_MONTH: 6, // July (0-indexed)

  STORAGE_KEY: 'parliament_save',
  VERSION: '1.0.0',

  // AI defaults
  OLLAMA_ENDPOINT: 'http://localhost:11434',
  OLLAMA_MODEL: '',

  // Polling noise
  POLL_NOISE: 1.5,       // +/- random swing per turn
  POLL_REVERSION: 0.05,  // revert toward baseline each turn

  // Approval thresholds
  APPROVAL_CRISIS: 20,
  APPROVAL_LOW: 35,
  APPROVAL_HIGH: 60,

  // Unity thresholds
  UNITY_REVOLT: 30,
  UNITY_LOW: 50,

  // Campaign resources per turn
  CAMPAIGN_FUNDS_PER_TURN: 100,
  CAMPAIGN_ACTIVISTS_PER_TURN: 50,

  // Bill stages (simplified: introduced → Commons vote → law)
  BILL_STAGES: [
    'Introduced',
    'Royal Assent'
  ],

  // Regions
  REGIONS: [
    'North East', 'North West', 'Yorkshire and The Humber',
    'East Midlands', 'West Midlands', 'East of England',
    'London', 'South East', 'South West',
    'Wales', 'Scotland', 'Northern Ireland'
  ],

  COUNTRIES: ['England', 'Wales', 'Scotland', 'Northern Ireland'],
};

// Policy axes — each ranges from 0 (left/liberal) to 100 (right/authoritarian)
const POLICY_AXES = {
  economy:     { name: 'Economy',           left: 'State-led',        right: 'Free Market' },
  tax:         { name: 'Taxation',          left: 'Higher Tax',       right: 'Lower Tax' },
  nhs:         { name: 'NHS & Welfare',     left: 'Expand Services',  right: 'Reform & Privatise' },
  immigration: { name: 'Immigration',       left: 'Open',             right: 'Restrictive' },
  environment: { name: 'Environment',       left: 'Green Priority',   right: 'Growth Priority' },
  defence:     { name: 'Defence & Foreign',  left: 'Dove / Diplomacy', right: 'Hawk / Strong Defence' },
  devolution:  { name: 'Devolution',        left: 'More Devolution',  right: 'Centralise' },
};

// Party definitions
const PARTIES = {
  con: {
    id: 'con',
    name: 'Conservative',
    short: 'Con',
    color: '#0087DC',
    textColor: '#fff',
    leader: 'Kemi Badenoch',
    ideology: { economy: 70, tax: 72, nhs: 55, immigration: 70, environment: 60, defence: 75, devolution: 70 },
    baseRegions: ['South East', 'South West', 'East of England', 'East Midlands'],
    strengths: ['business', 'defence', 'law-and-order'],
    weaknesses: ['nhs', 'inequality', 'trust'],
    description: 'Centre-right party of government, favouring free markets and traditional values.',
  },
  lab: {
    id: 'lab',
    name: 'Labour',
    short: 'Lab',
    color: '#DC241F',
    textColor: '#fff',
    leader: 'Keir Starmer',
    ideology: { economy: 35, tax: 35, nhs: 25, immigration: 45, environment: 35, defence: 45, devolution: 35 },
    baseRegions: ['North East', 'North West', 'Yorkshire and The Humber', 'London', 'Wales'],
    strengths: ['nhs', 'workers-rights', 'education'],
    weaknesses: ['economy', 'defence', 'infighting'],
    description: 'Centre-left party, championing workers\' rights, the NHS, and social justice.',
  },
  lib: {
    id: 'lib',
    name: 'Liberal Democrats',
    short: 'Lib Dem',
    color: '#FDBB30',
    textColor: '#333',
    leader: 'Ed Davey',
    ideology: { economy: 45, tax: 40, nhs: 30, immigration: 25, environment: 25, defence: 35, devolution: 25 },
    baseRegions: ['South West', 'South East', 'London'],
    strengths: ['civil-liberties', 'environment', 'local-issues'],
    weaknesses: ['indecisive', 'low-profile', 'coalition-baggage'],
    description: 'Centrist liberal party, strong on civil liberties, EU relations, and the environment.',
  },
  snp: {
    id: 'snp',
    name: 'Scottish National Party',
    short: 'SNP',
    color: '#FFF95D',
    textColor: '#333',
    leader: 'John Swinney',
    ideology: { economy: 30, tax: 30, nhs: 20, immigration: 25, environment: 25, defence: 30, devolution: 5 },
    baseRegions: ['Scotland'],
    strengths: ['scottish-identity', 'social-democracy', 'nhs-scotland'],
    weaknesses: ['independence-fatigue', 'internal-splits', 'westminster-irrelevance'],
    description: 'Scottish independence party with social democratic domestic policies.',
    country: 'Scotland',
  },
  reform: {
    id: 'reform',
    name: 'Reform UK',
    short: 'Reform',
    color: '#12B6CF',
    textColor: '#fff',
    leader: 'Nigel Farage',
    ideology: { economy: 80, tax: 85, nhs: 65, immigration: 95, environment: 85, defence: 85, devolution: 75 },
    baseRegions: ['East of England', 'East Midlands', 'North East', 'Yorkshire and The Humber'],
    strengths: ['immigration', 'anti-establishment', 'populism'],
    weaknesses: ['inexperience', 'extremism-label', 'policy-depth'],
    description: 'Right-wing populist party focused on immigration control and small government.',
  },
  green: {
    id: 'green',
    name: 'Green Party',
    short: 'Green',
    color: '#6AB023',
    textColor: '#fff',
    leader: 'Carla Denyer',
    ideology: { economy: 15, tax: 15, nhs: 10, immigration: 15, environment: 5, defence: 15, devolution: 20 },
    baseRegions: ['London', 'South East', 'South West'],
    strengths: ['environment', 'young-voters', 'grassroots'],
    weaknesses: ['electability', 'single-issue', 'small-party'],
    description: 'Left-wing environmentalist party prioritising climate action and social justice.',
  },
  plaid: {
    id: 'plaid',
    name: 'Plaid Cymru',
    short: 'Plaid',
    color: '#005B54',
    textColor: '#fff',
    leader: 'Rhun ap Iorwerth',
    ideology: { economy: 25, tax: 25, nhs: 20, immigration: 30, environment: 20, defence: 25, devolution: 5 },
    baseRegions: ['Wales'],
    strengths: ['welsh-identity', 'language', 'rural-wales'],
    weaknesses: ['small-base', 'urban-weakness', 'labour-competition'],
    description: 'Welsh nationalist party seeking greater Welsh autonomy and cultural preservation.',
    country: 'Wales',
  },
  dup: {
    id: 'dup',
    name: 'Democratic Unionist Party',
    short: 'DUP',
    color: '#D46A4C',
    textColor: '#fff',
    leader: 'Gavin Robinson',
    ideology: { economy: 55, tax: 55, nhs: 40, immigration: 70, environment: 60, defence: 80, devolution: 40 },
    baseRegions: ['Northern Ireland'],
    strengths: ['unionism', 'conservative-values', 'ni-establishment'],
    weaknesses: ['social-conservatism', 'protocol-fixation', 'coalition-demands'],
    description: 'Northern Irish unionist party with socially conservative positions.',
    country: 'Northern Ireland',
  },
  sf: {
    id: 'sf',
    name: 'Sinn Féin',
    short: 'SF',
    color: '#326760',
    textColor: '#fff',
    leader: 'Mary Lou McDonald',
    ideology: { economy: 20, tax: 20, nhs: 15, immigration: 30, environment: 25, defence: 20, devolution: 5 },
    baseRegions: ['Northern Ireland'],
    strengths: ['irish-unity', 'community-activism', 'young-vote'],
    weaknesses: ['abstentionism', 'historical-baggage', 'mainland-irrelevance'],
    description: 'Irish republican party that abstains from taking Westminster seats.',
    country: 'Northern Ireland',
    abstentionist: true,
  },
  sdlp: {
    id: 'sdlp',
    name: 'SDLP',
    short: 'SDLP',
    color: '#2AA82C',
    textColor: '#fff',
    leader: 'Claire Hanna',
    ideology: { economy: 30, tax: 30, nhs: 25, immigration: 30, environment: 25, defence: 30, devolution: 15 },
    baseRegions: ['Northern Ireland'],
    strengths: ['moderate-nationalism', 'cross-community', 'pro-eu'],
    weaknesses: ['sf-competition', 'small-base', 'aging-vote'],
    description: 'Moderate Irish nationalist social democratic party.',
    country: 'Northern Ireland',
  },
  alliance: {
    id: 'alliance',
    name: 'Alliance Party',
    short: 'Alliance',
    color: '#F6CB2F',
    textColor: '#333',
    leader: 'Naomi Long',
    ideology: { economy: 45, tax: 40, nhs: 30, immigration: 30, environment: 25, defence: 40, devolution: 25 },
    baseRegions: ['Northern Ireland'],
    strengths: ['cross-community', 'moderation', 'young-professionals'],
    weaknesses: ['small-base', 'identity-politics', 'squeezing'],
    description: 'Cross-community liberal party in Northern Ireland.',
    country: 'Northern Ireland',
  },
};

// Parties the player can choose
const PLAYABLE_PARTIES = ['con', 'lab', 'lib', 'snp', 'reform', 'green', 'plaid'];

// Parties sorted by typical seat count for display
const PARTY_ORDER = ['con', 'lab', 'lib', 'snp', 'reform', 'green', 'plaid', 'dup', 'sf', 'sdlp', 'alliance'];

// 2024 baseline seats (approximate)
const BASELINE_SEATS = {
  con: 121,
  lab: 412,
  lib: 72,
  snp: 9,
  reform: 5,
  green: 4,
  plaid: 4,
  dup: 5,
  sf: 7,
  sdlp: 2,
  alliance: 1,
  ind: 6,
  speaker: 1,
  other: 1,
};

// 2024 baseline national vote share (%)
const BASELINE_POLLING = {
  con: 23.7,
  lab: 33.7,
  lib: 12.2,
  snp: 2.5,
  reform: 14.3,
  green: 6.7,
  plaid: 0.7,
  dup: 0.6,
  sf: 0.7,
  sdlp: 0.3,
  alliance: 0.2,
  other: 4.4,
};

// Event categories
const EVENT_CATEGORIES = [
  'economy', 'health', 'immigration', 'crime', 'environment',
  'foreign-affairs', 'education', 'housing', 'transport',
  'party-politics', 'scandal', 'royal', 'media', 'culture-war'
];

const EVENT_SEVERITIES = ['minor', 'moderate', 'major', 'crisis'];

// PMQ strategies
const PMQ_STRATEGIES = [
  { id: 'attack', name: 'Attack', desc: 'Go on the offensive. High risk, high reward.' },
  { id: 'defend', name: 'Defend Record', desc: 'Highlight your achievements. Safe but can seem evasive.' },
  { id: 'pivot', name: 'Pivot', desc: 'Redirect to your preferred topic. Moderate risk.' },
  { id: 'humour', name: 'Use Humour', desc: 'Deflect with wit. Great if it lands, awful if it doesn\'t.' },
];
