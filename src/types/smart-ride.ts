import type { DeparturePort, NigerianPort } from '../lib/cost-matrix';

export interface SmartRideVehicle {
  id: string;
  lotId: string; // e.g., "SR-US-90418" — 100% White-labeled Smart Ride Verified Stock
  vin: string;
  engineNumber: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  titleStatus: 'Clean Title' | 'Smart Ride Rebuilt Verified' | 'Acquisition Certificate';
  condition: 'Run & Drive Verified' | 'Starts & Idles';
  mileageMiles: number;
  usDeparturePort: DeparturePort;
  defaultDestinationPort: NigerianPort;
  currentBidUsd: number;
  buyNowPriceUsd: number;
  exteriorColor: string;
  interiorColor: string;
  drivetrain: string;
  fuelType: string;
  primaryNote: string;
  secondaryNote: string;
  undercarriageNote: string;
  logisticsStageIndex: number; // 0 to 4 (US Yard -> Port Towing -> Ocean RoRo -> Tin Can Customs -> E-Y Lagos Hub)
  accentHex: string;
  silhouetteType: 'SUV_LUXURY' | 'SUV_SPORT' | 'SEDAN_EXEC' | 'SUV_OFFROAD';
}

export interface SyncedBankAccount {
  id: string;
  institutionName: string;
  accountNumberMasked: string;
  accountType: string;
  currency: 'NGN' | 'USD';
  balance: number;
  autoSyncEnabled: boolean;
  lastSyncedIso: string;
}

export interface BudgetCategoryItem {
  id: string;
  name: string;
  currency: 'NGN' | 'USD';
  allocatedAmount: number;
  spentAmount: number;
  alertThresholdPct: number;
}

export interface SyncedTransaction {
  id: string;
  alatpayReference: string;
  type:
    | 'BANK_SYNC_INFLOW'
    | 'BANK_SYNC_SPEND'
    | 'BIDDING_DEPOSIT'
    | 'VEHICLE_SETTLEMENT'
    | 'CUSTOMS_CLEARING'
    | 'FREIGHT_PAYMENT';
  category: string;
  description: string;
  currency: 'NGN' | 'USD';
  amount: number;
  paymentChannel: string;
  createdAtIso: string;
}

export interface ActiveProxyBid {
  id: string;
  lotId: string;
  vehicleTitle: string;
  maxProxyBidUsd: number;
  depositPaidNgn: number;
  alatpayReference: string;
  status: 'ACTIVE_PROXY' | 'WINNING' | 'WON' | 'OUTBID' | 'REFUNDED';
  createdAtIso: string;
}

export interface ScheduledInspection {
  id: string;
  lotId: string;
  vehicleTitle: string;
  scheduledIso: string;
  inspectorName: string;
  specialistNotes: string;
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}

export interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  webViewLink?: string;
}

