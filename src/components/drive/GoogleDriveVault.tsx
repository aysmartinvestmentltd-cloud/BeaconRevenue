import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  Trash2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { getAccessToken, googleSignIn } from '../../lib/firebase';
import { generateOfficialEyInvoice } from '../../lib/invoice-gen';
import { calculateLandingCost } from '../../lib/cost-matrix';
import type {
  SmartRideVehicle,
  BudgetCategoryItem,
  SyncedTransaction,
  DriveFileEntry,
} from '../../types/smart-ride';

interface GoogleDriveVaultProps {
  userEmail: string;
  userName: string;
  wemaVirtualAccount: string;
  selectedVehicle: SmartRideVehicle;
  budgets: BudgetCategoryItem[];
  transactions: SyncedTransaction[];
  exchangeRate: number;
  onTokenAcquired: (token: string) => void;
}

export const GoogleDriveVault: React.FC<GoogleDriveVaultProps> = ({
  userEmail,
  userName,
  wemaVirtualAccount,
  selectedVehicle,
  budgets,
  transactions,
  exchangeRate,
  onTokenAcquired,
}) => {
  const [driveFiles, setDriveFiles] = useState<DriveFileEntry[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [needsDriveAuth, setNeedsDriveAuth] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingDeleteFile, setPendingDeleteFile] = useState<DriveFileEntry | null>(null);

  const costBreakdown = calculateLandingCost({
    purchasePriceUsd: selectedVehicle.currentBidUsd,
    departurePort: selectedVehicle.usDeparturePort,
    shippingMethod: 'RORO',
    destinationPort: selectedVehicle.defaultDestinationPort,
    vehicleAgeYears: Math.max(1, 2026 - selectedVehicle.year),
    exchangeRateNgnPerUsd: exchangeRate,
  });

  const invoiceDoc = generateOfficialEyInvoice({
    invoiceNumber: `EY-INV-2026-${selectedVehicle.lotId.slice(-4)}`,
    clientName: userName || 'Smart Ride Executive Client',
    clientEmail: userEmail || 'aysmartinvestmentltd@gmail.com',
    wemaVirtualAccount,
    lotId: selectedVehicle.lotId,
    vin: selectedVehicle.vin,
    engineNumber: selectedVehicle.engineNumber,
    vehicleTitle: `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} ${selectedVehicle.trim}`,
    mileageMiles: selectedVehicle.mileageMiles,
    departurePort: selectedVehicle.usDeparturePort,
    destinationPort: selectedVehicle.defaultDestinationPort,
    costBreakdown,
    amountPaidNgn: costBreakdown.biddingDepositRequiredNgn,
    issuedIso: new Date().toISOString(),
  });

  const fetchDriveFiles = async () => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsDriveAuth(true);
      return;
    }
    setNeedsDriveAuth(false);
    setIsLoadingFiles(true);
    try {
      const res = await fetch(
        'https://www.googleapis.com/drive/v3/files?pageSize=15&fields=files(id,name,mimeType,createdTime,webViewLink)&orderBy=createdTime desc',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.status === 401 || res.status === 403) {
        setNeedsDriveAuth(true);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data.files)) {
        setDriveFiles(data.files);
      }
    } catch (err: any) {
      setStatusMessage(`Unable to list Google Drive files: ${err?.message || 'Network error'}`);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchDriveFiles();
  }, []);

  const handleConnectGoogleDrive = async () => {
    try {
      const result = await googleSignIn();
      if (result?.accessToken) {
        onTokenAcquired(result.accessToken);
        setNeedsDriveAuth(false);
        await fetchDriveFiles();
      }
    } catch (err: any) {
      setStatusMessage(`Google sign-in cancelled or failed: ${err?.message || ''}`);
    }
  };

  const handleExportToDrive = async (docType: 'INVOICE' | 'BUDGET_REPORT') => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsDriveAuth(true);
      setStatusMessage('Please sign in with Google first to export documents to your Google Drive.');
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);
    try {
      const fileName =
        docType === 'INVOICE'
          ? `${invoiceDoc.invoiceNumber}_${selectedVehicle.lotId}_SmartRide_Invoice.md`
          : `SmartRide_ALATPay_Budget_Statement_${new Date().toISOString().slice(0, 10)}.md`;

      const fileBody =
        docType === 'INVOICE'
          ? invoiceDoc.markdownContent
          : `# E-Y INVESTMENT LIMITED — SMART RIDE BUDGET & ALATPAY SYNC LEDGER\n` +
            `**Client**: ${userName} (${userEmail})\n` +
            `**Dedicated Wema Virtual Account**: ${wemaVirtualAccount}\n` +
            `**Exchange Rate**: ₦${exchangeRate.toLocaleString()}/$1\n\n` +
            `## Budget Categories\n` +
            budgets
              .map(
                (b) =>
                  `- **${b.name}** (${b.currency}): Spent ${b.spentAmount.toLocaleString()} / Allocated ${b.allocatedAmount.toLocaleString()} (Alert at ${b.alertThresholdPct}%)`
              )
              .join('\n') +
            `\n\n## Synced ALATPay & Wema Bank Transactions\n` +
            transactions
              .map(
                (t) =>
                  `- \`${t.alatpayReference}\` | ${t.createdAtIso.slice(0, 10)} | **${t.description}** | ${t.currency} ${t.amount.toLocaleString()} (${t.paymentChannel})`
              )
              .join('\n');

      const metadata = {
        name: fileName,
        mimeType: 'text/markdown',
      };

      const boundary = 'smart_ride_ey_investment_boundary';
      const multipartRequestBody =
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: text/markdown; charset=UTF-8\r\n\r\n` +
        `${fileBody}\r\n` +
        `--${boundary}--`;

      const uploadRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,createdTime,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      if (!uploadRes.ok) {
        throw new Error(`Google Drive upload returned HTTP ${uploadRes.status}`);
      }

      const createdFile = await uploadRes.json();
      setDriveFiles((prev) => [createdFile, ...prev]);
      setStatusMessage(`Exported "${createdFile.name}" directly to your Google Drive.`);
    } catch (err: any) {
      setStatusMessage(`Google Drive export failed: ${err?.message || 'Verify permissions'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDeleteFromDrive = async () => {
    if (!pendingDeleteFile) return;
    const token = await getAccessToken();
    if (!token) {
      setNeedsDriveAuth(true);
      setPendingDeleteFile(null);
      return;
    }

    try {
      const delRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${pendingDeleteFile.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!delRes.ok && delRes.status !== 204) {
        throw new Error(`Delete failed with status ${delRes.status}`);
      }
      setDriveFiles((prev) => prev.filter((f) => f.id !== pendingDeleteFile.id));
      setStatusMessage(`Deleted "${pendingDeleteFile.name}" from Google Drive.`);
    } catch (err: any) {
      setStatusMessage(`Could not delete file: ${err?.message || 'Error'}`);
    } finally {
      setPendingDeleteFile(null);
    }
  };

  const handleDownloadLocalInvoice = () => {
    const blob = new Blob([invoiceDoc.markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoiceDoc.invoiceNumber}_${selectedVehicle.lotId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Official E-Y Investment Corporate Invoice Preview */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <p className="text-xs font-semibold text-emerald-400">
              {invoiceDoc.corporateHeader.companyName}
            </p>
            <h3 className="text-lg font-bold text-white mt-0.5">
              Official Proforma & Landed Cost Invoice · {invoiceDoc.invoiceNumber}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {invoiceDoc.corporateHeader.rcNumber} · {invoiceDoc.corporateHeader.tinNumber} · {invoiceDoc.corporateHeader.headOfficeAddress}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadLocalInvoice}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Statement</span>
          </button>
        </div>

        {/* Vehicle & Wema Settlement Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="space-y-1.5">
            <p className="text-slate-400">Smart Ride Verified Vehicle</p>
            <p className="font-semibold text-white">{invoiceDoc.vehicleSpec.vehicleTitle}</p>
            <p className="font-mono text-slate-300">
              Lot: {invoiceDoc.vehicleSpec.lotId} · VIN: {invoiceDoc.vehicleSpec.vin}
            </p>
            <p className="font-mono text-slate-400">
              Engine: {invoiceDoc.vehicleSpec.engineNumber} · {invoiceDoc.vehicleSpec.mileageMiles.toLocaleString()} mi
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-slate-400">Wema Bank / ALATPay Settlement</p>
            <p className="font-semibold text-emerald-400">
              {invoiceDoc.corporateHeader.clientVirtualAccount}
            </p>
            <p className="font-mono text-slate-300">
              NGN Corp: {invoiceDoc.corporateHeader.ngnCorporateAccount}
            </p>
            <p className="font-mono text-slate-400">
              USD Dom: {invoiceDoc.corporateHeader.usdDomiciliaryAccount}
            </p>
          </div>
        </div>

        {/* Itemized Financial Schedule Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 font-medium">Schedule Line Item</th>
                <th className="py-2.5 font-medium text-right">USD ($)</th>
                <th className="py-2.5 font-medium text-right">NGN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums text-slate-200">
              <tr>
                <td className="py-2.5 font-sans">Smart Ride US Direct Acquisition Hammer</td>
                <td className="py-2.5 text-right">${invoiceDoc.financialSchedule.bidHammerUsd.toLocaleString()}</td>
                <td className="py-2.5 text-right">
                  NGN {Math.round(invoiceDoc.financialSchedule.bidHammerUsd * exchangeRate).toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-sans">US Port Marshalling & Towing ({selectedVehicle.usDeparturePort})</td>
                <td className="py-2.5 text-right">${invoiceDoc.financialSchedule.usPortTowingUsd.toLocaleString()}</td>
                <td className="py-2.5 text-right">
                  NGN {Math.round(invoiceDoc.financialSchedule.usPortTowingUsd * exchangeRate).toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-sans">Ocean RoRo Freight & Marine Insurance (1.5%)</td>
                <td className="py-2.5 text-right">
                  ${(invoiceDoc.financialSchedule.oceanFreightUsd + invoiceDoc.financialSchedule.marineInsuranceUsd).toLocaleString()}
                </td>
                <td className="py-2.5 text-right">
                  NGN {Math.round((invoiceDoc.financialSchedule.oceanFreightUsd + invoiceDoc.financialSchedule.marineInsuranceUsd) * exchangeRate).toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-sans">Nigeria Customs Tariff, NAC & 7.5% VAT</td>
                <td className="py-2.5 text-right">
                  ${(invoiceDoc.financialSchedule.customsDutyUsd + invoiceDoc.financialSchedule.vatAndLevyUsd).toLocaleString()}
                </td>
                <td className="py-2.5 text-right">
                  NGN {Math.round((invoiceDoc.financialSchedule.customsDutyUsd + invoiceDoc.financialSchedule.vatAndLevyUsd) * exchangeRate).toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-sans">Terminal Release ({selectedVehicle.defaultDestinationPort}) & E-Y Fee</td>
                <td className="py-2.5 text-right">
                  ${(invoiceDoc.financialSchedule.terminalClearingUsd + invoiceDoc.financialSchedule.eyBrokerageFeeUsd).toLocaleString()}
                </td>
                <td className="py-2.5 text-right">
                  NGN {Math.round((invoiceDoc.financialSchedule.terminalClearingUsd + invoiceDoc.financialSchedule.eyBrokerageFeeUsd) * exchangeRate).toLocaleString()}
                </td>
              </tr>
              <tr className="bg-slate-950/90 font-bold text-white">
                <td className="py-3 px-2 font-sans">Total Landed Acquisition Cost</td>
                <td className="py-3 px-2 text-right text-emerald-400">
                  ${invoiceDoc.financialSchedule.totalLandingUsd.toLocaleString()}
                </td>
                <td className="py-3 px-2 text-right text-emerald-400">
                  NGN {invoiceDoc.financialSchedule.totalLandingNgn.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Column: Google Drive Cloud Vault Integration */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <p className="text-xs font-semibold text-emerald-400">Google Workspace Drive API (`drive.file`)</p>
            <h3 className="text-base font-bold text-white mt-0.5">
              Executive Cloud Document Vault
            </h3>
          </div>
          <button
            type="button"
            onClick={fetchDriveFiles}
            aria-label="Refresh Google Drive files"
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Archive tamper-proof E-Y Investment invoices, Bills of Lading, and ALATPay budget statements directly into your personal Google Drive.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => handleExportToDrive('INVOICE')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <UploadCloud className="w-4 h-4 shrink-0" />
            <span>Save Invoice to Drive</span>
          </button>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => handleExportToDrive('BUDGET_REPORT')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 border border-slate-700 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Export Budget Ledger</span>
          </button>
        </div>

        {needsDriveAuth && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <p className="text-xs text-slate-300">
              Sign in with your Google Account to authorize Google Drive file creation and management.
            </p>
            <button
              type="button"
              onClick={handleConnectGoogleDrive}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>
        )}

        {statusMessage && (
          <div className="p-3 bg-slate-950 border border-emerald-500/40 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Synced Google Drive Files List */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">
            Files Created by Smart Ride in Google Drive ({driveFiles.length})
          </p>
          {driveFiles.length === 0 ? (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
              No Smart Ride reports exported in this session yet. Click &ldquo;Save Invoice to Drive&rdquo; or &ldquo;Export Budget Ledger&rdquo; above.
            </div>
          ) : (
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950">
              {driveFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{file.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {file.createdTime
                        ? new Date(file.createdTime).toLocaleString()
                        : 'Synced with Google Drive'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${file.name} in Google Drive`}
                        className="p-1.5 text-slate-400 hover:text-emerald-400"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingDeleteFile(file)}
                      aria-label={`Delete ${file.name} from Google Drive`}
                      className="p-1.5 text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mandatory User Confirmation Dialog for Destructive Google Drive Delete */}
        {pendingDeleteFile && (
          <div
            className="p-4 bg-red-950/60 border border-red-700 rounded-xl space-y-3"
            role="alertdialog"
            aria-labelledby="drive-delete-confirm-title"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p id="drive-delete-confirm-title" className="text-xs font-semibold text-white">
                  Confirm Google Drive File Deletion
                </p>
                <p className="text-xs text-red-200 mt-0.5">
                  Are you sure you want to permanently delete &ldquo;{pendingDeleteFile.name}&rdquo; from your Google Drive? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteFile(null)}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFromDrive}
                className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
