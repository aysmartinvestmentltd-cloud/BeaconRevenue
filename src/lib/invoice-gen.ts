/**
 * E-Y Investment Limited Automated Invoicing & Budget Statement Generator
 * Produces official corporate invoices and Google Drive export payloads.
 */

import type { LandingCostBreakdown } from './cost-matrix.ts';

export interface OfficialInvoiceInput {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  wemaVirtualAccount: string;
  lotId: string;
  vin: string;
  engineNumber: string;
  vehicleTitle: string;
  mileageMiles: number;
  departurePort: string;
  destinationPort: string;
  costBreakdown: LandingCostBreakdown;
  amountPaidNgn: number;
  issuedIso: string;
}

export interface GeneratedInvoiceDocument {
  invoiceNumber: string;
  corporateHeader: {
    companyName: string;
    rcNumber: string;
    tinNumber: string;
    headOfficeAddress: string;
    settlementBank: string;
    ngnCorporateAccount: string;
    usdDomiciliaryAccount: string;
    clientVirtualAccount: string;
  };
  vehicleSpec: {
    lotId: string;
    vin: string;
    engineNumber: string;
    vehicleTitle: string;
    mileageMiles: number;
    route: string;
  };
  financialSchedule: {
    bidHammerUsd: number;
    usPortTowingUsd: number;
    oceanFreightUsd: number;
    marineInsuranceUsd: number;
    customsDutyUsd: number;
    vatAndLevyUsd: number;
    terminalClearingUsd: number;
    eyBrokerageFeeUsd: number;
    totalLandingUsd: number;
    totalLandingNgn: number;
    amountPaidNgn: number;
    balanceOutstandingNgn: number;
    exchangeRate: number;
  };
  markdownContent: string;
}