export const INITIAL_VEHICLES: SmartRideVehicle[] = [
  {
    id: 'veh-1',
    lotId: 'SR-US-90418',
    vin: '2T2BZMCA9MC104921',
    engineNumber: '2GR-FKS-884120',
    year: 2021,
    make: 'Lexus',
    model: 'RX 350',
    trim: 'F-Sport AWD Executive',
    titleStatus: 'Clean Title',
    condition: 'Run & Drive Verified',
    mileageMiles: 24180,
    usDeparturePort: 'Newark, NJ',
    defaultDestinationPort: 'Tin Can Island, Lagos',
    currentBidUsd: 19400,
    buyNowPriceUsd: 24800,
    exteriorColor: 'Obsidian Carbon Black',
    interiorColor: 'Rioja Red Leather',
    drivetrain: 'AWD · 8-Speed Automatic',
    fuelType: '3.5L V6 Direct Injection',
    primaryNote: 'Zero structural impact · Original factory panels verified',
    secondaryNote: 'Minor 2cm front bumper lip stone chip',
    undercarriageNote: 'Dry & Rust-Free (Southern US Fleet Origin)',
    logisticsStageIndex: 2,
    accentHex: '#10b981',
    silhouetteType: 'SUV_LUXURY',
  },
  {
    id: 'veh-2',
    lotId: 'SR-US-88204',
    vin: '4JGFB5KB8NA712093',
    engineNumber: 'M256-E30-99104',
    year: 2022,
    make: 'Mercedes-Benz',
    model: 'GLE 450',
    trim: '4MATIC AMG Line',
    titleStatus: 'Clean Title',
    condition: 'Run & Drive Verified',
    mileageMiles: 18940,
    usDeparturePort: 'Savannah, GA',
    defaultDestinationPort: 'Apapa Port, Lagos',
    currentBidUsd: 31200,
    buyNowPriceUsd: 37500,
    exteriorColor: 'Selenite Grey Metallic',
    interiorColor: 'Espresso Brown Nappa',
    drivetrain: '4MATIC AWD · 9G-TRONIC',
    fuelType: '3.0L Inline-6 Turbo + EQ Boost Hybrid',
    primaryNote: 'Smart Ride 150-Point Executive Yard Certification Passed',
    secondaryNote: 'Rear right alloy rim light curb scuff',
    undercarriageNote: 'Factory aero shields intact · Air suspension calibrated',
    logisticsStageIndex: 1,
    accentHex: '#f59e0b',
    silhouetteType: 'SUV_SPORT',
  },
  {
    id: 'veh-3',
    lotId: 'SR-US-77510',
    vin: 'JTMAB3FV4PD019482',
    engineNumber: 'V35A-FTS-44019',
    year: 2023,
    make: 'Toyota',
    model: 'Land Cruiser 300',
    trim: 'GR-Sport Twin-Turbo V6',
    titleStatus: 'Clean Title',
    condition: 'Run & Drive Verified',
    mileageMiles: 9420,
    usDeparturePort: 'Houston, TX',
    defaultDestinationPort: 'Tin Can Island, Lagos',
    currentBidUsd: 48500,
    buyNowPriceUsd: 56000,
    exteriorColor: 'Blizzard Pearl White',
    interiorColor: 'Black / Dark Crimson Perforated',
    drivetrain: 'Full-Time 4WD · E-KDSS',
    fuelType: '3.4L V6 Twin-Turbo',
    primaryNote: 'Pristine Diplomatic Fleet Release · Full Service Dossier',
    secondaryNote: 'Factory PPF film installed on hood and fenders',
    undercarriageNote: 'Heavy-duty skid plates untouched · 100% Dry',
    logisticsStageIndex: 3,
    accentHex: '#38bdf8',
    silhouetteType: 'SUV_OFFROAD',
  },
  {
    id: 'veh-4',
    lotId: 'SR-US-64192',
    vin: 'WP1AA2AY9MDA08411',
    engineNumber: 'DCB-EA839-31094',
    year: 2021,
    make: 'Porsche',
    model: 'Cayenne Coupe',
    trim: 'S Chrono Package',
    titleStatus: 'Smart Ride Rebuilt Verified',
    condition: 'Run & Drive Verified',
    mileageMiles: 29650,
    usDeparturePort: 'Newark, NJ',
    defaultDestinationPort: 'Tin Can Island, Lagos',
    currentBidUsd: 27900,
    buyNowPriceUsd: 33400,
    exteriorColor: 'Jet Black Metallic',
    interiorColor: 'Slate Grey Alcantara',
    drivetrain: 'AWD · 8-Speed Tiptronic S',
    fuelType: '2.9L Twin-Turbo V6',
    primaryNote: 'Replaced front left headlight assembly with OEM Porsche part',
    secondaryNote: 'Laser chassis alignment certified within 0.01mm spec',
    undercarriageNote: 'PASM active dampers tested & verified on yard dyno',
    logisticsStageIndex: 0,
    accentHex: '#a855f7',
    silhouetteType: 'SUV_SPORT',
  },
  {
    id: 'veh-5',
    lotId: 'SR-US-51908',
    vin: '5UXCR6C07M9G44120',
    engineNumber: 'B58B30M1-77201',
    year: 2020,
    make: 'Lexus',
    model: 'LX 570',
    trim: 'Three-Row Luxury Package',
    titleStatus: 'Clean Title',
    condition: 'Run & Drive Verified',
    mileageMiles: 34100,
    usDeparturePort: 'Houston, TX',
    defaultDestinationPort: 'Apapa Port, Lagos',
    currentBidUsd: 36800,
    buyNowPriceUsd: 42000,
    exteriorColor: 'Sonic Titanium',
    interiorColor: 'Semi-Aniline Cabernet',
    drivetrain: '4WD · Crawl Control',
    fuelType: '5.7L Naturally Aspirated V8',
    primaryNote: 'Executive One-Owner Texas Vehicle · Zero Accidents',
    secondaryNote: 'Mark Levinson 19-speaker reference audio verified',
    undercarriageNote: 'Hydraulic AHC height control pressurized & leak-free',
    logisticsStageIndex: 4,
    accentHex: '#10b981',
    silhouetteType: 'SUV_OFFROAD',
  },
];

export const INITIAL_BANK_ACCOUNTS: SyncedBankAccount[] = [
  {
    id: 'ba-wema-ngn',
    institutionName: 'Wema Bank PLC (ALAT Corporate)',
    accountNumberMasked: '0124 •••• 3021',
    accountType: 'NGN Auto-Sync Current',
    currency: 'NGN',
    balance: 42850000,
    autoSyncEnabled: true,
    lastSyncedIso: '2026-10-17T10:30:00.000Z',
  },
  {
    id: 'ba-alat-virtual',
    institutionName: 'ALATPay by Wema Dedicated Virtual',
    accountNumberMasked: '7841 •••• 9384',
    accountType: 'NGN Bidding Escrow Wallet',
    currency: 'NGN',
    balance: 14500000,
    autoSyncEnabled: true,
    lastSyncedIso: '2026-10-17T10:31:00.000Z',
  },
  {
    id: 'ba-wema-usd',
    institutionName: 'Wema Bank Corporate Domiciliary',
    accountNumberMasked: '0621 •••• 4418',
    accountType: 'USD Direct Settlement',
    currency: 'USD',
    balance: 28400,
    autoSyncEnabled: true,
    lastSyncedIso: '2026-10-17T10:29:00.000Z',
  },
];

