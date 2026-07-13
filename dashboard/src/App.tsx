import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CostEfficiencyTable } from './components/CostEfficiencyTable';
import { HospitalDirectorAccordion } from './components/HospitalDirectorAccordion';
import { StatusMixBar } from './components/StatusMixBar';
import { SummaryCards } from './components/SummaryCards';
import { TopBar } from './components/TopBar';
import { loadDashboardDataFromGoogleSheet, loadDashboardDataFromXlsx } from './lib/parseWorkbook';
import { buildStatusMix, buildSummaryCards, costEffSearchText, filterByQuery, hospitalSearchText, totalSavings } from './lib/summary';
import type { DashboardData } from './lib/types';
import './styles/dashboard.css';

const GOOGLE_SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID as string | undefined;
const WORKBOOK_URL = `${import.meta.env.BASE_URL}data/project-tracking.xlsx`;

function loadData(): Promise<DashboardData> {
  return GOOGLE_SHEET_ID ? loadDashboardDataFromGoogleSheet(GOOGLE_SHEET_ID) : loadDashboardDataFromXlsx(WORKBOOK_URL);
}

const todayLabel = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
const AUTO_REFRESH_MS = 60_000;

function timeLabel(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState<Record<number, boolean>>({ 0: true });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const next = await loadData();
      setData(next);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Poll for sheet edits while the page is open, and immediately re-check when
    // the tab regains focus (e.g. after switching to the sheet to make an edit).
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const filteredCostEff = useMemo(
    () => (data ? filterByQuery(data.costEfficiency, query, costEffSearchText) : []),
    [data, query],
  );
  const filteredHospital = useMemo(
    () => (data ? filterByQuery(data.hospitalDirector, query, hospitalSearchText) : []),
    [data, query],
  );

  const summaryCards = useMemo(() => (data ? buildSummaryCards(data) : []), [data]);
  const statusMix = useMemo(() => (data ? buildStatusMix(data.hospitalDirector) : []), [data]);

  if (error && !data) {
    return (
      <div className="state-screen state-screen--error">
        Couldn't load the tracking sheet. · تعذر تحميل ملف التتبع
        <span style={{ fontSize: 13, opacity: 0.8 }}>{error}</span>
      </div>
    );
  }

  if (!data) {
    return <div className="state-screen">Loading dashboard data… · جارٍ تحميل البيانات</div>;
  }

  const savingsLabel = `${(totalSavings(data.costEfficiency) / 1e6).toFixed(1)}M SAR realized`;
  const allTasks = data.hospitalDirector.flatMap((p) => p.tasks);

  return (
    <div className="dashboard">
      <TopBar
        query={query}
        onQueryChange={setQuery}
        todayLabel={todayLabel}
        updatedAt={updatedAt ? timeLabel(updatedAt) : null}
        refreshing={refreshing}
        onRefresh={refresh}
      />
      <SummaryCards cards={summaryCards} />
      <StatusMixBar segments={statusMix} />
      <CostEfficiencyTable projects={filteredCostEff} count={data.costEfficiency.length} savingsLabel={savingsLabel} />
      <HospitalDirectorAccordion
        projects={filteredHospital}
        count={data.hospitalDirector.length}
        taskCount={allTasks.length}
        openIds={openIds}
        onToggle={(i) => setOpenIds((s) => ({ ...s, [i]: !s[i] }))}
      />
      <div className="footer-note">
        Figures are computed live from task status, risk and cost-savings fields in the source tracking sheet — no manual
        totals to maintain. · الأرقام محسوبة تلقائيًا من حالة المهام والتكاليف في الملف الأصلي
      </div>
      <div className="footer-credit" dir="rtl">
        جميع الحقوق محفوظة · رهف الحقباني © {new Date().getFullYear()}
      </div>
    </div>
  );
}
