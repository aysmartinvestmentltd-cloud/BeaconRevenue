import React, { useState } from 'react';
import { ShieldCheck, Building2, CreditCard, Globe, CheckCircle2, X } from 'lucide-react';

interface AlatPayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  amountNgn: number;
  amountUsd: number;
  purpose: 'BIDDING_DEPOSIT' | 'VEHICLE_SETTLEMENT' | 'BUDGET_TOPUP' | 'CUSTOMS_CLEARING';
  lotId?: string;
  wemaVirtualAccount: string;
  userId: string;
  userEmail: string;
  userName: string;
  onSuccess: (paymentRecord: {
    reference: string;
    amount: number;
    currency: 'NGN' | 'USD';
    channel: string;
    purpose: string;
    lotId?: string;
  }) => void;
}

export const AlatPayCheckoutModal: React.FC<AlatPayCheckoutModalProps> = ({
  isOpen,
  onClose,
  title,
  amountNgn,
  amountUsd,
  purpose,
  lotId,
  wemaVirtualAccount,
  userId,
  userEmail,
  userName,
  onSuccess,
}) => {
  const [channel, setChannel] = useState<'WEMA_VIRTUAL_ACCOUNT' | 'ALATPAY_CARD' | 'USD_DOMICILIARY_COLLECTION'>('WEMA_VIRTUAL_ACCOUNT');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verifiedRef, setVerifiedRef] = useState<string | null>(null);

  if (!isOpen) return null;

  const isUsd = channel === 'USD_DOMICILIARY_COLLECTION';
  const activeCurrency: 'NGN' | 'USD' = isUsd ? 'USD' : 'NGN';
  const activeAmount = isUsd ? amountUsd : amountNgn;

  const handleSettleViaAlatPay = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      // Step 1: Initiate ALATPay transaction on server
      const initRes = await fetch('/api/alatpay/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: userEmail,
          fullName: userName,
          amount: activeAmount,
          currency: activeCurrency,
          channel,
          purpose,
          lotId,
        }),
      });

      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to initiate ALATPay transaction');
      }

      const txData = await initRes.json();

      // Step 2: Verify via ALATPay HMAC-SHA512 Webhook Endpoint
      const webhookRes = await fetch('/api/alatpay/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-alatpay-signature': txData.webhookSignature,
        },
        body: JSON.stringify({
          reference: txData.reference,
          userId,
          amount: txData.amount,
          currency: txData.currency,
          purpose,
          lotId: lotId || null,
        }),
      });

      if (!webhookRes.ok) {
        const err = await webhookRes.json().catch(() => ({}));
        throw new Error(err.error || 'ALATPay webhook verification failed');
      }

      setVerifiedRef(txData.reference);
      onSuccess({
        reference: txData.reference,
        amount: txData.amount,
        currency: txData.currency,
        channel:
          channel === 'WEMA_VIRTUAL_ACCOUNT'
            ? `Wema Virtual Account (${wemaVirtualAccount})`
            : channel === 'ALATPAY_CARD'
            ? 'ALATPay NGN Debit Card'
            : 'Wema Corporate USD Domiciliary (0621904418)',
        purpose,
        lotId,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Payment gateway error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alatpay-modal-title"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div>
            <p className="text-xs font-medium text-emerald-400">
              Wema Bank PLC · Native ALATPay Corporate Gateway
            </p>
            <h3 id="alatpay-modal-title" className="text-base font-semibold text-white mt-0.5">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close ALATPay Checkout"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Channel Switcher */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setChannel('WEMA_VIRTUAL_ACCOUNT')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                channel === 'WEMA_VIRTUAL_ACCOUNT'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span>Virtual Account</span>
            </button>
            <button
              type="button"
              onClick={() => setChannel('ALATPAY_CARD')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                channel === 'ALATPAY_CARD'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span>NGN Card</span>
            </button>
            <button
              type="button"
              onClick={() => setChannel('USD_DOMICILIARY_COLLECTION')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                channel === 'USD_DOMICILIARY_COLLECTION'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>USD Domiciliary</span>
            </button>
          </div>

          {/* Receiver Details */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Beneficiary Corporate Entity</span>
              <span className="font-semibold text-white">E-Y Investment Limited (RC-1894022)</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Settlement Account</span>
              <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                {channel === 'USD_DOMICILIARY_COLLECTION'
                  ? '0621904418 (Wema USD Domiciliary)'
                  : `${wemaVirtualAccount} (ALAT Virtual NGN)`}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400">Total Commitment Due</span>
              <span className="text-xl font-mono tabular-nums font-bold text-white">
                {activeCurrency === 'NGN'
                  ? `NGN ${activeAmount.toLocaleString()}`
                  : `$${activeAmount.toLocaleString()}`}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          {verifiedRef ? (
            <div className="p-4 bg-emerald-950/40 border border-emerald-600/50 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    ALATPay Webhook Verified & Wallet Credited
                  </p>
                  <p className="text-xs font-mono tabular-nums text-emerald-300">
                    Ref: {verifiedRef}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleSettleViaAlatPay}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? 'Verifying ALATPay Signature...'
                    : `Authorize ${
                        activeCurrency === 'NGN'
                          ? `NGN ${activeAmount.toLocaleString()}`
                          : `$${activeAmount.toLocaleString()}`
                      } via ALATPay`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
