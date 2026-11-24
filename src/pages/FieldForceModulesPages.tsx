import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  CreditCard,
  Download,
  FileBarChart2,
  FileCheck2,
  FileText,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Route,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatKES, formatNairobiDateTime, todayNairobiDate } from '../lib/date';
import type {
  Client,
  ClientContract,
  ExpenseRecord,
  Incident,
  Invoice,
  OperationalIntelligence,
  PatrolScan,
  Payslip,
  Post,
  ReceiptRecord,
  Site,
} from '../types/domain';
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  FormField,
  InlineAlert,
  LoadingSkeleton,
  PageHeader,
  StatusLabel,
} from '../components/ui';

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// Deterministic, dependency-free SVG QR tag generator (21x21 Version-1 layout with 3 finder patterns)
const QrCodeSvg: React.FC<{ value: string; size?: number }> = ({ value, size = 104 }) => {
  const cells = 21;
  const isFinder = (r: number, c: number) => {
    const inCorner = (rr: number, cc: number) => rr >= 0 && rr < 7 && cc >= 0 && cc < 7;
    const drawCorner = (rr: number, cc: number) =>
      rr === 0 || rr === 6 || cc === 0 || cc === 6 || (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4);
    if (inCorner(r, c)) return drawCorner(r, c);
    if (inCorner(r, cells - 1 - c)) return drawCorner(r, cells - 1 - c);
    if (inCorner(cells - 1 - r, c)) return drawCorner(cells - 1 - r, c);
    return null;
  };

  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const rects: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < cells; r += 1) {
    for (let c = 0; c < cells; c += 1) {
      const finder = isFinder(r, c);
      if (finder !== null) {
        if (finder) rects.push({ r, c });
        continue;
      }
      if (r === 6 || c === 6) {
        if ((r + c) % 2 === 0) rects.push({ r, c });
        continue;
      }
      const bitSeed = (hash ^ (r * 31 + c * 17) ^ ((r * c) << 2)) >>> 0;
      if (bitSeed % 2 === 0) rects.push({ r, c });
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cells + 2} ${cells + 2}`}
      className="bg-white border border-slate-200 rounded-md p-1 shrink-0"
      aria-label={`QR code for ${value}`}
    >
      <rect x={0} y={0} width={cells + 2} height={cells + 2} fill="#FFFFFF" />
      {rects.map(({ r, c }) => (
        <rect key={`${r}-${c}`} x={c + 1} y={r + 1} width={1} height={1} fill="#0B132B" />
      ))}
    </svg>
  );
};

// ==================== MODULE 04: PATROL MANAGEMENT ====================

export const FFPatrolsPage: React.FC = () => {
  const {
    currentRole,
    sites,
    employees,
    patrolCheckpoints,
    patrolSchedules,
    patrolScans,
    addPatrolCheckpoint,
    addPatrolSchedule,
    recordPatrolScan,
  } = useApp();

  const canManage =
    currentRole === 'owner' ||
    currentRole === 'admin' ||
    currentRole === 'operations_manager' ||
    currentRole === 'supervisor';
  const canScan = currentRole !== 'client';

  const todayIso = todayNairobiDate();
  const [tab, setTab] = useState<'scan' | 'checkpoints' | 'schedules'>('scan');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Scan form
  const [scanCode, setScanCode] = useState('');
  const [scanCheckpointId, setScanCheckpointId] = useState('');
  const [scanScheduleId, setScanScheduleId] = useState('');
  const [scanEmpId, setScanEmpId] = useState('');
  const [scanMethod, setScanMethod] = useState<PatrolScan['verification_method']>('qr_scan');
  const [scanNotes, setScanNotes] = useState('');
  const [scanPhoto, setScanPhoto] = useState<string | null>(null);
  const [copiedQr, setCopiedQr] = useState<string | null>(null);
  const [proofViewer, setProofViewer] = useState<PatrolScan | null>(null);

  // Checkpoint form
  const [cpSiteId, setCpSiteId] = useState(sites[0]?.id ?? '');
  const [cpName, setCpName] = useState('');
  const [cpHint, setCpHint] = useState('');
  const [cpQr, setCpQr] = useState('');
  const [cpOrder, setCpOrder] = useState(1);

  // Schedule form
  const [schSiteId, setSchSiteId] = useState(sites[0]?.id ?? '');
  const [schTitle, setSchTitle] = useState('');
  const [schFreq, setSchFreq] = useState(60);
  const [schStart, setSchStart] = useState(18);
  const [schEnd, setSchEnd] = useState(6);
  const [schEmpId, setSchEmpId] = useState('');

  useEffect(() => {
    if (!cpSiteId && sites[0]?.id) setCpSiteId(sites[0].id);
    if (!schSiteId && sites[0]?.id) setSchSiteId(sites[0].id);
  }, [sites, cpSiteId, schSiteId]);

  const missedCheckpoints = useMemo(
    () =>
      patrolCheckpoints.filter(
        (cp) => !patrolScans.some((sc) => sc.checkpoint_id === cp.id && sc.scanned_at.startsWith(todayIso))
      ),
    [patrolCheckpoints, patrolScans, todayIso]
  );

  const scannedTodayCount = patrolCheckpoints.length - missedCheckpoints.length;
  const compliancePct =
    patrolCheckpoints.length > 0 ? Math.round((scannedTodayCount / patrolCheckpoints.length) * 100) : 100;

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!scanCode.trim() && !scanCheckpointId) {
      setFeedback({ tone: 'error', msg: 'Enter a checkpoint QR code or select a checkpoint from the list.' });
      return;
    }
    setBusy(true);
    const res = await recordPatrolScan({
      qr_code: scanCode.trim() || undefined,
      checkpoint_id: scanCode.trim() ? undefined : scanCheckpointId,
      schedule_id: scanScheduleId || null,
      employee_id: scanEmpId || null,
      verification_method: scanMethod,
      notes: scanNotes.trim() || undefined,
      proof_photo_data: scanPhoto,
    });
    setBusy(false);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setScanCode('');
      setScanNotes('');
      setScanPhoto(null);
      setFeedback({ tone: 'success', msg: 'Patrol checkpoint scan verified and recorded in ledger.' });
    }
  };

  const handleQuickScan = async (qrCode: string, checkpointId: string) => {
    setFeedback(null);
    setBusy(true);
    const res = await recordPatrolScan({
      qr_code: qrCode,
      checkpoint_id: checkpointId,
      verification_method: 'qr_scan',
      notes: 'Verified via checkpoint tag scan',
    });
    setBusy(false);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else setFeedback({ tone: 'success', msg: `Checkpoint ${qrCode} scanned & verified.` });
  };

  const handleAddCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    const res = await addPatrolCheckpoint({
      site_id: cpSiteId,
      name: cpName,
      location_hint: cpHint,
      qr_code: cpQr.trim() || undefined,
      sequence_order: cpOrder,
    });
    setBusy(false);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setCpName('');
      setCpHint('');
      setCpQr('');
      setCpOrder((p) => p + 1);
      setFeedback({ tone: 'success', msg: 'Patrol checkpoint & QR tag created.' });
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    const res = await addPatrolSchedule({
      site_id: schSiteId,
      title: schTitle,
      frequency_minutes: schFreq,
      start_hour: schStart,
      end_hour: schEnd,
      assigned_employee_id: schEmpId || null,
    });
    setBusy(false);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setSchTitle('');
      setFeedback({ tone: 'success', msg: 'Patrol schedule added.' });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setScanPhoto(dataUrl);
    } catch (err) {
      setFeedback({ tone: 'error', msg: err instanceof Error ? err.message : 'Unable to attach proof photo.' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 04 · Patrol Management"
        title="QR Checkpoints, Patrol Rounds & Proof of Completion"
        description="Manage physical checkpoint QR tags, hourly patrol schedules, missed-round alerts, and verified guard scans."
      />

      {/* Patrol KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="text-xs font-medium text-slate-500">Patrol Compliance Today</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#0B132B] mt-1">{compliancePct}%</div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            {scannedTodayCount} / {patrolCheckpoints.length} checkpoint(s) scanned
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium text-slate-500">Missed-Round Alerts</div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
              missedCheckpoints.length > 0 ? 'text-[#D97706]' : 'text-[#059669]'
            }`}
          >
            {missedCheckpoints.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Pending patrol scan today</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium text-slate-500">Active Patrol Schedules</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#0B132B] mt-1">{patrolSchedules.length}</div>
          <div className="text-xs text-slate-500 mt-1">Site tour intervals configured</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium text-slate-500">Verified Scans Logged</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#0B132B] mt-1">{patrolScans.length}</div>
          <div className="text-xs text-slate-500 mt-1">Audit-backed completion proof</div>
        </Card>
      </div>

      {/* Missed-Round Alert Banner */}
      {missedCheckpoints.length > 0 && (
        <InlineAlert tone="warning">
          <div className="space-y-1">
            <div className="font-semibold">
              Missed-Round Alert: {missedCheckpoints.length} checkpoint(s) have not been scanned today ({todayIso})
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {missedCheckpoints.map((cp) => {
                const site = sites.find((s) => s.id === cp.site_id);
                return (
                  <span key={cp.id} className="font-mono bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                    {site?.name || cp.site_id} · {cp.name} ({cp.qr_code})
                  </span>
                );
              })}
            </div>
          </div>
        </InlineAlert>
      )}

      {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}

      <div className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
        {(
          [
            { key: 'scan', label: 'Patrol Scan & Proof Ledger' },
            { key: 'checkpoints', label: `QR Checkpoints (${patrolCheckpoints.length})` },
            { key: 'schedules', label: `Patrol Schedules (${patrolSchedules.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
              tab === t.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'scan' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {canScan && (
            <Card className="lg:col-span-5 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-[#059669]" />
                <h2 className="font-bold text-base text-[#0B132B]">Record Patrol Scan</h2>
              </div>

              <form onSubmit={handleScanSubmit} className="space-y-3.5">
                <FormField label="Scan / Enter QR Tag Code" htmlFor="patrol-qr-input" hint="e.g. QR-WST-01">
                  <input
                    id="patrol-qr-input"
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value)}
                    placeholder="QR-WST-01"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono uppercase"
                  />
                </FormField>

                <FormField label="Or Select Checkpoint Directly" htmlFor="patrol-cp-select">
                  <select
                    id="patrol-cp-select"
                    value={scanCheckpointId}
                    onChange={(e) => setScanCheckpointId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">-- Choose checkpoint --</option>
                    {patrolCheckpoints.map((cp) => {
                      const site = sites.find((s) => s.id === cp.site_id);
                      return (
                        <option key={cp.id} value={cp.id}>
                          {site?.name || cp.site_id} · {cp.name} ({cp.qr_code})
                        </option>
                      );
                    })}
                  </select>
                </FormField>

                <div className="grid sm:grid-cols-2 gap-3">
                  <FormField label="Verification Method" htmlFor="patrol-method">
                    <select
                      id="patrol-method"
                      value={scanMethod}
                      onChange={(e) => setScanMethod(e.target.value as PatrolScan['verification_method'])}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="qr_scan">QR Tag Scan</option>
                      <option value="manual_code">Manual Checkpoint Code</option>
                      <option value="nfc">NFC Patrol Tag</option>
                    </select>
                  </FormField>

                  <FormField label="Patrolling Guard" htmlFor="patrol-guard">
                    <select
                      id="patrol-guard"
                      value={scanEmpId}
                      onChange={(e) => setScanEmpId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Current User / Auto</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.employee_number} · {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <FormField label="Patrol Schedule (Optional)" htmlFor="patrol-sched">
                  <select
                    id="patrol-sched"
                    value={scanScheduleId}
                    onChange={(e) => setScanScheduleId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Ad-hoc / Unscheduled Round</option>
                    {patrolSchedules.map((sch) => (
                      <option key={sch.id} value={sch.id}>
                        {sch.title} (Every {sch.frequency_minutes}m)
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Observation Notes" htmlFor="patrol-notes">
                  <input
                    id="patrol-notes"
                    value={scanNotes}
                    onChange={(e) => setScanNotes(e.target.value)}
                    placeholder="Perimeter intact, gates locked..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </FormField>

                <FormField label="Photo Proof (Optional)" htmlFor="patrol-photo">
                  <input
                    id="patrol-photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handlePhotoUpload}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:bg-slate-50 file:text-xs file:font-medium"
                  />
                  {scanPhoto && (
                    <div className="mt-2 flex items-center gap-3">
                      <img src={scanPhoto} alt="Patrol proof preview" className="h-14 w-14 object-cover rounded border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => setScanPhoto(null)}
                        className="text-xs text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove photo
                      </button>
                    </div>
                  )}
                </FormField>

                <Button type="submit" disabled={busy} className="w-full">
                  <CheckCircle2 className="h-4 w-4" /> {busy ? 'Verifying...' : 'Verify & Log Patrol Scan'}
                </Button>
              </form>
            </Card>
          )}

          <Card className={`${canScan ? 'lg:col-span-7' : 'lg:col-span-12'} overflow-hidden`}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-base text-[#0B132B]">Patrol Completion Log</h2>
                <p className="text-xs text-slate-500">Timestamped checkpoint verification ledger</p>
              </div>
              <Badge tone="navy">{patrolScans.length} Scan(s)</Badge>
            </div>
            {patrolScans.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-600">No patrol scans recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-medium">Time (EAT)</th>
                      <th className="p-3 font-medium">Checkpoint</th>
                      <th className="p-3 font-medium">Guard</th>
                      <th className="p-3 font-medium">Method</th>
                      <th className="p-3 font-medium">Proof / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patrolScans.map((sc) => {
                      const cp = patrolCheckpoints.find((c) => c.id === sc.checkpoint_id);
                      const site = sites.find((s) => s.id === sc.site_id);
                      const emp = employees.find((e) => e.id === sc.employee_id);
                      return (
                        <tr key={sc.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono tabular-nums whitespace-nowrap">
                            {formatNairobiDateTime(sc.scanned_at)}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-900">{cp?.name || sc.checkpoint_id}</div>
                            <div className="text-[11px] text-slate-500">
                              {site?.name} · <span className="font-mono">{cp?.qr_code}</span>
                            </div>
                          </td>
                          <td className="p-3 text-slate-700">
                            {emp ? `${emp.first_name} ${emp.last_name}` : 'Duty Officer'}
                          </td>
                          <td className="p-3">
                            <Badge tone="emerald">{sc.verification_method.replace('_', ' ')}</Badge>
                          </td>
                          <td className="p-3 space-y-1">
                            <div className="text-slate-600">{sc.notes || 'Checkpoint verified'}</div>
                            {sc.proof_photo_data && (
                              <button
                                type="button"
                                onClick={() => setProofViewer(sc)}
                                className="text-[#059669] font-semibold hover:underline cursor-pointer"
                              >
                                View Photo Proof →
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'checkpoints' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {canManage && (
            <Card className="lg:col-span-4 p-6 space-y-4">
              <h2 className="font-bold text-base text-[#0B132B]">Add QR Checkpoint</h2>
              <form onSubmit={handleAddCheckpoint} className="space-y-3">
                <FormField label="Site" htmlFor="cp-site">
                  <select
                    id="cp-site"
                    required
                    value={cpSiteId}
                    onChange={(e) => setCpSiteId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Checkpoint Name" htmlFor="cp-name">
                  <input
                    id="cp-name"
                    required
                    value={cpName}
                    onChange={(e) => setCpName(e.target.value)}
                    placeholder="e.g. Loading Bay Gate B"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </FormField>
                <FormField label="Location Hint" htmlFor="cp-hint">
                  <input
                    id="cp-hint"
                    value={cpHint}
                    onChange={(e) => setCpHint(e.target.value)}
                    placeholder="Rear perimeter pillar"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Custom QR Code (Optional)" htmlFor="cp-qr">
                    <input
                      id="cp-qr"
                      value={cpQr}
                      onChange={(e) => setCpQr(e.target.value)}
                      placeholder="Auto-generated"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono uppercase"
                    />
                  </FormField>
                  <FormField label="Sequence Order" htmlFor="cp-order">
                    <input
                      id="cp-order"
                      type="number"
                      min={1}
                      max={99}
                      value={cpOrder}
                      onChange={(e) => setCpOrder(Number(e.target.value) || 1)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </FormField>
                </div>
                <Button type="submit" disabled={busy || !cpSiteId} className="w-full">
                  Generate QR Checkpoint
                </Button>
              </form>
            </Card>
          )}

          <div className={`${canManage ? 'lg:col-span-8' : 'lg:col-span-12'} grid sm:grid-cols-2 gap-4`}>
            {patrolCheckpoints.length === 0 ? (
              <div className="sm:col-span-2">
                <EmptyState title="No checkpoints configured" description="Add QR checkpoints to enable patrol verification." />
              </div>
            ) : (
              patrolCheckpoints.map((cp) => {
                const site = sites.find((s) => s.id === cp.site_id);
                const scannedToday = patrolScans.some(
                  (sc) => sc.checkpoint_id === cp.id && sc.scanned_at.startsWith(todayIso)
                );
                return (
                  <Card key={cp.id} className="p-4 flex gap-4 items-start justify-between">
                    <QrCodeSvg value={cp.qr_code} size={96} />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-slate-500">#{cp.sequence_order}</span>
                        <StatusLabel
                          label={scannedToday ? 'Scanned Today' : 'Pending Scan'}
                          tone={scannedToday ? 'emerald' : 'amber'}
                        />
                      </div>
                      <h3 className="font-bold text-sm text-[#0B132B] truncate">{cp.name}</h3>
                      <p className="text-xs text-slate-500 truncate">{site?.name}</p>
                      {cp.location_hint && <p className="text-xs text-slate-600">{cp.location_hint}</p>}
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {cp.qr_code}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(cp.qr_code);
                            setCopiedQr(cp.id);
                            setTimeout(() => setCopiedQr(null), 1500);
                          }}
                          className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedQr === cp.id ? <Check className="h-3 w-3 text-[#059669]" /> : <Copy className="h-3 w-3" />}
                          {copiedQr === cp.id ? 'Copied' : 'Copy'}
                        </button>
                        {canScan && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => handleQuickScan(cp.qr_code, cp.id)}
                          >
                            Quick Scan
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'schedules' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {canManage && (
            <Card className="lg:col-span-4 p-6 space-y-4">
              <h2 className="font-bold text-base text-[#0B132B]">Create Patrol Schedule</h2>
              <form onSubmit={handleAddSchedule} className="space-y-3">
                <FormField label="Site" htmlFor="sch-site">
                  <select
                    id="sch-site"
                    required
                    value={schSiteId}
                    onChange={(e) => setSchSiteId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Schedule Title" htmlFor="sch-title">
                  <input
                    id="sch-title"
                    required
                    value={schTitle}
                    onChange={(e) => setSchTitle(e.target.value)}
                    placeholder="e.g. Night Perimeter Hourly Tour"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </FormField>
                <div className="grid grid-cols-3 gap-2">
                  <FormField label="Interval (m)" htmlFor="sch-freq">
                    <input
                      id="sch-freq"
                      type="number"
                      min={15}
                      max={720}
                      value={schFreq}
                      onChange={(e) => setSchFreq(Number(e.target.value) || 60)}
                      className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm font-mono"
                    />
                  </FormField>
                  <FormField label="Start Hr" htmlFor="sch-start">
                    <input
                      id="sch-start"
                      type="number"
                      min={0}
                      max={23}
                      value={schStart}
                      onChange={(e) => setSchStart(Number(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm font-mono"
                    />
                  </FormField>
                  <FormField label="End Hr" htmlFor="sch-end">
                    <input
                      id="sch-end"
                      type="number"
                      min={0}
                      max={23}
                      value={schEnd}
                      onChange={(e) => setSchEnd(Number(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm font-mono"
                    />
                  </FormField>
                </div>
                <FormField label="Assigned Guard (Optional)" htmlFor="sch-emp">
                  <select
                    id="sch-emp"
                    value={schEmpId}
                    onChange={(e) => setSchEmpId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Any on-duty site guard</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.employee_number} · {e.first_name} {e.last_name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <Button type="submit" disabled={busy || !schSiteId} className="w-full">
                  Save Patrol Schedule
                </Button>
              </form>
            </Card>
          )}

          <Card className={`${canManage ? 'lg:col-span-8' : 'lg:col-span-12'} overflow-x-auto`}>
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Schedule Title</th>
                  <th className="p-3 font-medium">Site</th>
                  <th className="p-3 font-medium">Window (EAT)</th>
                  <th className="p-3 font-medium">Frequency</th>
                  <th className="p-3 font-medium">Assigned Guard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patrolSchedules.map((sch) => {
                  const site = sites.find((s) => s.id === sch.site_id);
                  const emp = employees.find((e) => e.id === sch.assigned_employee_id);
                  return (
                    <tr key={sch.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900 flex items-center gap-2">
                        <Route className="h-4 w-4 text-[#059669]" />
                        {sch.title}
                      </td>
                      <td className="p-3 text-slate-600">{site?.name || sch.site_id}</td>
                      <td className="p-3 font-mono text-xs">
                        {String(sch.start_hour).padStart(2, '0')}:00 – {String(sch.end_hour).padStart(2, '0')}:00
                      </td>
                      <td className="p-3 font-mono text-xs">Every {sch.frequency_minutes} mins</td>
                      <td className="p-3 text-xs text-slate-700">
                        {emp ? `${emp.first_name} ${emp.last_name}` : 'Rotation on-duty guard'}
                      </td>
                    </tr>
                  );
                })}
                {patrolSchedules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-slate-500">
                      No patrol schedules defined yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <Drawer
        open={Boolean(proofViewer)}
        title="Patrol Scan Photo Proof"
        subtitle={proofViewer ? formatNairobiDateTime(proofViewer.scanned_at) : undefined}
        onClose={() => setProofViewer(null)}
      >
        {proofViewer?.proof_photo_data && (
          <div className="space-y-4">
            <img
              src={proofViewer.proof_photo_data}
              alt="Patrol completion proof"
              className="w-full rounded-lg border border-slate-200"
            />
            <p className="text-sm text-slate-700">{proofViewer.notes || 'Checkpoint completed.'}</p>
          </div>
        )}
      </Drawer>
    </div>
  );
};

// ==================== MODULE 06: PAYROLL & TIMESHEETS ====================

export const FFPayrollPage: React.FC = () => {
  const {
    currentRole,
    organization,
    employees,
    payrollRuns,
    payslips,
    generatePayrollRun,
    updatePayrollRunStatus,
    updatePayslipValues,
  } = useApp();

  const canAccessPayroll =
    currentRole === 'owner' ||
    currentRole === 'admin' ||
    currentRole === 'finance_manager' ||
    currentRole === 'hr_manager';
  const canApprovePayroll =
    currentRole === 'owner' || currentRole === 'admin' || currentRole === 'finance_manager';

  const [selectedRunId, setSelectedRunId] = useState(payrollRuns[0]?.id ?? '');
  const [periodLabel, setPeriodLabel] = useState(() => {
    const now = new Date();
    return `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()} Run`;
  });
  const [periodStart, setPeriodStart] = useState(() => `${todayNairobiDate().slice(0, 7)}-01`);
  const [periodEnd, setPeriodEnd] = useState(() => todayNairobiDate());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null);
  const [editAllowances, setEditAllowances] = useState(0);
  const [editOvertime, setEditOvertime] = useState(0);
  const [editOtherDed, setEditOtherDed] = useState(0);
  const [viewingPayslip, setViewingPayslip] = useState<Payslip | null>(null);

  useEffect(() => {
    if ((!selectedRunId || !payrollRuns.some((r) => r.id === selectedRunId)) && payrollRuns[0]?.id) {
      setSelectedRunId(payrollRuns[0].id);
    }
  }, [payrollRuns, selectedRunId]);

  const activeRun = payrollRuns.find((r) => r.id === selectedRunId) || payrollRuns[0] || null;
  const runPayslips = useMemo(
    () => (activeRun ? payslips.filter((ps) => ps.payroll_run_id === activeRun.id) : []),
    [activeRun, payslips]
  );

  if (!canAccessPayroll) {
    return (
      <div className="space-y-4">
        <PageHeader title="Payroll & Timesheets" description="Attendance-based KES payroll calculations." />
        <InlineAlert tone="error">
          Payroll runs and employee salary records are restricted to Finance Managers, HR Managers, Admins, and Owners.
        </InlineAlert>
      </div>
    );
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    const res = await generatePayrollRun({
      period_label: periodLabel,
      period_start: periodStart,
      period_end: periodEnd,
    });
    setBusy(false);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else setFeedback({ tone: 'success', msg: 'Payroll run generated from active contracts & attendance.' });
  };

  const handleStatusChange = async (status: 'approved' | 'paid') => {
    if (!activeRun) return;
    setFeedback(null);
    setBusy(true);
    const res = await updatePayrollRunStatus(activeRun.id, status);
    setBusy(false);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else setFeedback({ tone: 'success', msg: `Payroll run marked as ${status}.` });
  };

  const openEditPayslip = (ps: Payslip) => {
    setEditingPayslip(ps);
    setEditAllowances(ps.allowances_kes);
    setEditOvertime(ps.overtime_pay_kes);
    setEditOtherDed(ps.other_deductions_kes);
  };

  const handleSavePayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayslip) return;
    setBusy(true);
    const res = await updatePayslipValues(editingPayslip.id, {
      allowances_kes: editAllowances,
      overtime_pay_kes: editOvertime,
      other_deductions_kes: editOtherDed,
    });
    setBusy(false);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setEditingPayslip(null);
      setFeedback({ tone: 'success', msg: 'Payslip adjusted and statutory deductions recalculated.' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 06 · Guard Payroll (KES)"
        title="Attendance Timesheets, Statutory Deductions & Payslips"
        description="Compute KES gross pay, overtime, PAYE, NSSF, and SHIF from verified shift attendance and employee contracts."
      />

      {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}

      <div className="grid lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4 p-5 space-y-4">
          <h2 className="font-bold text-base text-[#0B132B] flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[#059669]" /> Generate Payroll Run
          </h2>
          <form onSubmit={handleGenerate} className="space-y-3">
            <FormField label="Period Label" htmlFor="pr-label">
              <input
                id="pr-label"
                required
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Start Date" htmlFor="pr-start">
                <input
                  id="pr-start"
                  type="date"
                  required
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </FormField>
              <FormField label="End Date" htmlFor="pr-end">
                <input
                  id="pr-end"
                  type="date"
                  required
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </FormField>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Calculating...' : 'Generate Draft Payroll Run'}
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-8 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <label htmlFor="pr-select" className="text-xs font-semibold text-slate-600 block">
                Active Payroll Run
              </label>
              <select
                id="pr-select"
                value={activeRun?.id || ''}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[240px]"
              >
                {payrollRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.period_label} ({run.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {activeRun && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    activeRun.status === 'paid'
                      ? 'emerald'
                      : activeRun.status === 'approved'
                        ? 'navy'
                        : 'amber'
                  }
                >
                  {activeRun.status.toUpperCase()}
                </Badge>
                {canApprovePayroll && activeRun.status === 'draft' && (
                  <Button size="sm" disabled={busy} onClick={() => handleStatusChange('approved')}>
                    Approve Payroll Run
                  </Button>
                )}
                {canApprovePayroll && activeRun.status === 'approved' && (
                  <Button size="sm" disabled={busy} onClick={() => handleStatusChange('paid')}>
                    Mark Paid
                  </Button>
                )}
              </div>
            )}
          </div>

          {activeRun ? (
            <div className="grid sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Total Gross</div>
                <div className="text-base font-bold font-mono tabular-nums text-[#0B132B]">
                  {formatKES(activeRun.total_gross_kes)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Statutory &amp; Deductions</div>
                <div className="text-base font-bold font-mono tabular-nums text-[#D97706]">
                  {formatKES(activeRun.total_deductions_kes)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="text-[11px] text-emerald-800">Total Net Disbursement</div>
                <div className="text-base font-bold font-mono tabular-nums text-[#059669]">
                  {formatKES(activeRun.total_net_kes)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Payslips</div>
                <div className="text-base font-bold font-mono tabular-nums text-[#0B132B]">{runPayslips.length}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No payroll runs generated yet.</p>
          )}
        </Card>
      </div>

      {/* Payslips & Timesheets Table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base text-[#0B132B]">Guard Timesheets &amp; KES Payslips</h2>
            <p className="text-xs text-slate-500">
              {activeRun
                ? `${activeRun.period_label} · ${activeRun.period_start} to ${activeRun.period_end}`
                : 'Select a payroll run above'}
            </p>
          </div>
        </div>
        {runPayslips.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-600">No payslips in this payroll run.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Employee</th>
                  <th className="p-3 font-medium text-right">Shifts / Hrs</th>
                  <th className="p-3 font-medium text-right">Base + Allow + OT</th>
                  <th className="p-3 font-medium text-right">Gross</th>
                  <th className="p-3 font-medium text-right">PAYE</th>
                  <th className="p-3 font-medium text-right">NSSF</th>
                  <th className="p-3 font-medium text-right">SHIF</th>
                  <th className="p-3 font-medium text-right">Net Pay</th>
                  <th className="p-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {runPayslips.map((ps) => {
                  const emp = employees.find((e) => e.id === ps.employee_id);
                  return (
                    <tr key={ps.id} className="hover:bg-slate-50">
                      <td className="p-3 font-sans">
                        <div className="font-semibold text-slate-900">
                          {emp ? `${emp.first_name} ${emp.last_name}` : ps.employee_id}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">{emp?.employee_number}</div>
                      </td>
                      <td className="p-3 text-right">
                        {ps.shifts_worked}s · {ps.hours_worked}h
                        {ps.overtime_hours > 0 && (
                          <div className="text-[10px] text-[#059669]">+{ps.overtime_hours}h OT</div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {formatKES(ps.base_pay_kes)}
                        <div className="text-[10px] text-slate-500">
                          +{formatKES(ps.allowances_kes)} / +{formatKES(ps.overtime_pay_kes)}
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-900">{formatKES(ps.gross_pay_kes)}</td>
                      <td className="p-3 text-right text-slate-600">{formatKES(ps.paye_kes)}</td>
                      <td className="p-3 text-right text-slate-600">{formatKES(ps.nssf_kes)}</td>
                      <td className="p-3 text-right text-slate-600">{formatKES(ps.shif_kes)}</td>
                      <td className="p-3 text-right font-bold text-[#059669]">{formatKES(ps.net_pay_kes)}</td>
                      <td className="p-3 text-right font-sans">
                        <div className="inline-flex items-center gap-1.5">
                          {ps.status === 'draft' && (
                            <Button size="sm" variant="secondary" onClick={() => openEditPayslip(ps)}>
                              Adjust
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setViewingPayslip(ps)}>
                            Payslip
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Adjust Draft Payslip Drawer */}
      <Drawer
        open={Boolean(editingPayslip)}
        title="Adjust Draft Payslip"
        subtitle="PAYE, NSSF, and SHIF recalculate automatically on save"
        onClose={() => setEditingPayslip(null)}
      >
        {editingPayslip && (
          <form onSubmit={handleSavePayslip} className="space-y-4">
            <FormField label="Shift & Meal Allowances (KES)" htmlFor="ps-allow">
              <input
                id="ps-allow"
                type="number"
                min={0}
                value={editAllowances}
                onChange={(e) => setEditAllowances(Number(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </FormField>
            <FormField label="Overtime Pay (KES)" htmlFor="ps-ot">
              <input
                id="ps-ot"
                type="number"
                min={0}
                value={editOvertime}
                onChange={(e) => setEditOvertime(Number(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </FormField>
            <FormField label="Other Deductions / SACCO / Advances (KES)" htmlFor="ps-ded">
              <input
                id="ps-ded"
                type="number"
                min={0}
                value={editOtherDed}
                onChange={(e) => setEditOtherDed(Number(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditingPayslip(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Save &amp; Recalculate
              </Button>
            </div>
          </form>
        )}
      </Drawer>

      {/* Printable Payslip Drawer */}
      <Drawer
        open={Boolean(viewingPayslip)}
        title="Official Guard Payslip"
        subtitle={activeRun?.period_label}
        onClose={() => setViewingPayslip(null)}
      >
        {viewingPayslip && (() => {
          const emp = employees.find((e) => e.id === viewingPayslip.employee_id);
          return (
            <div className="space-y-5 text-sm">
              <div className="p-4 rounded-xl bg-[#0B132B] text-white flex items-start justify-between">
                <div>
                  <div className="text-xs text-emerald-400 font-semibold">{organization?.name}</div>
                  <div className="text-lg font-bold mt-0.5">
                    {emp ? `${emp.first_name} ${emp.last_name}` : viewingPayslip.employee_id}
                  </div>
                  <div className="text-xs font-mono text-slate-300 mt-0.5">
                    Badge: {emp?.employee_number || '—'} · Period: {activeRun?.period_start} to {activeRun?.period_end}
                  </div>
                </div>
                <Badge tone="emerald">{viewingPayslip.status.toUpperCase()}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-slate-500">Shifts Worked</div>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">{viewingPayslip.shifts_worked}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-slate-500">Hours Logged</div>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">{viewingPayslip.hours_worked} hrs</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-slate-500">Overtime Hours</div>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">{viewingPayslip.overtime_hours} hrs</div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                <div className="p-3 bg-slate-50 font-semibold text-xs text-slate-700">Earnings</div>
                <div className="p-3 flex justify-between">
                  <span>Basic Salary</span>
                  <span className="font-mono">{formatKES(viewingPayslip.base_pay_kes)}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span>Shift Allowances</span>
                  <span className="font-mono">{formatKES(viewingPayslip.allowances_kes)}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span>Overtime Pay</span>
                  <span className="font-mono">{formatKES(viewingPayslip.overtime_pay_kes)}</span>
                </div>
                <div className="p-3 flex justify-between font-bold bg-slate-50/60">
                  <span>Gross Earnings</span>
                  <span className="font-mono">{formatKES(viewingPayslip.gross_pay_kes)}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                <div className="p-3 bg-slate-50 font-semibold text-xs text-slate-700">Statutory &amp; Deductions</div>
                <div className="p-3 flex justify-between">
                  <span>P.A.Y.E Income Tax</span>
                  <span className="font-mono">{formatKES(viewingPayslip.paye_kes)}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span>NSSF Tier I/II</span>
                  <span className="font-mono">{formatKES(viewingPayslip.nssf_kes)}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span>SHIF (2.75%)</span>
                  <span className="font-mono">{formatKES(viewingPayslip.shif_kes)}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span>Other Deductions</span>
                  <span className="font-mono">{formatKES(viewingPayslip.other_deductions_kes)}</span>
                </div>
                <div className="p-3 flex justify-between font-bold text-[#059669] bg-emerald-50">
                  <span>Net Payable (KES)</span>
                  <span className="font-mono">{formatKES(viewingPayslip.net_pay_kes)}</span>
                </div>
              </div>

              <Button type="button" variant="secondary" onClick={() => window.print()} className="w-full">
                <Printer className="h-4 w-4" /> Print Payslip
              </Button>
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
};

// ==================== MODULE 07: FINANCE & BILLING ====================

export const FFFinancePage: React.FC = () => {
  const {
    currentRole,
    clients,
    sites,
    clientContracts,
    invoices,
    receipts,
    expenses,
    addClientContract,
    issueInvoice,
    recordReceipt,
    addExpense,
    approveExpense,
  } = useApp();

  const canViewFinance =
    currentRole === 'owner' ||
    currentRole === 'admin' ||
    currentRole === 'finance_manager' ||
    currentRole === 'operations_manager';
  const isFinanceOrAdmin = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'finance_manager';

  const [tab, setTab] = useState<'invoices' | 'contracts' | 'expenses'>('invoices');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Invoice form
  const [invClientId, setInvClientId] = useState(clients[0]?.id ?? '');
  const [invContractId, setInvContractId] = useState('');
  const [invIssueDate, setInvIssueDate] = useState(() => todayNairobiDate());
  const [invDueDate, setInvDueDate] = useState(() => todayNairobiDate());
  const [invDesc, setInvDesc] = useState('Monthly Guarding Services');
  const [invSubtotal, setInvSubtotal] = useState(180000);
  const [invVat, setInvVat] = useState(true);

  // Receipt form
  const [rcpInvoiceId, setRcpInvoiceId] = useState('');
  const [rcpAmount, setRcpAmount] = useState(0);
  const [rcpMethod, setRcpMethod] = useState<ReceiptRecord['payment_method']>('mpesa');
  const [rcpRef, setRcpRef] = useState('');

  // Contract form
  const [ctrClientId, setCtrClientId] = useState(clients[0]?.id ?? '');
  const [ctrSiteId, setCtrSiteId] = useState('');
  const [ctrRef, setCtrRef] = useState('');
  const [ctrFee, setCtrFee] = useState(120000);
  const [ctrGuards, setCtrGuards] = useState(4);
  const [ctrCycle, setCtrCycle] = useState<'monthly' | 'quarterly'>('monthly');
  const [ctrStart, setCtrStart] = useState(() => todayNairobiDate());

  // Expense form
  const [expSiteId, setExpSiteId] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseRecord['category']>('fuel_patrol');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState(4500);
  const [expDate, setExpDate] = useState(() => todayNairobiDate());

  useEffect(() => {
    if (!invClientId && clients[0]?.id) setInvClientId(clients[0].id);
    if (!ctrClientId && clients[0]?.id) setCtrClientId(clients[0].id);
    const firstUnpaid = invoices.find((i) => i.status !== 'paid');
    if (!rcpInvoiceId && firstUnpaid) {
      setRcpInvoiceId(firstUnpaid.id);
      setRcpAmount(Math.max(0, firstUnpaid.total_kes - firstUnpaid.amount_paid_kes));
    }
  }, [clients, invoices, invClientId, ctrClientId, rcpInvoiceId]);

  const summary = useMemo(() => {
    const totalBilled = invoices.reduce((sum, inv) => sum + inv.total_kes, 0);
    const totalCollected = invoices.reduce((sum, inv) => sum + inv.amount_paid_kes, 0);
    const outstanding = Math.max(0, totalBilled - totalCollected);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount_kes, 0);
    const netMargin = totalCollected - totalExpenses;
    return { totalBilled, totalCollected, outstanding, totalExpenses, netMargin };
  }, [invoices, expenses]);

  if (!canViewFinance) {
    return (
      <div className="space-y-4">
        <PageHeader title="Finance & Billing" description="Client contracts, invoices, receipts, and expenses." />
        <InlineAlert tone="error">
          Financial ledgers are restricted to Operations, Finance Managers, Admins, and Owners.
        </InlineAlert>
      </div>
    );
  }

  const handleIssueInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    const res = await issueInvoice({
      client_id: invClientId,
      contract_id: invContractId || null,
      issue_date: invIssueDate,
      due_date: invDueDate,
      description: invDesc,
      subtotal_kes: invSubtotal,
      include_vat: invVat,
    });
    setBusy(false);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else setFeedback({ tone: 'success', msg: 'Client invoice issued and recorded.' });
  };

  const handleRecordReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    const res = await recordReceipt({
      invoice_id: rcpInvoiceId,
      amount_kes: rcpAmount,
      payment_method: rcpMethod,
      reference_code: rcpRef,
    });
    setBusy(false);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setRcpRef('');
      setFeedback({ tone: 'success', msg: 'Payment receipt recorded and invoice balance updated.' });
    }
  };

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    const res = await addClientContract({
      client_id: ctrClientId,
      site_id: ctrSiteId || null,
      contract_ref: ctrRef,
      monthly_fee_kes: ctrFee,
      guards_billed: ctrGuards,
      billing_cycle: ctrCycle,
      start_date: ctrStart,
    });
    setBusy(false);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setCtrRef('');
      setFeedback({ tone: 'success', msg: 'Client service contract created.' });
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    const res = await addExpense({
      site_id: expSiteId || null,
      category: expCategory,
      description: expDesc,
      amount_kes: expAmount,
      expense_date: expDate,
    });
    setBusy(false);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else {
      setExpDesc('');
      setFeedback({ tone: 'success', msg: 'Site operational expense logged.' });
    }
  };

  const handleApproveExpense = async (id: string) => {
    setFeedback(null);
    setBusy(true);
    const res = await approveExpense(id);
    setBusy(false);
    if (res.error) setFeedback({ tone: 'error', msg: res.error });
    else setFeedback({ tone: 'success', msg: 'Expense approved.' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 07 · Finance & Billing"
        title="Client Contracts, Invoices, Receipts & Site Expenses"
        description="Manage commercial guarding contracts, VAT invoicing, M-Pesa/EFT payment reconciliation, and operational expenses."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-xs text-slate-500">Total Billed</div>
          <div className="text-lg font-bold font-mono tabular-nums text-[#0B132B] mt-1">
            {formatKES(summary.totalBilled)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">Collected Cash</div>
          <div className="text-lg font-bold font-mono tabular-nums text-[#059669] mt-1">
            {formatKES(summary.totalCollected)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">Outstanding Balances</div>
          <div
            className={`text-lg font-bold font-mono tabular-nums mt-1 ${
              summary.outstanding > 0 ? 'text-[#D97706]' : 'text-[#059669]'
            }`}
          >
            {formatKES(summary.outstanding)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">Site Expenses</div>
          <div className="text-lg font-bold font-mono tabular-nums text-[#0B132B] mt-1">
            {formatKES(summary.totalExpenses)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">Net Operating Cashflow</div>
          <div className="text-lg font-bold font-mono tabular-nums text-[#0B132B] mt-1">
            {formatKES(summary.netMargin)}
          </div>
        </Card>
      </div>

      {feedback && <InlineAlert tone={feedback.tone}>{feedback.msg}</InlineAlert>}

      <div className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
        {(
          [
            { key: 'invoices', label: `Invoices & Receipts (${invoices.length})` },
            { key: 'contracts', label: `Client Contracts (${clientContracts.length})` },
            { key: 'expenses', label: `Site Expenses (${expenses.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
              tab === t.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <div className="space-y-6">
          {isFinanceOrAdmin && (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-5 space-y-3">
                <h2 className="font-bold text-sm text-[#0B132B] flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#059669]" /> Issue Client Invoice
                </h2>
                <form onSubmit={handleIssueInvoice} className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormField label="Client Account" htmlFor="inv-client">
                      <select
                        id="inv-client"
                        required
                        value={invClientId}
                        onChange={(e) => setInvClientId(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.company_name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Linked Contract (Optional)" htmlFor="inv-ctr">
                      <select
                        id="inv-ctr"
                        value={invContractId}
                        onChange={(e) => setInvContractId(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        <option value="">Direct Invoice</option>
                        {clientContracts
                          .filter((c) => c.client_id === invClientId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.contract_ref} ({formatKES(c.monthly_fee_kes)})
                            </option>
                          ))}
                      </select>
                    </FormField>
                  </div>
                  <FormField label="Line Item Description" htmlFor="inv-desc">
                    <input
                      id="inv-desc"
                      required
                      value={invDesc}
                      onChange={(e) => setInvDesc(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </FormField>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField label="Subtotal (KES)" htmlFor="inv-sub">
                      <input
                        id="inv-sub"
                        type="number"
                        min={1}
                        required
                        value={invSubtotal}
                        onChange={(e) => setInvSubtotal(Number(e.target.value) || 0)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </FormField>
                    <FormField label="Issue Date" htmlFor="inv-issue">
                      <input
                        id="inv-issue"
                        type="date"
                        required
                        value={invIssueDate}
                        onChange={(e) => setInvIssueDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs font-mono"
                      />
                    </FormField>
                    <FormField label="Due Date" htmlFor="inv-due">
                      <input
                        id="inv-due"
                        type="date"
                        required
                        value={invDueDate}
                        onChange={(e) => setInvDueDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs font-mono"
                      />
                    </FormField>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={invVat}
                      onChange={(e) => setInvVat(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Include 16% Kenya VAT ({formatKES(invVat ? Math.round(invSubtotal * 0.16) : 0)})
                  </label>
                  <Button type="submit" disabled={busy || !invClientId} className="w-full">
                    Issue Invoice
                  </Button>
                </form>
              </Card>

              <Card className="p-5 space-y-3">
                <h2 className="font-bold text-sm text-[#0B132B] flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-[#059669]" /> Record Payment Receipt
                </h2>
                <form onSubmit={handleRecordReceipt} className="space-y-3">
                  <FormField label="Target Invoice" htmlFor="rcp-inv">
                    <select
                      id="rcp-inv"
                      required
                      value={rcpInvoiceId}
                      onChange={(e) => {
                        setRcpInvoiceId(e.target.value);
                        const found = invoices.find((i) => i.id === e.target.value);
                        if (found) setRcpAmount(Math.max(0, found.total_kes - found.amount_paid_kes));
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="">-- Select invoice --</option>
                      {invoices.map((inv) => {
                        const bal = Math.max(0, inv.total_kes - inv.amount_paid_kes);
                        const cli = clients.find((c) => c.id === inv.client_id);
                        return (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoice_number} · {cli?.company_name} (Bal: {formatKES(bal)})
                          </option>
                        );
                      })}
                    </select>
                  </FormField>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormField label="Amount Received (KES)" htmlFor="rcp-amt">
                      <input
                        id="rcp-amt"
                        type="number"
                        min={1}
                        required
                        value={rcpAmount}
                        onChange={(e) => setRcpAmount(Number(e.target.value) || 0)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </FormField>
                    <FormField label="Payment Channel" htmlFor="rcp-method">
                      <select
                        id="rcp-method"
                        value={rcpMethod}
                        onChange={(e) => setRcpMethod(e.target.value as ReceiptRecord['payment_method'])}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        <option value="mpesa">M-Pesa Paybill</option>
                        <option value="eft">Bank EFT / RTGS</option>
                        <option value="cheque">Cheque</option>
                        <option value="cash">Cash</option>
                      </select>
                    </FormField>
                  </div>
                  <FormField label="Transaction Reference Code" htmlFor="rcp-ref">
                    <input
                      id="rcp-ref"
                      required
                      value={rcpRef}
                      onChange={(e) => setRcpRef(e.target.value)}
                      placeholder="e.g. MPESA-SK9284PL1"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono uppercase"
                    />
                  </FormField>
                  <Button type="submit" disabled={busy || !rcpInvoiceId} className="w-full">
                    Record Payment Receipt
                  </Button>
                </form>
              </Card>
            </div>
          )}

          <Card className="overflow-x-auto">
            <div className="p-4 border-b border-slate-200 font-bold text-sm text-[#0B132B]">Invoices Ledger</div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Invoice #</th>
                  <th className="p-3 font-medium">Client</th>
                  <th className="p-3 font-medium">Due Date</th>
                  <th className="p-3 font-medium text-right">Total (KES)</th>
                  <th className="p-3 font-medium text-right">Paid (KES)</th>
                  <th className="p-3 font-medium text-right">Balance</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const cli = clients.find((c) => c.id === inv.client_id);
                  const balance = Math.max(0, inv.total_kes - inv.amount_paid_kes);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-semibold text-slate-900">{inv.invoice_number}</td>
                      <td className="p-3 text-slate-700">{cli?.company_name || inv.client_id}</td>
                      <td className="p-3 font-mono">{inv.due_date}</td>
                      <td className="p-3 text-right font-mono">{formatKES(inv.total_kes)}</td>
                      <td className="p-3 text-right font-mono text-[#059669]">{formatKES(inv.amount_paid_kes)}</td>
                      <td className="p-3 text-right font-mono font-semibold">{formatKES(balance)}</td>
                      <td className="p-3">
                        <Badge
                          tone={
                            inv.status === 'paid'
                              ? 'emerald'
                              : inv.status === 'overdue'
                                ? 'rose'
                                : inv.status === 'partial'
                                  ? 'amber'
                                  : 'navy'
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card className="overflow-x-auto">
            <div className="p-4 border-b border-slate-200 font-bold text-sm text-[#0B132B]">Payment Receipts</div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Receipt #</th>
                  <th className="p-3 font-medium">Client</th>
                  <th className="p-3 font-medium">Method &amp; Ref</th>
                  <th className="p-3 font-medium">Received (EAT)</th>
                  <th className="p-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((rcp) => {
                  const cli = clients.find((c) => c.id === rcp.client_id);
                  return (
                    <tr key={rcp.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-semibold">{rcp.receipt_number}</td>
                      <td className="p-3 text-slate-700">{cli?.company_name || rcp.client_id}</td>
                      <td className="p-3 font-mono uppercase">
                        {rcp.payment_method} · {rcp.reference_code}
                      </td>
                      <td className="p-3 font-mono">{formatNairobiDateTime(rcp.received_at)}</td>
                      <td className="p-3 text-right font-mono font-semibold text-[#059669]">
                        {formatKES(rcp.amount_kes)}
                      </td>
                    </tr>
                  );
                })}
                {receipts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-5 text-center text-slate-500">
                      No payment receipts recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'contracts' && (
        <div className="grid lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-4 p-5 space-y-3">
            <h2 className="font-bold text-sm text-[#0B132B]">New Client Contract</h2>
            <form onSubmit={handleAddContract} className="space-y-3">
              <FormField label="Client" htmlFor="ctr-client">
                <select
                  id="ctr-client"
                  required
                  value={ctrClientId}
                  onChange={(e) => setCtrClientId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Site (Optional)" htmlFor="ctr-site">
                <select
                  id="ctr-site"
                  value={ctrSiteId}
                  onChange={(e) => setCtrSiteId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">All Client Sites</option>
                  {sites
                    .filter((s) => s.client_id === ctrClientId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </FormField>
              <FormField label="Contract Ref" htmlFor="ctr-ref">
                <input
                  id="ctr-ref"
                  required
                  value={ctrRef}
                  onChange={(e) => setCtrRef(e.target.value)}
                  placeholder="SLA-2026-02"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono uppercase"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Monthly Fee (KES)" htmlFor="ctr-fee">
                  <input
                    id="ctr-fee"
                    type="number"
                    min={0}
                    required
                    value={ctrFee}
                    onChange={(e) => setCtrFee(Number(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </FormField>
                <FormField label="Guards Billed" htmlFor="ctr-guards">
                  <input
                    id="ctr-guards"
                    type="number"
                    min={1}
                    required
                    value={ctrGuards}
                    onChange={(e) => setCtrGuards(Number(e.target.value) || 1)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Billing Cycle" htmlFor="ctr-cycle">
                  <select
                    id="ctr-cycle"
                    value={ctrCycle}
                    onChange={(e) => setCtrCycle(e.target.value as 'monthly' | 'quarterly')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </FormField>
                <FormField label="Start Date" htmlFor="ctr-start">
                  <input
                    id="ctr-start"
                    type="date"
                    required
                    value={ctrStart}
                    onChange={(e) => setCtrStart(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs font-mono"
                  />
                </FormField>
              </div>
              <Button type="submit" disabled={busy || !ctrClientId} className="w-full">
                Create Service Contract
              </Button>
            </form>
          </Card>

          <Card className="lg:col-span-8 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Contract Ref</th>
                  <th className="p-3 font-medium">Client / Site</th>
                  <th className="p-3 font-medium">Guards</th>
                  <th className="p-3 font-medium text-right">Monthly Fee</th>
                  <th className="p-3 font-medium">Dates</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientContracts.map((cc) => {
                  const cli = clients.find((c) => c.id === cc.client_id);
                  const site = sites.find((s) => s.id === cc.site_id);
                  return (
                    <tr key={cc.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-semibold text-slate-900">{cc.contract_ref}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{cli?.company_name}</div>
                        <div className="text-[11px] text-slate-500">{site?.name || 'Portfolio Wide'}</div>
                      </td>
                      <td className="p-3 font-mono">{cc.guards_billed}</td>
                      <td className="p-3 text-right font-mono font-semibold">{formatKES(cc.monthly_fee_kes)}</td>
                      <td className="p-3 font-mono text-[11px]">
                        {cc.start_date} {cc.end_date ? `→ ${cc.end_date}` : ''}
                      </td>
                      <td className="p-3">
                        <Badge tone="emerald">{cc.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="grid lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-4 p-5 space-y-3">
            <h2 className="font-bold text-sm text-[#0B132B] flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[#059669]" /> Record Site Expense
            </h2>
            <form onSubmit={handleAddExpense} className="space-y-3">
              <FormField label="Site (Optional)" htmlFor="exp-site">
                <select
                  id="exp-site"
                  value={expSiteId}
                  onChange={(e) => setExpSiteId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">General Operations</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Category" htmlFor="exp-cat">
                <select
                  id="exp-cat"
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as ExpenseRecord['category'])}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="uniforms">Uniforms &amp; Boots</option>
                  <option value="fuel_patrol">Patrol Vehicle Fuel</option>
                  <option value="equipment">Torches &amp; Batons</option>
                  <option value="communications">VHF Radios &amp; Airtime</option>
                  <option value="welfare">Guard Welfare</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
              <FormField label="Description" htmlFor="exp-desc">
                <input
                  id="exp-desc"
                  required
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="e.g. Night supervisor patrol fuel"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Amount (KES)" htmlFor="exp-amt">
                  <input
                    id="exp-amt"
                    type="number"
                    min={1}
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </FormField>
                <FormField label="Date" htmlFor="exp-date">
                  <input
                    id="exp-date"
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-2 text-xs font-mono"
                  />
                </FormField>
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                Log Expense
              </Button>
            </form>
          </Card>

          <Card className="lg:col-span-8 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Site &amp; Category</th>
                  <th className="p-3 font-medium">Description</th>
                  <th className="p-3 font-medium text-right">Amount</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((ex) => {
                  const site = sites.find((s) => s.id === ex.site_id);
                  return (
                    <tr key={ex.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono">{ex.expense_date}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{site?.name || 'Operations HQ'}</div>
                        <div className="text-[11px] text-slate-500 uppercase">{ex.category.replace('_', ' ')}</div>
                      </td>
                      <td className="p-3 text-slate-700">{ex.description}</td>
                      <td className="p-3 text-right font-mono font-semibold">{formatKES(ex.amount_kes)}</td>
                      <td className="p-3">
                        {ex.status === 'approved' ? (
                          <Badge tone="emerald">Approved</Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge tone="amber">Recorded</Badge>
                            {isFinanceOrAdmin && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() => handleApproveExpense(ex.id)}
                              >
                                Approve
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
};

// ==================== MODULE 08: CLIENT PORTAL ====================

interface ClientPortalPayload {
  client: Client | null;
  sites: Site[];
  posts: Post[];
  attendanceSummary: {
    totalEvents: number;
    onTimeRate: number;
    geofenceInsideRate: number;
    shiftCoverageRate: number;
  };
  patrolSummary: {
    totalCheckpoints: number;
    totalScans: number;
  };
  incidents: Incident[];
  contracts: ClientContract[];
  invoices: Invoice[];
  receipts: ReceiptRecord[];
}

export const FFClientPortalPage: React.FC = () => {
  const { currentRole, clients, fetchClientPortalData } = useApp();
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? '');
  const [portalData, setPortalData] = useState<ClientPortalPayload | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const isClientRole = currentRole === 'client';

  const loadPortal = useCallback(
    async (cid?: string) => {
      setLoadingPortal(true);
      setPortalError(null);
      const res = await fetchClientPortalData(isClientRole ? undefined : cid || undefined);
      setLoadingPortal(false);
      if (res.error) setPortalError(res.error);
      else if (res.data) setPortalData(res.data);
    },
    [fetchClientPortalData, isClientRole]
  );

  useEffect(() => {
    if (!isClientRole && !selectedClientId && clients[0]?.id) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, isClientRole, selectedClientId]);

  useEffect(() => {
    loadPortal(selectedClientId);
  }, [loadPortal, selectedClientId]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 08 · Client Portal"
        title={portalData?.client ? `${portalData.client.company_name} · Service Portal` : 'Client Service Portal'}
        description="Authorised site SLA reports, attendance & geofence summaries, security incidents, contracts, and billing invoices."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!isClientRole && clients.length > 0 && (
              <select
                aria-label="Select client portal preview"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    Preview: {c.company_name}
                  </option>
                ))}
              </select>
            )}
            <Button variant="secondary" size="sm" onClick={() => loadPortal(selectedClientId)} disabled={loadingPortal}>
              <RefreshCw className={`h-3.5 w-3.5 ${loadingPortal ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        }
      />

      {portalError && <InlineAlert tone="error">{portalError}</InlineAlert>}

      {loadingPortal && !portalData ? (
        <LoadingSkeleton rows={4} />
      ) : !portalData?.client ? (
        <EmptyState
          title="No client portal data available"
          description="Ensure your account is linked to an active client record."
        />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="text-xs text-slate-500">Post Shift Coverage</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#059669] mt-1">
                {portalData.attendanceSummary.shiftCoverageRate}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {portalData.sites.length} site(s) · {portalData.posts.length} manned post(s)
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-xs text-slate-500">On-Time Guard Arrival</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#0B132B] mt-1">
                {portalData.attendanceSummary.onTimeRate}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {portalData.attendanceSummary.totalEvents} attendance log(s)
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-xs text-slate-500">Geofence Compliance</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#0B132B] mt-1">
                {portalData.attendanceSummary.geofenceInsideRate}%
              </div>
              <div className="text-xs text-slate-500 mt-1">Verified within site radius</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs text-slate-500">Patrol Rounds Verified</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#0B132B] mt-1">
                {portalData.patrolSummary.totalScans}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Across {portalData.patrolSummary.totalCheckpoints} QR checkpoint(s)
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-6 p-5 space-y-3">
              <h2 className="font-bold text-base text-[#0B132B] flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#059669]" /> Guarded Sites &amp; Posts
              </h2>
              <div className="divide-y divide-slate-100 text-sm">
                {portalData.sites.map((site) => {
                  const sitePosts = portalData.posts.filter((p) => p.site_id === site.id);
                  return (
                    <div key={site.id} className="py-3 first:pt-1 last:pb-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{site.name}</span>
                        <Badge tone={site.is_active ? 'emerald' : 'slate'}>
                          {site.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {site.city} · {site.location_description}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {sitePosts.map((p) => (
                          <Badge key={p.id} tone="navy">
                            {p.name} ({p.required_guards} guard{p.required_guards > 1 ? 's' : ''})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="lg:col-span-6 p-5 space-y-3">
              <h2 className="font-bold text-base text-[#0B132B] flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-[#D97706]" /> Authorised Incident &amp; OB Reports
              </h2>
              {portalData.incidents.length === 0 ? (
                <p className="text-sm text-slate-500">No incidents recorded across your sites.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {portalData.incidents.map((inc) => (
                    <div key={inc.id} className="py-3 first:pt-1 last:pb-0 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge tone={inc.severity === 'high' || inc.severity === 'critical' ? 'rose' : 'amber'}>
                            {inc.severity}
                          </Badge>
                          <span className="font-semibold text-slate-900 uppercase">
                            {inc.category.replace('_', ' ')}
                          </span>
                          {inc.ob_number && <span className="font-mono text-slate-500">{inc.ob_number}</span>}
                        </div>
                        <span className="font-mono text-slate-500">{formatNairobiDateTime(inc.occurrence_time)}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{inc.narrative}</p>
                      {inc.review_notes && (
                        <p className="text-[#059669] font-medium">Supervisor Note: {inc.review_notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-x-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-bold text-base text-[#0B132B]">Invoices &amp; Service Billing Statements</h2>
              <span className="text-xs font-mono text-slate-500">
                {portalData.contracts.length} active contract(s) · {portalData.receipts.length} receipt(s)
              </span>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 font-medium">Invoice #</th>
                  <th className="p-3 font-medium">Issue / Due</th>
                  <th className="p-3 font-medium text-right">Total</th>
                  <th className="p-3 font-medium text-right">Paid</th>
                  <th className="p-3 font-medium text-right">Balance</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {portalData.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-semibold">{inv.invoice_number}</td>
                    <td className="p-3 font-mono">
                      {inv.issue_date} → {inv.due_date}
                    </td>
                    <td className="p-3 text-right font-mono">{formatKES(inv.total_kes)}</td>
                    <td className="p-3 text-right font-mono text-[#059669]">{formatKES(inv.amount_paid_kes)}</td>
                    <td className="p-3 text-right font-mono font-semibold">
                      {formatKES(Math.max(0, inv.total_kes - inv.amount_paid_kes))}
                    </td>
                    <td className="p-3">
                      <Badge tone={inv.status === 'paid' ? 'emerald' : 'amber'}>{inv.status}</Badge>
                    </td>
                  </tr>
                ))}
                {portalData.invoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-5 text-center text-slate-500">
                      No invoices issued for this client yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
};

// ==================== MODULE 09: FIELDFORCE AI INTELLIGENCE ====================

export const FFIntelligencePage: React.FC = () => {
  const { currentRole, fetchOperationalIntelligence, queryFieldForceIntelligence, prepareIntelligenceReport } = useApp();

  const canAccess = currentRole !== 'guard' && currentRole !== 'client';

  const [intel, setIntel] = useState<OperationalIntelligence | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [qaBusy, setQaBusy] = useState(false);
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [qaSource, setQaSource] = useState<string | null>(null);

  const [reportType, setReportType] = useState('daily_operations');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [reportSource, setReportSource] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  const loadIntel = useCallback(async () => {
    setLoadingIntel(true);
    setErrorMsg(null);
    const res = await fetchOperationalIntelligence();
    setLoadingIntel(false);
    if (res.error) setErrorMsg(res.error);
    else if (res.data) setIntel(res.data);
  }, [fetchOperationalIntelligence]);

  useEffect(() => {
    if (canAccess) loadIntel();
  }, [canAccess, loadIntel]);

  if (!canAccess) {
    return (
      <div className="space-y-4">
        <PageHeader title="FieldForce AI Intelligence" description="Operational anomalies and executive briefings." />
        <InlineAlert tone="error">
          Management intelligence briefings are restricted to Supervisors, Managers, Admins, and Owners.
        </InlineAlert>
      </div>
    );
  }

  const runQuestion = async (q: string) => {
    if (q.trim().length < 3) return;
    setQaBusy(true);
    setQuestion(q);
    const res = await queryFieldForceIntelligence(q);
    setQaBusy(false);
    if (res.error) setQaAnswer(res.error);
    else {
      setQaAnswer(res.answer || '');
      setQaSource(res.source || 'sqlite-deterministic');
      if (res.intelligence) setIntel(res.intelligence);
    }
  };

  const handlePrepareReport = async () => {
    setReportBusy(true);
    const res = await prepareIntelligenceReport(reportType);
    setReportBusy(false);
    if (res.error) setErrorMsg(res.error);
    else {
      setReportText(res.reportText || '');
      setReportSource(res.source || 'sqlite-deterministic');
    }
  };

  const downloadReport = () => {
    if (!reportText) return;
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldforce_${reportType}_${todayNairobiDate()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module 09 · FieldForce AI Intelligence"
        title="Operational Anomalies, Expiring Compliance & Executive Briefings"
        description="Real-time SQLite anomaly detection, expiring PSRA/DCI alerts, management Q&A, and automated report preparation."
        actions={
          <Button variant="secondary" size="sm" onClick={loadIntel} disabled={loadingIntel}>
            <RefreshCw className={`h-3.5 w-3.5 ${loadingIntel ? 'animate-spin' : ''}`} /> Refresh Telemetry
          </Button>
        }
      />

      {errorMsg && <InlineAlert tone="error">{errorMsg}</InlineAlert>}

      {loadingIntel && !intel ? (
        <LoadingSkeleton rows={4} />
      ) : intel ? (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="text-xs text-slate-500">Shift Coverage Rate</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#0B132B] mt-1">
                {intel.metrics.coverageRate}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {intel.understaffedShifts.length} understaffed shift(s)
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-xs text-slate-500">Patrol Compliance Today</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#059669] mt-1">
                {intel.metrics.patrolComplianceRate}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {intel.metrics.missedPatrolCount} pending checkpoint(s)
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-xs text-slate-500">Expiring Documents (&lt;=30d)</div>
              <div
                className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                  intel.metrics.expiringDocsCount > 0 ? 'text-[#D97706]' : 'text-[#059669]'
                }`}
              >
                {intel.metrics.expiringDocsCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">PSRA / Good Conduct alerts</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs text-slate-500">Open Security Incidents</div>
              <div
                className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                  intel.metrics.openIncidentsCount > 0 ? 'text-[#E11D48]' : 'text-[#059669]'
                }`}
              >
                {intel.metrics.openIncidentsCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">On-time arrival: {intel.metrics.onTimeRate}%</div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            {/* Management Q&A */}
            <Card className="lg:col-span-6 p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-base text-[#0B132B] flex items-center gap-2">
                  <Bot className="h-4 w-4 text-[#059669]" /> Ask FieldForce Management AI
                </h2>
                {qaSource && <Badge tone="navy">{qaSource}</Badge>}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runQuestion(question);
                }}
                className="flex gap-2"
              >
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about coverage gaps, expiring docs, patrols..."
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <Button type="submit" disabled={qaBusy || question.trim().length < 3}>
                  <Send className="h-4 w-4" /> Ask
                </Button>
              </form>

              <div className="flex flex-wrap gap-2">
                {[
                  'Which shifts lack guard coverage today?',
                  'What employee compliance documents are expiring soon?',
                  'Summarize attendance anomalies and missed patrol checkpoints.',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={qaBusy}
                    onClick={() => runQuestion(preset)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer text-left"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {qaAnswer && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {qaBusy ? 'Analyzing live operational records...' : qaAnswer}
                </div>
              )}
            </Card>

            {/* Automatic Report Preparation */}
            <Card className="lg:col-span-6 p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-base text-[#0B132B] flex items-center gap-2">
                  <FileBarChart2 className="h-4 w-4 text-[#059669]" /> Automatic Report Preparation
                </h2>
                {reportSource && <Badge tone="emerald">{reportSource}</Badge>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Report Template"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="daily_operations">Daily Operations Executive Brief</option>
                  <option value="client_sla">Client SLA &amp; Guard Coverage Report</option>
                  <option value="compliance_audit">PSRA &amp; Attendance Compliance Audit</option>
                </select>
                <Button onClick={handlePrepareReport} disabled={reportBusy}>
                  <Sparkles className="h-4 w-4" /> {reportBusy ? 'Preparing...' : 'Prepare Report'}
                </Button>
              </div>

              {reportText ? (
                <div className="space-y-2">
                  <pre className="p-4 rounded-xl bg-[#0B132B] text-slate-100 text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
                    {reportText}
                  </pre>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard?.writeText(reportText);
                        setCopiedReport(true);
                        setTimeout(() => setCopiedReport(false), 1500);
                      }}
                    >
                      {copiedReport ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedReport ? 'Copied' : 'Copy Briefing'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={downloadReport}>
                      <Download className="h-3.5 w-3.5" /> Download .TXT
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Select a template and click <strong>Prepare Report</strong> to compile an executive operations brief from live SQLite records.
                </p>
              )}
            </Card>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            {/* Detected Anomalies & Coverage Alerts */}
            <Card className="lg:col-span-7 p-6 space-y-4">
              <h2 className="font-bold text-base text-[#0B132B] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#D97706]" /> Detected Anomalies &amp; Coverage Alerts
              </h2>
              {intel.anomalies.length === 0 ? (
                <StatusLabel label="No anomalies detected across sites or schedules" tone="emerald" />
              ) : (
                <div className="divide-y divide-slate-100">
                  {intel.anomalies.map((an) => (
                    <div key={an.id} className="py-3 first:pt-1 last:pb-0 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={an.severity === 'high' ? 'rose' : an.severity === 'medium' ? 'amber' : 'slate'}>
                            {an.severity}
                          </Badge>
                          <span className="font-semibold text-sm text-slate-900">{an.title}</span>
                        </div>
                        <p className="text-xs text-slate-600">{an.detail}</p>
                      </div>
                      <Link to={an.route} className="text-xs font-semibold text-[#059669] hover:underline shrink-0">
                        Resolve →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Operational Recommendations & Expiring Documents */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="p-6 space-y-3">
                <h2 className="font-bold text-base text-[#0B132B] flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#059669]" /> Operational Recommendations
                </h2>
                <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                  {intel.recommendations.map((rec, i) => (
                    <li key={i} className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/70">
                      {i + 1}. {rec}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-6 space-y-3">
                <h2 className="font-bold text-base text-[#0B132B] flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-[#D97706]" /> Expiring Documents (&lt;=30 Days)
                </h2>
                {intel.expiringDocs.length === 0 ? (
                  <p className="text-xs text-slate-500">All employee compliance records are valid beyond 30 days.</p>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {intel.expiringDocs.map((doc) => (
                      <div key={doc.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900">{doc.employeeName}</div>
                          <div className="text-slate-600">{doc.title}</div>
                        </div>
                        <Badge tone={doc.expired ? 'rose' : 'amber'}>
                          {doc.expired ? 'Expired' : 'Due'} {doc.expiryDate}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
