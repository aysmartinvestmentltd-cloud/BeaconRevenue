/**
 * Smart Ride (by E-Y Investment Limited)
 * Deterministic US-to-Nigeria Landing Cost Matrix, Budget Insights & White-Label Sanitizer
 */

export type DeparturePort = 'Newark, NJ' | 'Houston, TX' | 'Savannah, GA';
export type ShippingMethod = 'RORO' | 'SHARED_CONTAINER';
export type NigerianPort = 'Apapa Port, Lagos' | 'Tin Can Island, Lagos';

export interface LandingCostInput {
  purchasePriceUsd: number;
  departurePort: DeparturePort;
  shippingMethod: ShippingMethod;
  destinationPort: NigerianPort;
  vehicleAgeYears: number;
  exchangeRateNgnPerUsd: number;
}

export interface LandingCostBreakdown {
  purchasePriceUsd: number;
  usPortTowingUsd: number;
  oceanFreightUsd: number;
  marineInsuranceUsd: number;
  customsDutyUsdEquivalent: number;
  vatAndLevyUsdEquivalent: number;
  portTerminalClearingUsdEquivalent: number;
  eyBrokerageFeeUsd: number;
  biddingDepositRequiredUsd: number;
  biddingDepositRequiredNgn: number;
  totalLandingUsd: number;
  totalLandingNgn: number;
  exchangeRateUsed: number;
}

export const US_PORT_TOWING_RATES: Record<DeparturePort, number> = {
  'Newark, NJ': 420,
  'Savannah, GA': 480,
  'Houston, TX': 550,
};

export const OCEAN_FREIGHT_RATES: Record<ShippingMethod, number> = {
  RORO: 1350,
  SHARED_CONTAINER: 1850,
};

export const TERMINAL_CLEARING_NGN: Record<NigerianPort, number> = {
  'Tin Can Island, Lagos': 680000,
  'Apapa Port, Lagos': 740000,
};

/**
 * Deterministic formula engine calculating US-to-Nigeria total landed cost
 * and refundable 15% ALATPay proxy bidding deposit commitment.
 */
export function calculateLandingCost(input: LandingCostInput): LandingCostBreakdown {
  const safePrice = Math.max(0, Number(input.purchasePriceUsd) || 0);
  const safeRate = Math.max(1, Number(input.exchangeRateNgnPerUsd) || 1600);

  const usPortTowingUsd = US_PORT_TOWING_RATES[input.departurePort] ?? 450;
  const oceanFreightUsd = OCEAN_FREIGHT_RATES[input.shippingMethod] ?? 1350;
  const marineInsuranceUsd = Math.round(safePrice * 0.015);

  // CIF (Cost, Insurance, Freight) base for Nigeria Customs Service
  const cifUsd = safePrice + oceanFreightUsd + marineInsuranceUsd;

  // Age-adjusted Nigeria Customs Surface Tariff (20% standard + 15% NAC levy)
  const dutyRate = input.vehicleAgeYears <= 5 ? 0.20 : 0.15;
  const customsDutyUsdEquivalent = Math.round(cifUsd * dutyRate);

  // 7.5% VAT + 5% ECOWAS & CISS Statutory Levies
  const vatAndLevyUsdEquivalent = Math.round((cifUsd + customsDutyUsdEquivalent) * 0.125);

  const clearingNgn = TERMINAL_CLEARING_NGN[input.destinationPort] ?? 680000;
  const portTerminalClearingUsdEquivalent = Math.round(clearingNgn / safeRate);

  // E-Y Investment Limited Executive Brokerage Commission (5% capped at $1,750, min $450)
  const rawCommission = Math.round(safePrice * 0.05);
  const eyBrokerageFeeUsd = Math.min(1750, Math.max(450, rawCommission));

  // 15% Refundable ALATPay Bidding Deposit
  const biddingDepositRequiredUsd = Math.round(safePrice * 0.15);
  const biddingDepositRequiredNgn = Math.round(biddingDepositRequiredUsd * safeRate);

  const totalLandingUsd =
    safePrice +
    usPortTowingUsd +
    oceanFreightUsd +
    marineInsuranceUsd +
    customsDutyUsdEquivalent +
    vatAndLevyUsdEquivalent +
    portTerminalClearingUsdEquivalent +
    eyBrokerageFeeUsd;

  const totalLandingNgn = Math.round(totalLandingUsd * safeRate);

  return {
    purchasePriceUsd: safePrice,
    usPortTowingUsd,
    oceanFreightUsd,
    marineInsuranceUsd,
    customsDutyUsdEquivalent,
    vatAndLevyUsdEquivalent,
    portTerminalClearingUsdEquivalent,
    eyBrokerageFeeUsd,
    biddingDepositRequiredUsd,
    biddingDepositRequiredNgn,
    totalLandingUsd,
    totalLandingNgn,
    exchangeRateUsed: safeRate,
  };
}

export interface BudgetCategoryRecord {
  id: string;
  name: string;
  currency: 'NGN' | 'USD';
  allocatedAmount: number;
  spentAmount: number;
  alertThresholdPct: number;
}

export interface BudgetHealthSummary {
  totalAllocatedNgn: number;
  totalSpentNgn: number;
  remainingBudgetNgn: number;
  utilizationPct: number;
  overThresholdCategories: string[];
  status: 'NOMINAL' | 'WARNING' | 'CRITICAL';
}

export function computeBudgetHealth(
  categories: BudgetCategoryRecord[],
  exchangeRateNgnPerUsd: number
): BudgetHealthSummary {
  const rate = Math.max(1, exchangeRateNgnPerUsd);
  let totalAllocatedNgn = 0;
  let totalSpentNgn = 0;
  const overThresholdCategories: string[] = [];

  for (const cat of categories) {
    const allocNgn = cat.currency === 'USD' ? cat.allocatedAmount * rate : cat.allocatedAmount;
    const spentNgn = cat.currency === 'USD' ? cat.spentAmount * rate : cat.spentAmount;
    totalAllocatedNgn += allocNgn;
    totalSpentNgn += spentNgn;

    const catPct = cat.allocatedAmount > 0 ? (cat.spentAmount / cat.allocatedAmount) * 100 : 0;
    if (catPct >= cat.alertThresholdPct) {
      overThresholdCategories.push(cat.name);
    }
  }

  const remainingBudgetNgn = totalAllocatedNgn - totalSpentNgn;
  const utilizationPct =
    totalAllocatedNgn > 0 ? Math.round((totalSpentNgn / totalAllocatedNgn) * 1000) / 10 : 0;

  let status: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL';
  if (utilizationPct >= 95) {
    status = 'CRITICAL';
  } else if (utilizationPct >= 80 || overThresholdCategories.length > 0) {
    status = 'WARNING';
  }

  return {
    totalAllocatedNgn: Math.round(totalAllocatedNgn),
    totalSpentNgn: Math.round(totalSpentNgn),
    remainingBudgetNgn: Math.round(remainingBudgetNgn),
    utilizationPct,
    overThresholdCategories,
    status,
  };
}

/**
 * Strict White-Label Sanitizer:
 * Strips any external third-party auction platform names and replaces with
 * Smart Ride US Direct Inventory / E-Y Investment Verified Stock.
 */
export function sanitizeWhiteLabelText(rawText: string): string {
  if (!rawText) return 'Smart Ride US Direct Inventory';
  return rawText
    .replace(/\b(copart|iaai|manheim|adesa|insurance auto auctions)\b/gi, 'Smart Ride US Direct')
    .replace(/\b(external salvage yard|third-party auction)\b/gi, 'Smart Ride Verified Hub');
}