export function generateOfficialEyInvoice(input: OfficialInvoiceInput): GeneratedInvoiceDocument {
  const { costBreakdown } = input;
  const balanceOutstandingNgn = Math.max(0, costBreakdown.totalLandingNgn - input.amountPaidNgn);

  const corporateHeader = {
    companyName: 'E-Y INVESTMENT LIMITED (SMART RIDE US AUTO DIRECT)',
    rcNumber: 'RC-1894022',
    tinNumber: 'TIN-24098112-0001',
    headOfficeAddress: 'Plot 14B Adeola Odeku Street, Victoria Island, Lagos, Nigeria',
    settlementBank: 'Wema Bank PLC / ALATPay Corporate Gateway',
    ngnCorporateAccount: '0124893021 (E-Y Investment Limited)',
    usdDomiciliaryAccount: '0621904418 (E-Y Investment USD Collections)',
    clientVirtualAccount: `${input.wemaVirtualAccount} (ALAT Dedicated Virtual Account)`,
  };

  const markdownContent = `# E-Y INVESTMENT LIMITED — OFFICIAL PROFORMA & LANDING INVOICE
**Platform**: Smart Ride US Auto Direct (100% Verified Stock)
**Corporate Registration**: ${corporateHeader.rcNumber} · ${corporateHeader.tinNumber}
**Head Office**: ${corporateHeader.headOfficeAddress}
**Invoice Ref**: ${input.invoiceNumber}
**Date Issued**: ${new Date(input.issuedIso).toUTCString()}

---

## 1. CLIENT & SETTLEMENT CREDENTIALS
- **Client Name**: ${input.clientName}
- **Client Email**: ${input.clientEmail}
- **Dedicated Wema Virtual Account (NGN)**: ${corporateHeader.clientVirtualAccount}
- **Corporate NGN Settlement Account**: ${corporateHeader.ngnCorporateAccount}
- **Corporate USD Domiciliary Account**: ${corporateHeader.usdDomiciliaryAccount}

---

## 2. VEHICLE SPECIFICATION (SMART RIDE VERIFIED STOCK)
- **Smart Ride Lot ID**: ${input.lotId}
- **Vehicle Description**: ${input.vehicleTitle}
- **Chassis / VIN**: ${input.vin}
- **Engine Number**: ${input.engineNumber}
- **Odometer Reading**: ${input.mileageMiles.toLocaleString()} miles (Actual Verified)
- **Logistics Route**: ${input.departurePort} -> ${input.destinationPort}

---

## 3. ITEMIZED FINANCIAL SCHEDULE (FX RATE: ₦${costBreakdown.exchangeRateUsed.toLocaleString()}/$1)
| Line Item | USD ($) | NGN (₦) |
| :--- | ---: | ---: |
| Vehicle Acquisition / Hammer Price | $${costBreakdown.purchasePriceUsd.toLocaleString()} | ₦${Math.round(costBreakdown.purchasePriceUsd * costBreakdown.exchangeRateUsed).toLocaleString()} |
| US Yard to Departure Port Towing (${input.departurePort}) | $${costBreakdown.usPortTowingUsd.toLocaleString()} | ₦${Math.round(costBreakdown.usPortTowingUsd * costBreakdown.exchangeRateUsed).toLocaleString()} |
| Ocean Shipping & Marine Transit | $${costBreakdown.oceanFreightUsd.toLocaleString()} | ₦${Math.round(costBreakdown.oceanFreightUsd * costBreakdown.exchangeRateUsed).toLocaleString()} |
| All-Risk Marine Transit Insurance (1.5%) | $${costBreakdown.marineInsuranceUsd.toLocaleString()} | ₦${Math.round(costBreakdown.marineInsuranceUsd * costBreakdown.exchangeRateUsed).toLocaleString()} |
| Nigeria Customs Service Import Tariff & NAC | $${costBreakdown.customsDutyUsdEquivalent.toLocaleString()} | ₦${Math.round(costBreakdown.customsDutyUsdEquivalent * costBreakdown.exchangeRateUsed).toLocaleString()} |
| Statutory 7.5% VAT & ECOWAS CISS Levy | $${costBreakdown.vatAndLevyUsdEquivalent.toLocaleString()} | ₦${Math.round(costBreakdown.vatAndLevyUsdEquivalent * costBreakdown.exchangeRateUsed).toLocaleString()} |
| Terminal Clearing (${input.destinationPort}) | $${costBreakdown.portTerminalClearingUsdEquivalent.toLocaleString()} | ₦${Math.round(costBreakdown.portTerminalClearingUsdEquivalent * costBreakdown.exchangeRateUsed).toLocaleString()} |
| E-Y Investment Brokerage Commission | $${costBreakdown.eyBrokerageFeeUsd.toLocaleString()} | ₦${Math.round(costBreakdown.eyBrokerageFeeUsd * costBreakdown.exchangeRateUsed).toLocaleString()} |
| **TOTAL LANDED ACQUISITION COST** | **$${costBreakdown.totalLandingUsd.toLocaleString()}** | **₦${costBreakdown.totalLandingNgn.toLocaleString()}** |
| **Total Verified Payments Received (ALATPay)** | — | **₦${input.amountPaidNgn.toLocaleString()}** |
| **NET BALANCE OUTSTANDING** | — | **₦${balanceOutstandingNgn.toLocaleString()}** |

---
*Digitally signed and tamper-protected by E-Y Investment Limited Treasury & ALATPay Settlement Engine.*
`;

  return {
    invoiceNumber: input.invoiceNumber,
    corporateHeader,
    vehicleSpec: {
      lotId: input.lotId,
      vin: input.vin,
      engineNumber: input.engineNumber,
      vehicleTitle: input.vehicleTitle,
      mileageMiles: input.mileageMiles,
      route: `${input.departurePort} to ${input.destinationPort}`,
    },
    financialSchedule: {
      bidHammerUsd: costBreakdown.purchasePriceUsd,
      usPortTowingUsd: costBreakdown.usPortTowingUsd,
      oceanFreightUsd: costBreakdown.oceanFreightUsd,
      marineInsuranceUsd: costBreakdown.marineInsuranceUsd,
      customsDutyUsd: costBreakdown.customsDutyUsdEquivalent,
      vatAndLevyUsd: costBreakdown.vatAndLevyUsdEquivalent,
      terminalClearingUsd: costBreakdown.portTerminalClearingUsdEquivalent,
      eyBrokerageFeeUsd: costBreakdown.eyBrokerageFeeUsd,
      totalLandingUsd: costBreakdown.totalLandingUsd,
      totalLandingNgn: costBreakdown.totalLandingNgn,
      amountPaidNgn: input.amountPaidNgn,
      balanceOutstandingNgn,
      exchangeRate: costBreakdown.exchangeRateUsed,
    },
    markdownContent,
  };
}
