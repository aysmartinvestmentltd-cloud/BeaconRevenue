import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLandingCost,
  computeBudgetHealth,
  sanitizeWhiteLabelText,
} from './cost-matrix.ts';
import {
  generateDedicatedWemaVirtualAccount,
  computeAlatPayWebhookHash,
  verifyAlatPayWebhookSignature,
  initiateAlatPayTransaction,
} from './alatpay.ts';
import { generateOfficialEyInvoice } from './invoice-gen.ts';

test('calculateLandingCost computes deterministic US-to-Nigeria landed cost and 15% ALATPay deposit', () => {
  const result = calculateLandingCost({
    purchasePriceUsd: 20000,
    departurePort: 'Newark, NJ',
    shippingMethod: 'RORO',
    destinationPort: 'Tin Can Island, Lagos',
    vehicleAgeYears: 4,
    exchangeRateNgnPerUsd: 1600,
  });

  assert.equal(result.purchasePriceUsd, 20000);
  assert.equal(result.usPortTowingUsd, 420);
  assert.equal(result.oceanFreightUsd, 1350);
  assert.equal(result.marineInsuranceUsd, 300); // 1.5% of 20000
  assert.equal(result.biddingDepositRequiredUsd, 3000); // 15% of 20000
  assert.equal(result.biddingDepositRequiredNgn, 4800000); // 3000 * 1600
  assert.equal(result.eyBrokerageFeeUsd, 1000); // 5% of 20000
  assert.ok(result.totalLandingUsd > 28000);
  assert.equal(result.totalLandingNgn, result.totalLandingUsd * 1600);
});

test('computeBudgetHealth evaluates multi-currency categories and threshold alerts', () => {
  const summary = computeBudgetHealth(
    [
      {
        id: '1',
        name: 'US Vehicle Acquisition',
        currency: 'USD',
        allocatedAmount: 10000,
        spentAmount: 9000,
        alertThresholdPct: 85,
      },
      {
        id: '2',
        name: 'Apapa Clearing & Logistics',
        currency: 'NGN',
        allocatedAmount: 4000000,
        spentAmount: 2000000,
        alertThresholdPct: 80,
      },
    ],
    1600
  );

  // 10000 USD * 1600 = 16,000,000 + 4,000,000 = 20,000,000
  assert.equal(summary.totalAllocatedNgn, 20000000);
  // 9000 USD * 1600 = 14,400,000 + 2,000,000 = 16,400,000
  assert.equal(summary.totalSpentNgn, 16400000);
  assert.equal(summary.remainingBudgetNgn, 3600000);
  assert.equal(summary.utilizationPct, 82);
  assert.deepEqual(summary.overThresholdCategories, ['US Vehicle Acquisition']);
  assert.equal(summary.status, 'WARNING');
});

test('sanitizeWhiteLabelText strips any external auction names', () => {
  const sanitized = sanitizeWhiteLabelText('Lot from Copart and IAAI external salvage yard');
  assert.equal(sanitized.includes('Copart'), false);
  assert.equal(sanitized.includes('IAAI'), false);
  assert.ok(sanitized.includes('Smart Ride US Direct'));
});

test('ALATPay virtual account and HMAC-SHA512 webhook verification are deterministic and tamper-proof', () => {
  const virtualAcc = generateDedicatedWemaVirtualAccount('user-123');
  assert.equal(virtualAcc.length, 10);
  assert.equal(virtualAcc.startsWith('78'), true);

  const payload = JSON.stringify({ reference: 'ALAT-EY-1001', amount: 1500000 });
  const secret = 'test_wema_secret_key';
  const sig = computeAlatPayWebhookHash(payload, secret);

  assert.equal(verifyAlatPayWebhookSignature(payload, sig, secret), true);
  assert.equal(verifyAlatPayWebhookSignature(payload, 'invalid_sig', secret), false);

  const tx = initiateAlatPayTransaction({
    userId: 'user-123',
    email: 'client@eyinvestment.com',
    fullName: 'Chief Adewale',
    amount: 2400000,
    currency: 'NGN',
    channel: 'WEMA_VIRTUAL_ACCOUNT',
    purpose: 'BIDDING_DEPOSIT',
    lotId: 'SR-US-90418',
  });
  assert.ok(tx.reference.startsWith('ALAT-EY-'));
  assert.equal(tx.virtualAccountNumber, virtualAcc);
});

test('generateOfficialEyInvoice builds corporate invoice with RC number and balance math', () => {
  const breakdown = calculateLandingCost({
    purchasePriceUsd: 18500,
    departurePort: 'Houston, TX',
    shippingMethod: 'RORO',
    destinationPort: 'Tin Can Island, Lagos',
    vehicleAgeYears: 3,
    exchangeRateNgnPerUsd: 1600,
  });

  const doc = generateOfficialEyInvoice({
    invoiceNumber: 'EY-INV-2026-9001',
    clientName: 'Dr. Ngozi Okonkwo',
    clientEmail: 'ngozi@biotech.ng',
    wemaVirtualAccount: '7841029384',
    lotId: 'SR-US-90418',
    vin: '2T2BZMCA9MC104921',
    engineNumber: '2GR-FKS-884120',
    vehicleTitle: '2021 Lexus RX 350 F-Sport AWD',
    mileageMiles: 24180,
    departurePort: 'Houston, TX',
    destinationPort: 'Tin Can Island, Lagos',
    costBreakdown: breakdown,
    amountPaidNgn: 5000000,
    issuedIso: '2026-10-17T10:00:00.000Z',
  });

  assert.equal(doc.corporateHeader.rcNumber, 'RC-1894022');
  assert.equal(
    doc.financialSchedule.balanceOutstandingNgn,
    breakdown.totalLandingNgn - 5000000
  );
  assert.ok(doc.markdownContent.includes('E-Y INVESTMENT LIMITED'));
});