export const INITIAL_BUDGET_CATEGORIES: BudgetCategoryItem[] = [
  {
    id: 'cat-1',
    name: 'US Vehicle Acquisition (Smart Ride Stock)',
    currency: 'USD',
    allocatedAmount: 35000,
    spentAmount: 19400,
    alertThresholdPct: 85,
  },
  {
    id: 'cat-2',
    name: 'Ocean Freight & Tin Can Customs Clearing',
    currency: 'NGN',
    allocatedAmount: 14000000,
    spentAmount: 9850000,
    alertThresholdPct: 80,
  },
  {
    id: 'cat-3',
    name: 'Fleet Operations, Fuel & Maintenance',
    currency: 'NGN',
    allocatedAmount: 6500000,
    spentAmount: 5720000,
    alertThresholdPct: 85,
  },
  {
    id: 'cat-4',
    name: 'Bioscience & Clean-Fuel Lab R&D',
    currency: 'USD',
    allocatedAmount: 8000,
    spentAmount: 4250,
    alertThresholdPct: 90,
  },
];

export const INITIAL_TRANSACTIONS: SyncedTransaction[] = [
  {
    id: 'tx-101',
    alatpayReference: 'ALAT-EY-994810-A1',
    type: 'BIDDING_DEPOSIT',
    category: 'US Vehicle Acquisition (Smart Ride Stock)',
    description: '15% Refundable Proxy Bid Commitment — 2021 Lexus RX 350 (Lot SR-US-90418)',
    currency: 'NGN',
    amount: 4656000,
    paymentChannel: 'ALATPay Dedicated Virtual Account (7841••••9384)',
    createdAtIso: '2026-10-17T08:15:00.000Z',
  },
  {
    id: 'tx-102',
    alatpayReference: 'ALAT-EY-994702-B4',
    type: 'CUSTOMS_CLEARING',
    category: 'Ocean Freight & Tin Can Customs Clearing',
    description: 'Nigeria Customs Service Tariff & Tin Can Island Terminal Release',
    currency: 'NGN',
    amount: 6420000,
    paymentChannel: 'Wema Bank Corporate NGN Transfer',
    createdAtIso: '2026-10-16T14:40:00.000Z',
  },
  {
    id: 'tx-103',
    alatpayReference: 'ALAT-EY-994519-C8',
    type: 'FREIGHT_PAYMENT',
    category: 'Ocean Freight & Tin Can Customs Clearing',
    description: 'Newark NJ Port Towing & RoRo Vessel Booking (E-Y Logistics)',
    currency: 'USD',
    amount: 1770,
    paymentChannel: 'Wema Bank USD Domiciliary Wire',
    createdAtIso: '2026-10-15T11:20:00.000Z',
  },
  {
    id: 'tx-104',
    alatpayReference: 'ALAT-EY-994301-D2',
    type: 'BANK_SYNC_SPEND',
    category: 'Bioscience & Clean-Fuel Lab R&D',
    description: 'Synthetic Bio-Octane Catalyst & Molecular Assay Reagents',
    currency: 'USD',
    amount: 4250,
    paymentChannel: 'Wema Bank USD Domiciliary Wire',
    createdAtIso: '2026-10-14T16:05:00.000Z',
  },
  {
    id: 'tx-105',
    alatpayReference: 'ALAT-EY-994110-E9',
    type: 'BANK_SYNC_INFLOW',
    category: 'Fleet Operations, Fuel & Maintenance',
    description: 'E-Y Investment Treasury Auto-Sweep Inflow via ALATPay',
    currency: 'NGN',
    amount: 18500000,
    paymentChannel: 'Wema Bank ALAT Direct Sync',
    createdAtIso: '2026-10-13T09:00:00.000Z',
  },
];

export const INITIAL_BIDS: ActiveProxyBid[] = [
  {
    id: 'bid-1',
    lotId: 'SR-US-90418',
    vehicleTitle: '2021 Lexus RX 350 F-Sport AWD Executive',
    maxProxyBidUsd: 19400,
    depositPaidNgn: 4656000,
    alatpayReference: 'ALAT-EY-994810-A1',
    status: 'WINNING',
    createdAtIso: '2026-10-17T08:15:00.000Z',
  },
];

export const INITIAL_INSPECTIONS: ScheduledInspection[] = [
  {
    id: 'insp-1',
    lotId: 'SR-US-90418',
    vehicleTitle: '2021 Lexus RX 350 F-Sport AWD Executive',
    scheduledIso: '2026-10-19T15:00:00.000Z',
    inspectorName: 'Engr. Tunde Bakare (Smart Ride Newark Yard Lead)',
    specialistNotes: 'Verify cold-start engine harmonics, paint thickness gauge on front fenders, and live OBD-II telemetry.',
    status: 'CONFIRMED',
  },
];
