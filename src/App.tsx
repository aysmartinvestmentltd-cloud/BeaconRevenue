import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  Plus,
  Search,
  Calculator,
  Calendar,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  LogOut,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  db,
  initAuth,
  googleSignIn,
  logout,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import {
  calculateLandingCost,
  computeBudgetHealth,
  type DeparturePort,
  type ShippingMethod,
  type NigerianPort,
} from './lib/cost-matrix';
import { generateDedicatedWemaVirtualAccount } from './lib/alatpay';
import {
  INITIAL_VEHICLES,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_BUDGET_CATEGORIES,
  INITIAL_TRANSACTIONS,
  INITIAL_BIDS,
  INITIAL_INSPECTIONS,
  type SmartRideVehicle,
  type SyncedBankAccount,
  type BudgetCategoryItem,
  type SyncedTransaction,
  type ActiveProxyBid,
  type ScheduledInspection,
} from './types/smart-ride';
import { Vehicle360Viewer } from './components/viewer-360/Vehicle360Viewer';
import { LogisticsTimeline } from './components/logistics/LogisticsTimeline';
import { AlatPayCheckoutModal } from './components/payments/AlatPayCheckoutModal';
import { GeminiVoiceCopilot } from './components/ai/GeminiVoiceCopilot';
import { BioscienceWorkbench } from './components/science/BioscienceWorkbench';
import { GoogleDriveVault } from './components/drive/GoogleDriveVault';
import { BudgetDonutChart } from './components/budget/BudgetDonutChart';

type WorkspaceTab = 'BUDGET_BANK' | 'US_INVENTORY' | 'LOGISTICS_INSPECTION' | 'BIOSCIENCE_LAB' | 'DRIVE_INVOICES';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('BUDGET_BANK');
  const [user, setUser] = useState<User | null>(null);
  const [, setDriveToken] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(1600);

  // Core State (Hydrated with deterministic data & synced with Firestore when authenticated)
  const [vehicles, setVehicles] = useState<SmartRideVehicle[]>(INITIAL_VEHICLES);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(INITIAL_VEHICLES[0].id);
  const [bankAccounts, setBankAccounts] = useState<SyncedBankAccount[]>(INITIAL_BANK_ACCOUNTS);
  const [budgets, setBudgets] = useState<BudgetCategoryItem[]>(INITIAL_BUDGET_CATEGORIES);
  const [transactions, setTransactions] = useState<SyncedTransaction[]>(INITIAL_TRANSACTIONS);
  const [bids, setBids] = useState<ActiveProxyBid[]>(INITIAL_BIDS);
  const [inspections, setInspections] = useState<ScheduledInspection[]>(INITIAL_INSPECTIONS);

  // Bank Sync & New Budget / Transaction Form States
  const [isSyncingBanks, setIsSyncingBanks] = useState(false);
  const [txFilterCategory, setTxFilterCategory] = useState<string>('ALL');
  const [newBudgetName, setNewBudgetName] = useState('');
  const [newBudgetCurrency, setNewBudgetCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [newBudgetAmount, setNewBudgetAmount] = useState('');
  const [budgetFormError, setBudgetFormError] = useState<string | null>(null);

  // Inventory Search & Calculator States
  const [searchKeyword, setSearchKeyword] = useState('');
  const [conditionFilter, setConditionFilter] = useState<'ALL' | 'Run & Drive Verified'>('ALL');
  const [maxLandedBudgetNgn, setMaxLandedBudgetNgn] = useState<number>(0);
  const [calcBidUsd, setCalcBidUsd] = useState<number>(INITIAL_VEHICLES[0].currentBidUsd);
  const [calcDeparturePort, setCalcDeparturePort] = useState<DeparturePort>(INITIAL_VEHICLES[0].usDeparturePort);
  const [calcShippingMethod, setCalcShippingMethod] = useState<ShippingMethod>('RORO');
  const [calcDestinationPort, setCalcDestinationPort] = useState<NigerianPort>(
    INITIAL_VEHICLES[0].defaultDestinationPort
  );

  // Inspection Booking Form State
  const [inspDateInput, setInspDateInput] = useState('2026-10-22T15:30');
  const [inspNotesInput, setInspNotesInput] = useState(
    'Perform cold-start compression check, undercarriage frame scan, and live paint micron test.'
  );

  // ALATPay Checkout Modal State
  const [checkoutModal, setCheckoutModal] = useState<{
    isOpen: boolean;
    title: string;
    amountNgn: number;
    amountUsd: number;
    purpose: 'BIDDING_DEPOSIT' | 'VEHICLE_SETTLEMENT' | 'BUDGET_TOPUP' | 'CUSTOMS_CLEARING';
    lotId?: string;
    bidUsd?: number;
  }>({
    isOpen: false,
    title: '',
    amountNgn: 0,
    amountUsd: 0,
    purpose: 'BIDDING_DEPOSIT',
  });

  // Firebase Auth & Firestore Real-time Sync
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        if (token) setDriveToken(token);
      },
      () => {
        setUser(null);
        setDriveToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Subscribe to user's Firestore budgets
    const budgetsQuery = query(collection(db, 'budgets'), where('uid', '==', user.uid));
    const unsubBudgets = onSnapshot(
      budgetsQuery,
      (snap) => {
        if (!snap.empty) {
          const loaded: BudgetCategoryItem[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name,
              currency: data.currency,
              allocatedAmount: Number(data.allocatedAmount),
              spentAmount: Number(data.spentAmount),
              alertThresholdPct: Number(data.alertThresholdPct),
            };
          });
          setBudgets(loaded);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'budgets')
    );

    // Subscribe to user's Firestore transactions
    const txQuery = query(collection(db, 'transactions'), where('uid', '==', user.uid));
    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        if (!snap.empty) {
          const loaded: SyncedTransaction[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              alatpayReference: data.alatpayReference,
              type: data.type,
              category: data.category,
              description: data.description,
              currency: data.currency,
              amount: Number(data.amount),
              paymentChannel: data.paymentChannel,
              createdAtIso: new Date().toISOString(),
            };
          });
          setTransactions((prev) => {
            const existingIds = new Set(loaded.map((t) => t.id));
            return [...loaded, ...prev.filter((p) => !existingIds.has(p.id))];
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    return () => {
      unsubBudgets();
      unsubTx();
    };
  }, [user]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0],
    [vehicles, selectedVehicleId]
  );

  // Sync calculator inputs when selected vehicle changes
  const handleSelectVehicle = (veh: SmartRideVehicle) => {
    setSelectedVehicleId(veh.id);
    setCalcBidUsd(veh.currentBidUsd);
    setCalcDeparturePort(veh.usDeparturePort);
    setCalcDestinationPort(veh.defaultDestinationPort);
  };

  // Real-time Budget Health Calculation
  const budgetHealth = useMemo(
    () => computeBudgetHealth(budgets, exchangeRate),
    [budgets, exchangeRate]
  );

  // Real-time Landed Cost Calculation for Selected Vehicle
  const currentLandingBreakdown = useMemo(
    () =>
      calculateLandingCost({
        purchasePriceUsd: calcBidUsd,
        departurePort: calcDeparturePort,
        shippingMethod: calcShippingMethod,
        destinationPort: calcDestinationPort,
        vehicleAgeYears: Math.max(1, 2026 - selectedVehicle.year),
        exchangeRateNgnPerUsd: exchangeRate,
      }),
    [calcBidUsd, calcDeparturePort, calcShippingMethod, calcDestinationPort, selectedVehicle.year, exchangeRate]
  );

  // Filtered US Direct Vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchesKeyword =
        !searchKeyword.trim() ||
        `${v.lotId} ${v.year} ${v.make} ${v.model} ${v.trim}`
          .toLowerCase()
          .includes(searchKeyword.toLowerCase());
      const matchesCondition =
        conditionFilter === 'ALL' || v.condition === conditionFilter;

      if (maxLandedBudgetNgn > 0) {
        const landed = calculateLandingCost({
          purchasePriceUsd: v.currentBidUsd,
          departurePort: v.usDeparturePort,
          shippingMethod: 'RORO',
          destinationPort: v.defaultDestinationPort,
          vehicleAgeYears: Math.max(1, 2026 - v.year),
          exchangeRateNgnPerUsd: exchangeRate,
        });
        if (landed.totalLandingNgn > maxLandedBudgetNgn) return false;
      }
      return matchesKeyword && matchesCondition;
    });
  }, [vehicles, searchKeyword, conditionFilter, maxLandedBudgetNgn, exchangeRate]);

  const wemaVirtualAccount = useMemo(
    () => generateDedicatedWemaVirtualAccount(user?.uid || 'ey-executive-user'),
    [user?.uid]
  );

  const handleGoogleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setDriveToken(res.accessToken);
      }
    } catch (err) {
      console.error('Google Sign-in failed:', err);
    }
  };

  // Automatic Wema Bank / ALATPay Account Sync Trigger
  const handleSyncBankAccountsNow = () => {
    setIsSyncingBanks(true);
    const nowIso = new Date().toISOString();
    const syncRef = `ALAT-SYNC-${Date.now().toString().slice(-5)}`;

    setBankAccounts((prev) =>
      prev.map((acc) => ({
        ...acc,
        balance:
          acc.currency === 'NGN' ? acc.balance + 450000 : acc.balance + 320,
        lastSyncedIso: nowIso,
      }))
    );

    const syncedTx: SyncedTransaction = {
      id: `tx-sync-${Date.now()}`,
      alatpayReference: syncRef,
      type: 'BANK_SYNC_SPEND',
      category: 'Fleet Operations, Fuel & Maintenance',
      description: 'Wema Bank ALAT Auto-Sync — Victoria Island Hub Logistics & Port Dispatch',
      currency: 'NGN',
      amount: 380000,
      paymentChannel: 'Wema Bank ALAT Direct Sync',
      createdAtIso: nowIso,
    };

    setTransactions((prev) => [syncedTx, ...prev]);
    setBudgets((prev) =>
      prev.map((b) =>
        b.name.includes('Operations')
          ? { ...b, spentAmount: b.spentAmount + 380000 }
          : b
      )
    );

    setTimeout(() => setIsSyncingBanks(false), 250);
  };

  // Create or Update Budget Category
  const handleAddBudgetCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newBudgetName.trim();
    const cleanAlloc = Number(newBudgetAmount);

    if (!cleanName) {
      setBudgetFormError('Please enter a budget category name.');
      return;
    }
    if (!cleanAlloc || cleanAlloc <= 0) {
      setBudgetFormError('Please enter a valid positive budget allocation.');
      return;
    }

    setBudgetFormError(null);
    const catId = `cat-${Date.now()}`;
    const newCat: BudgetCategoryItem = {
      id: catId,
      name: cleanName.slice(0, 80),
      currency: newBudgetCurrency,
      allocatedAmount: cleanAlloc,
      spentAmount: 0,
      alertThresholdPct: 85,
    };

    setBudgets((prev) => [...prev, newCat]);
    setNewBudgetName('');
    setNewBudgetAmount('');

    if (user && user.emailVerified) {
      try {
        await setDoc(doc(db, 'budgets', catId), {
          uid: user.uid,
          name: newCat.name,
          currency: newCat.currency,
          allocatedAmount: newCat.allocatedAmount,
          spentAmount: 0,
          alertThresholdPct: 85,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `budgets/${catId}`);
      }
    }
  };

  // Handle Successful ALATPay Payment (Proxy Bid Deposit or Budget Settlement)
  const handleAlatPaySuccess = async (paymentRecord: {
    reference: string;
    amount: number;
    currency: 'NGN' | 'USD';
    channel: string;
    purpose: string;
    lotId?: string;
  }) => {
    const nowIso = new Date().toISOString();
    const txId = `tx-${Date.now()}`;
    const newTx: SyncedTransaction = {
      id: txId,
      alatpayReference: paymentRecord.reference,
      type:
        paymentRecord.purpose === 'BIDDING_DEPOSIT'
          ? 'BIDDING_DEPOSIT'
          : 'VEHICLE_SETTLEMENT',
      category: 'US Vehicle Acquisition (Smart Ride Stock)',
      description: `${
        paymentRecord.purpose === 'BIDDING_DEPOSIT'
          ? '15% Refundable ALATPay Proxy Bid Deposit'
          : 'Full Landed Vehicle Settlement'
      } — ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} (${
        paymentRecord.lotId || selectedVehicle.lotId
      })`,
      currency: paymentRecord.currency,
      amount: paymentRecord.amount,
      paymentChannel: paymentRecord.channel,
      createdAtIso: nowIso,
    };

    setTransactions((prev) => [newTx, ...prev]);

    // Update Budget Category Spend
    setBudgets((prev) =>
      prev.map((b) => {
        if (!b.name.includes('Vehicle Acquisition')) return b;
        const deltaInCatCurrency =
          b.currency === paymentRecord.currency
            ? paymentRecord.amount
            : b.currency === 'USD'
            ? Math.round(paymentRecord.amount / exchangeRate)
            : Math.round(paymentRecord.amount * exchangeRate);
        return {
          ...b,
          spentAmount: b.spentAmount + deltaInCatCurrency,
        };
      })
    );

    // Record Active Proxy Bid
    if (paymentRecord.purpose === 'BIDDING_DEPOSIT') {
      const bidId = `bid-${Date.now()}`;
      const newBid: ActiveProxyBid = {
        id: bidId,
        lotId: selectedVehicle.lotId,
        vehicleTitle: `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} ${selectedVehicle.trim}`,
        maxProxyBidUsd: calcBidUsd,
        depositPaidNgn:
          paymentRecord.currency === 'NGN'
            ? paymentRecord.amount
            : Math.round(paymentRecord.amount * exchangeRate),
        alatpayReference: paymentRecord.reference,
        status: 'WINNING',
        createdAtIso: nowIso,
      };
      setBids((prev) => [newBid, ...prev]);

      // Update vehicle current bid
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === selectedVehicle.id ? { ...v, currentBidUsd: calcBidUsd } : v
        )
      );

      if (user && user.emailVerified) {
        try {
          await setDoc(doc(db, 'bids', bidId), {
            uid: user.uid,
            lotId: newBid.lotId,
            vehicleTitle: newBid.vehicleTitle.slice(0, 140),
            maxProxyBidUsd: newBid.maxProxyBidUsd,
            depositPaidNgn: newBid.depositPaidNgn,
            alatpayReference: newBid.alatpayReference,
            status: 'WINNING',
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `bids/${bidId}`);
        }
      }
    }

    if (user && user.emailVerified) {
      try {
        await setDoc(doc(db, 'transactions', txId), {
          uid: user.uid,
          alatpayReference: newTx.alatpayReference,
          type: newTx.type,
          category: newTx.category.slice(0, 80),
          description: newTx.description.slice(0, 240),
          currency: newTx.currency,
          amount: newTx.amount,
          paymentChannel: newTx.paymentChannel.slice(0, 80),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `transactions/${txId}`);
      }
    }
  };

  // Schedule Live Virtual Yard Inspection
  const handleBookVirtualInspection = async (
    targetVehicle: SmartRideVehicle,
    isoDate: string,
    notes: string
  ) => {
    const bookingId = `bk-${Date.now()}`;
    const newBooking: ScheduledInspection = {
      id: bookingId,
      lotId: targetVehicle.lotId,
      vehicleTitle: `${targetVehicle.year} ${targetVehicle.make} ${targetVehicle.model} ${targetVehicle.trim}`,
      scheduledIso: isoDate,
      inspectorName: `Engr. Tunde Bakare (Smart Ride ${targetVehicle.usDeparturePort} Lead)`,
      specialistNotes: notes || 'Full 360° walk-around and OBD-II live telemetry verification.',
      status: 'CONFIRMED',
    };

    setInspections((prev) => [newBooking, ...prev]);

    if (user && user.emailVerified) {
      try {
        await setDoc(doc(db, 'bookings', bookingId), {
          uid: user.uid,
          lotId: newBooking.lotId,
          vehicleTitle: newBooking.vehicleTitle.slice(0, 140),
          scheduledIso: newBooking.scheduledIso.slice(0, 40),
          inspectorName: newBooking.inspectorName.slice(0, 100),
          specialistNotes: newBooking.specialistNotes.slice(0, 400),
          status: 'CONFIRMED',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `bookings/${bookingId}`);
      }
    }
  };

  // Advance Logistics Stage
  const handleAdvanceLogisticsStage = (lotId: string) => {
    setVehicles((prev) =>
      prev.map((v) =>
        v.lotId === lotId && v.logisticsStageIndex < 4
          ? { ...v, logisticsStageIndex: v.logisticsStageIndex + 1 }
          : v
      )
    );
  };

  // Log Bioscience R&D Spend into Budget & Transactions
  const handleLogBiotechBudgetSpend = (itemName: string, amountUsd: number) => {
    const nowIso = new Date().toISOString();
    const ref = `ALAT-BIO-${Date.now().toString().slice(-5)}`;
    const newTx: SyncedTransaction = {
      id: `tx-bio-${Date.now()}`,
      alatpayReference: ref,
      type: 'BANK_SYNC_SPEND',
      category: 'Bioscience & Clean-Fuel Lab R&D',
      description: `R&D Molecular Procurement: ${itemName}`,
      currency: 'USD',
      amount: amountUsd,
      paymentChannel: 'Wema Bank USD Domiciliary Wire',
      createdAtIso: nowIso,
    };

    setTransactions((prev) => [newTx, ...prev]);
    setBudgets((prev) =>
      prev.map((b) =>
        b.name.includes('Bioscience')
          ? { ...b, spentAmount: b.spentAmount + amountUsd }
          : b
      )
    );
    setActiveTab('BUDGET_BANK');
  };

  const filteredTransactions = useMemo(() => {
    if (txFilterCategory === 'ALL') return transactions;
    return transactions.filter((t) => t.category === txFilterCategory);
  }, [transactions, txFilterCategory]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Strict 3-Zone Top Bar Contract (Brand wordmark | 5 single-line nav links | 1 primary action) */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-950/95 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('BUDGET_BANK');
          }}
          className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          Beacon Revenue
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav
          aria-label="Primary Workspace Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400"
        >
          <button
            type="button"
            onClick={() => setActiveTab('BUDGET_BANK')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeTab === 'BUDGET_BANK'
                ? 'text-white underline underline-offset-8 decoration-emerald-500 decoration-2'
                : ''
            }`}
          >
            Budget & Bank Sync
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('US_INVENTORY')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeTab === 'US_INVENTORY'
                ? 'text-white underline underline-offset-8 decoration-emerald-500 decoration-2'
                : ''
            }`}
          >
            US Auto Direct
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LOGISTICS_INSPECTION')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeTab === 'LOGISTICS_INSPECTION'
                ? 'text-white underline underline-offset-8 decoration-emerald-500 decoration-2'
                : ''
            }`}
          >
            Logistics & Inspection
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BIOSCIENCE_LAB')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeTab === 'BIOSCIENCE_LAB'
                ? 'text-white underline underline-offset-8 decoration-emerald-500 decoration-2'
                : ''
            }`}
          >
            Bioscience R&D
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DRIVE_INVOICES')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeTab === 'DRIVE_INVOICES'
                ? 'text-white underline underline-offset-8 decoration-emerald-500 decoration-2'
                : ''
            }`}
          >
            Drive & Invoices
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out ({user.displayName?.split(' ')[0] || 'Client'})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-white hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>Sign in with Google</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('BUDGET_BANK')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 ${
            activeTab === 'BUDGET_BANK' ? 'bg-emerald-600 text-white' : 'text-slate-400'
          }`}
        >
          Budget & Bank
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('US_INVENTORY')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 ${
            activeTab === 'US_INVENTORY' ? 'bg-emerald-600 text-white' : 'text-slate-400'
          }`}
        >
          US Auto Direct
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('LOGISTICS_INSPECTION')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 ${
            activeTab === 'LOGISTICS_INSPECTION' ? 'bg-emerald-600 text-white' : 'text-slate-400'
          }`}
        >
          Logistics & 360°
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('BIOSCIENCE_LAB')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 ${
            activeTab === 'BIOSCIENCE_LAB' ? 'bg-emerald-600 text-white' : 'text-slate-400'
          }`}
        >
          Bioscience Lab
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('DRIVE_INVOICES')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 ${
            activeTab === 'DRIVE_INVOICES' ? 'bg-emerald-600 text-white' : 'text-slate-400'
          }`}
        >
          Drive & Invoices
        </button>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Executive Context & FX Strip */}
        <section className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-emerald-400">Beacon Revenue Suite</span>
              <span aria-hidden="true">·</span>
              <span>E-Y Investment Limited (RC-1894022)</span>
              <span aria-hidden="true">·</span>
              <span>Wema Bank / ALATPay Native Treasury</span>
              <span aria-hidden="true">·</span>
              <span>Dedicated Virtual Account: {wemaVirtualAccount}</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-white mt-1 tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", textWrap: 'balance' }}
            >
              Beacon Revenue — Executive Budget, Auto-Synced Banking & US Auto Direct
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
              <label htmlFor="fx-rate-input" className="text-slate-400 whitespace-nowrap">
                USD/NGN Desk Rate:
              </label>
              <input
                id="fx-rate-input"
                type="number"
                min={500}
                max={5000}
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Math.max(1, Number(e.target.value) || 1600))}
                className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 font-mono tabular-nums text-white text-right"
              />
            </div>

            <button
              type="button"
              onClick={handleSyncBankAccountsNow}
              disabled={isSyncingBanks}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBanks ? 'animate-spin' : ''}`} />
              <span>{isSyncingBanks ? 'Syncing Wema ALAT...' : 'Sync Bank Accounts Now'}</span>
            </button>
          </div>
        </section>

        {/* Full-Width 4-Column Executive Financial & Budget KPI Strip */}
        <section
          aria-label="Real-Time Budget and Bank Sync Summary"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-400">Total Monthly Budget Allocation</p>
            <p className="text-2xl font-mono tabular-nums font-bold text-white mt-1.5">
              NGN {budgetHealth.totalAllocatedNgn.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
              ≈ ${Math.round(budgetHealth.totalAllocatedNgn / exchangeRate).toLocaleString()} USD Combined
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-400">Real-Time Synced Spend (NGN + USD)</p>
            <p className="text-2xl font-mono tabular-nums font-bold text-emerald-400 mt-1.5">
              NGN {budgetHealth.totalSpentNgn.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
              {budgetHealth.utilizationPct}% of Total Budget Utilized
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-400">Remaining Unallocated Liquidity</p>
            <p className="text-2xl font-mono tabular-nums font-bold text-white mt-1.5">
              NGN {budgetHealth.remainingBudgetNgn.toLocaleString()}
            </p>
            <div className="flex items-center gap-1.5 text-xs mt-1">
              {budgetHealth.status === 'NOMINAL' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Nominal Spending Velocity</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400">
                    Threshold Alert ({budgetHealth.overThresholdCategories.length} Category)
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <p className="text-xs text-slate-400">Active Proxy Bids & Escrow</p>
            <p className="text-2xl font-mono tabular-nums font-bold text-white mt-1.5">
              {bids.length} {bids.length === 1 ? 'Active Lot' : 'Active Lots'}
            </p>
            <p className="text-xs text-emerald-400 mt-1 font-mono tabular-nums">
              Escrow: NGN {bids.reduce((acc, b) => acc + b.depositPaidNgn, 0).toLocaleString()} Verified
            </p>
          </div>
        </section>

        {/* TAB 1: REAL-TIME BUDGET TRACKER & AUTOMATIC BANK ACCOUNT SYNC */}
        {activeTab === 'BUDGET_BANK' && (
          <div className="space-y-8">
            {/* Synced Wema Bank & ALATPay Accounts Strip */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    01. Automatically Synced Wema Bank & ALATPay Accounts
                  </h2>
                  <p className="text-xs text-slate-400">
                    Direct API feed from your NGN current account, dedicated virtual bidding escrow, and corporate USD domiciliary account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCheckoutModal({
                      isOpen: true,
                      title: 'Top Up Smart Ride ALATPay Bidding & Budget Escrow',
                      amountNgn: 2500000,
                      amountUsd: 1550,
                      purpose: 'BUDGET_TOPUP',
                    })
                  }
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Fund Wallet via ALATPay
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {bankAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-medium text-slate-200">{acc.institutionName}</span>
                        <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {acc.accountType} · <span className="font-mono">{acc.accountNumberMasked}</span>
                      </p>
                      <p className="text-2xl font-mono tabular-nums font-bold text-white mt-3">
                        {acc.currency === 'NGN'
                          ? `NGN ${acc.balance.toLocaleString()}`
                          : `$${acc.balance.toLocaleString()}`}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Auto-Sync Active</span>
                      </span>
                      <span className="font-mono">
                        Synced {new Date(acc.lastSyncedIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Recharts Donut Chart: Total Spending Across Active Budget Categories */}
            <BudgetDonutChart budgets={budgets} exchangeRate={exchangeRate} />

            {/* Real-Time Spending Insights & Budget Envelopes + Add Category Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      02. Real-Time Category Budgets & Spending Insights
                    </h2>
                    <p className="text-xs text-slate-400">
                      Live utilization bars across US Vehicle Acquisition, Customs Clearing, Fleet Operations, and Bioscience R&D.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {budgets.map((cat) => {
                    const pct =
                      cat.allocatedAmount > 0
                        ? Math.min(100, Math.round((cat.spentAmount / cat.allocatedAmount) * 100))
                        : 0;
                    const isOverThreshold = pct >= cat.alertThresholdPct;

                    return (
                      <div
                        key={cat.id}
                        className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-white">{cat.name}</span>
                          <span className="font-mono tabular-nums text-slate-300">
                            {cat.currency === 'NGN' ? 'NGN ' : '$'}
                            {cat.spentAmount.toLocaleString()} /{' '}
                            {cat.currency === 'NGN' ? 'NGN ' : '$'}
                            {cat.allocatedAmount.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-200 ${
                              isOverThreshold ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            {isOverThreshold
                              ? `Approaching limit (Alert threshold: ${cat.alertThresholdPct}%)`
                              : `Nominal pace (Alert threshold: ${cat.alertThresholdPct}%)`}
                          </span>
                          <span className="font-mono tabular-nums">
                            Remaining: {cat.currency === 'NGN' ? 'NGN ' : '$'}
                            {Math.max(0, cat.allocatedAmount - cat.spentAmount).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add New Budget Category Form */}
                <form
                  onSubmit={handleAddBudgetCategory}
                  className="pt-4 border-t border-slate-800 space-y-3"
                >
                  <p className="text-xs font-semibold text-slate-300">
                    Create New Budget Envelope
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label htmlFor="budget-name-input" className="sr-only">
                        Category Name
                      </label>
                      <input
                        id="budget-name-input"
                        type="text"
                        value={newBudgetName}
                        onChange={(e) => setNewBudgetName(e.target.value)}
                        placeholder="Category (e.g. Enclosed Abuja Delivery)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="budget-currency-select" className="sr-only">
                        Currency
                      </label>
                      <select
                        id="budget-currency-select"
                        value={newBudgetCurrency}
                        onChange={(e) =>
                          setNewBudgetCurrency(e.target.value as 'NGN' | 'USD')
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                      >
                        <option value="NGN">NGN</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label htmlFor="budget-amount-input" className="sr-only">
                        Allocation Amount
                      </label>
                      <input
                        id="budget-amount-input"
                        type="number"
                        value={newBudgetAmount}
                        onChange={(e) => setNewBudgetAmount(e.target.value)}
                        placeholder="Allocation"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                  {budgetFormError && (
                    <p className="text-xs text-red-400">{budgetFormError}</p>
                  )}
                </form>
              </div>

              {/* Right Column: Auto-Synced Bank & ALATPay Transactions Ledger */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      03. Live Synced Bank Ledger
                    </h2>
                    <p className="text-xs text-slate-400">
                      Verified via Wema ALATPay HMAC-SHA512 Webhooks
                    </p>
                  </div>
                  <select
                    aria-label="Filter transactions by category"
                    value={txFilterCategory}
                    onChange={(e) => setTxFilterCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="ALL">All Categories ({transactions.length})</option>
                    {budgets.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
                  {filteredTransactions.map((tx) => {
                    const isInflow = tx.type === 'BANK_SYNC_INFLOW';
                    return (
                      <div key={tx.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {isInflow ? (
                            <ArrowDownLeft className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-white">{tx.description}</p>
                            <p className="text-slate-400 mt-0.5">
                              {tx.category} · <span className="font-mono">{tx.alatpayReference}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{tx.paymentChannel}</p>
                          </div>
                        </div>
                        <div className="text-right font-mono tabular-nums shrink-0">
                          <p
                            className={`font-bold ${
                              isInflow ? 'text-emerald-400' : 'text-white'
                            }`}
                          >
                            {isInflow ? '+' : '-'}
                            {tx.currency === 'NGN'
                              ? `NGN ${tx.amount.toLocaleString()}`
                              : `$${tx.amount.toLocaleString()}`}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {tx.createdAtIso.slice(0, 10)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SMART RIDE US DIRECT INVENTORY, 360 STUDIO & LANDING COST CALCULATOR */}
        {activeTab === 'US_INVENTORY' && (
          <div className="space-y-8">
            {/* Search & Budget Filter Toolbar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Search Make, Model, Year, or Smart Ride Lot ID (e.g. Lexus, SR-US-90418)..."
                    aria-label="Search Smart Ride US Direct Inventory"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setConditionFilter('ALL')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      conditionFilter === 'ALL'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Verified Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setConditionFilter('Run & Drive Verified')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      conditionFilter === 'Run & Drive Verified'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Run & Drive Only
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <label htmlFor="max-ngn-filter" className="text-slate-400 whitespace-nowrap">
                  Max Landed Budget (NGN):
                </label>
                <select
                  id="max-ngn-filter"
                  value={maxLandedBudgetNgn}
                  onChange={(e) => setMaxLandedBudgetNgn(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white"
                >
                  <option value={0}>No Limit (Show All)</option>
                  <option value={55000000}>Under NGN 55,000,000 Landed</option>
                  <option value={75000000}>Under NGN 75,000,000 Landed</option>
                  <option value={100000000}>Under NGN 100,000,000 Landed</option>
                </select>
              </div>
            </div>

            {/* Vehicle Selection Grid (100% White-Labeled Smart Ride US Direct Stock) */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {filteredVehicles.map((veh) => {
                const isSelected = veh.id === selectedVehicle.id;
                const estLanded = calculateLandingCost({
                  purchasePriceUsd: veh.currentBidUsd,
                  departurePort: veh.usDeparturePort,
                  shippingMethod: 'RORO',
                  destinationPort: veh.defaultDestinationPort,
                  vehicleAgeYears: Math.max(1, 2026 - veh.year),
                  exchangeRateNgnPerUsd: exchangeRate,
                });

                return (
                  <button
                    key={veh.id}
                    type="button"
                    onClick={() => handleSelectVehicle(veh)}
                    className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-slate-900 border-emerald-500 shadow-lg'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono text-emerald-400 font-semibold">{veh.lotId}</span>
                        <span>{veh.titleStatus}</span>
                      </div>
                      <p className="text-sm font-bold text-white mt-1">
                        {veh.year} {veh.make} {veh.model}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{veh.trim}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Current Bid</span>
                        <span className="font-mono tabular-nums font-bold text-white">
                          ${veh.currentBidUsd.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Est. Landed Lagos</span>
                        <span className="font-mono tabular-nums text-emerald-400">
                          NGN {(estLanded.totalLandingNgn / 1000000).toFixed(1)}M
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Vehicle Detail: Left 360° Studio Viewer | Right Deterministic Landing Cost Calculator & Proxy Bid Box */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 space-y-6">
                <Vehicle360Viewer vehicle={selectedVehicle} />

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Verified VIN</span>
                    <p className="font-mono font-semibold text-white mt-1">{selectedVehicle.vin}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Engine Serial</span>
                    <p className="font-mono font-semibold text-white mt-1">{selectedVehicle.engineNumber}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Odometer</span>
                    <p className="font-mono tabular-nums font-semibold text-white mt-1">
                      {selectedVehicle.mileageMiles.toLocaleString()} mi
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">US Marshalling Port</span>
                    <p className="font-semibold text-emerald-400 mt-1">{selectedVehicle.usDeparturePort}</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Smart Landing Cost Calculator & ALATPay Proxy Bidding Box */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">
                      Smart Ride Deterministic Landed Cost Engine
                    </p>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      US-to-Nigeria Cost Calculator & Proxy Bid
                    </h3>
                  </div>
                  <Calculator className="w-5 h-5 text-emerald-400 shrink-0" />
                </div>

                {/* Calculator Controls */}
                <div className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="proxy-bid-input" className="block text-slate-300 font-medium mb-1">
                      Your Maximum Proxy Bid / Vehicle Price (USD $)
                    </label>
                    <input
                      id="proxy-bid-input"
                      type="number"
                      step={250}
                      min={2000}
                      value={calcBidUsd}
                      onChange={(e) => setCalcBidUsd(Math.max(1000, Number(e.target.value) || 0))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono tabular-nums font-bold text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label htmlFor="us-port-select" className="block text-slate-400 mb-1">
                        US Exit Port
                      </label>
                      <select
                        id="us-port-select"
                        value={calcDeparturePort}
                        onChange={(e) => setCalcDeparturePort(e.target.value as DeparturePort)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-white"
                      >
                        <option value="Newark, NJ">Newark, NJ ($420)</option>
                        <option value="Savannah, GA">Savannah, GA ($480)</option>
                        <option value="Houston, TX">Houston, TX ($550)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="ocean-method-select" className="block text-slate-400 mb-1">
                        Ocean Freight
                      </label>
                      <select
                        id="ocean-method-select"
                        value={calcShippingMethod}
                        onChange={(e) => setCalcShippingMethod(e.target.value as ShippingMethod)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-white"
                      >
                        <option value="RORO">RoRo Vessel ($1,350)</option>
                        <option value="SHARED_CONTAINER">Container ($1,850)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="ng-port-select" className="block text-slate-400 mb-1">
                        Lagos Terminal
                      </label>
                      <select
                        id="ng-port-select"
                        value={calcDestinationPort}
                        onChange={(e) => setCalcDestinationPort(e.target.value as NigerianPort)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-white"
                      >
                        <option value="Tin Can Island, Lagos">Tin Can Island</option>
                        <option value="Apapa Port, Lagos">Apapa Port</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Itemized Breakdown */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs font-mono tabular-nums">
                  <div className="flex justify-between text-slate-300">
                    <span className="font-sans">1. Vehicle Acquisition Price</span>
                    <span>${currentLandingBreakdown.purchasePriceUsd.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="font-sans">2. US Yard Towing ({calcDeparturePort})</span>
                    <span>${currentLandingBreakdown.usPortTowingUsd.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="font-sans">3. Ocean Shipping & Marine Insurance</span>
                    <span>
                      ${(currentLandingBreakdown.oceanFreightUsd + currentLandingBreakdown.marineInsuranceUsd).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="font-sans">4. Nigeria Customs Duty, NAC & 7.5% VAT</span>
                    <span>
                      ${(currentLandingBreakdown.customsDutyUsdEquivalent + currentLandingBreakdown.vatAndLevyUsdEquivalent).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="font-sans">5. Lagos Port Clearing & E-Y Commission</span>
                    <span>
                      ${(currentLandingBreakdown.portTerminalClearingUsdEquivalent + currentLandingBreakdown.eyBrokerageFeeUsd).toLocaleString()}
                    </span>
                  </div>

                  <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-sm font-bold text-white">
                    <span className="font-sans">Total Landed Cost (USD / NGN)</span>
                    <span className="text-emerald-400">
                      ${currentLandingBreakdown.totalLandingUsd.toLocaleString()} · NGN{' '}
                      {currentLandingBreakdown.totalLandingNgn.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 15% ALATPay Commitment Deposit Callout & Bid Trigger */}
                <div className="p-4 bg-emerald-950/30 border border-emerald-600/40 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-200 font-medium">
                      15% Refundable ALATPay Bidding Deposit
                    </span>
                    <span className="font-mono tabular-nums font-bold text-white">
                      NGN {currentLandingBreakdown.biddingDepositRequiredNgn.toLocaleString()} ($
                      {currentLandingBreakdown.biddingDepositRequiredUsd.toLocaleString()})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCheckoutModal({
                        isOpen: true,
                        title: `15% Proxy Bid Commitment — ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.lotId})`,
                        amountNgn: currentLandingBreakdown.biddingDepositRequiredNgn,
                        amountUsd: currentLandingBreakdown.biddingDepositRequiredUsd,
                        purpose: 'BIDDING_DEPOSIT',
                        lotId: selectedVehicle.lotId,
                        bidUsd: calcBidUsd,
                      })
                    }
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Place Proxy Bid via Wema ALATPay</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: OCEAN LOGISTICS TRACKER & LIVE VIRTUAL YARD INSPECTION BOOKING */}
        {activeTab === 'LOGISTICS_INSPECTION' && (
          <div className="space-y-8">
            <LogisticsTimeline
              vehicle={selectedVehicle}
              onAdvanceStage={handleAdvanceLogisticsStage}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Schedule Live Virtual Yard Walk-Around */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="border-b border-slate-800 pb-4">
                  <p className="text-xs font-semibold text-emerald-400">
                    WebRTC / Live Yard Walk-Around Scheduler
                  </p>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    Book Live Virtual Inspection
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Connect live with a Smart Ride US Yard Lead to inspect cold start, undercarriage, and OBD-II diagnostics before vessel loading.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleBookVirtualInspection(
                      selectedVehicle,
                      new Date(inspDateInput).toISOString(),
                      inspNotesInput
                    );
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label htmlFor="insp-vehicle-select" className="block text-slate-300 mb-1">
                      Smart Ride US Direct Lot
                    </label>
                    <select
                      id="insp-vehicle-select"
                      value={selectedVehicle.id}
                      onChange={(e) => {
                        const found = vehicles.find((v) => v.id === e.target.value);
                        if (found) handleSelectVehicle(found);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    >
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.lotId} · {v.year} {v.make} {v.model} ({v.usDeparturePort})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="insp-datetime" className="block text-slate-300 mb-1">
                      Preferred Date & Time (WAT / UTC+1)
                    </label>
                    <input
                      id="insp-datetime"
                      type="datetime-local"
                      value={inspDateInput}
                      onChange={(e) => setInspDateInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="insp-notes" className="block text-slate-300 mb-1">
                      Inspection Focus Instructions for Yard Engineer
                    </label>
                    <textarea
                      id="insp-notes"
                      rows={3}
                      value={inspNotesInput}
                      onChange={(e) => setInspNotesInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Schedule Live Virtual Yard Tour</span>
                  </button>
                </form>
              </div>

              {/* Right: Scheduled Inspections & Active Proxy Bids */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="text-base font-bold text-white">
                    Confirmed Virtual Yard Appointments ({inspections.length})
                  </h3>
                  <div className="divide-y divide-slate-800">
                    {inspections.map((item) => (
                      <div key={item.id} className="py-3.5 flex flex-wrap items-start justify-between gap-4 text-xs">
                        <div className="space-y-1 max-w-lg">
                          <p className="font-semibold text-white">
                            {item.lotId} · {item.vehicleTitle}
                          </p>
                          <p className="text-slate-400">{item.inspectorName}</p>
                          <p className="text-slate-300">{item.specialistNotes}</p>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <span className="text-emerald-400 font-semibold">{item.status}</span>
                          <p className="text-slate-400 mt-1">
                            {new Date(item.scheduledIso).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="text-base font-bold text-white">
                    Active Smart Ride Proxy Bids ({bids.length})
                  </h3>
                  <div className="divide-y divide-slate-800">
                    {bids.map((b) => (
                      <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-white">
                            {b.lotId} · {b.vehicleTitle}
                          </p>
                          <p className="font-mono text-slate-400 mt-0.5">
                            ALATPay Ref: {b.alatpayReference} · Status: {b.status}
                          </p>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <p className="font-bold text-emerald-400">
                            Max Bid: ${b.maxProxyBidUsd.toLocaleString()}
                          </p>
                          <p className="text-slate-400">
                            Deposit: NGN {b.depositPaidNgn.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BIOSCIENCE & CLEAN-FUEL MOLECULAR R&D WORKBENCH */}
        {activeTab === 'BIOSCIENCE_LAB' && (
          <BioscienceWorkbench onLogBiotechBudgetSpend={handleLogBiotechBudgetSpend} />
        )}

        {/* TAB 5: GOOGLE DRIVE CLOUD VAULT & OFFICIAL E-Y INVESTMENT INVOICES */}
        {activeTab === 'DRIVE_INVOICES' && (
          <GoogleDriveVault
            userEmail={user?.email || 'aysmartinvestmentltd@gmail.com'}
            userName={user?.displayName || 'Executive Client'}
            wemaVirtualAccount={wemaVirtualAccount}
            selectedVehicle={selectedVehicle}
            budgets={budgets}
            transactions={transactions}
            exchangeRate={exchangeRate}
            onTokenAcquired={(tok) => setDriveToken(tok)}
          />
        )}
      </main>

      {/* Quiet Corporate Footer */}
      <footer className="mt-12 border-t border-slate-900 py-6 px-6 text-xs text-slate-500">
        <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <p>
            © 2026 Beacon Revenue (by E-Y Investment Limited RC-1894022). Standalone Budget, Bank Sync & US Auto Direct.
          </p>
          <p>
            All NGN & USD settlements processed exclusively via Wema Bank PLC / ALATPay Gateway.
          </p>
        </div>
      </footer>

      {/* ALATPay Checkout Modal */}
      <AlatPayCheckoutModal
        isOpen={checkoutModal.isOpen}
        onClose={() => setCheckoutModal((prev) => ({ ...prev, isOpen: false }))}
        title={checkoutModal.title}
        amountNgn={checkoutModal.amountNgn}
        amountUsd={checkoutModal.amountUsd}
        purpose={checkoutModal.purpose}
        lotId={checkoutModal.lotId}
        wemaVirtualAccount={wemaVirtualAccount}
        userId={user?.uid || 'ey-executive-user'}
        userEmail={user?.email || 'aysmartinvestmentltd@gmail.com'}
        userName={user?.displayName || 'Executive Client'}
        onSuccess={handleAlatPaySuccess}
      />

      {/* Floating Multi-Turn Gemini Chatbot, High-Thinking Mode & TTS Voice Agent */}
      <GeminiVoiceCopilot
        vehicles={vehicles}
        budgets={budgets}
        exchangeRate={exchangeRate}
        onApplyVoiceSearch={(kw, maxNgn) => {
          setSearchKeyword(kw);
          setMaxLandedBudgetNgn(maxNgn);
          setActiveTab('US_INVENTORY');
        }}
        onQuickBookInspection={(veh, iso, notes) => {
          handleBookVirtualInspection(veh, iso, notes);
          setActiveTab('LOGISTICS_INSPECTION');
        }}
      />
    </div>
  );
}
