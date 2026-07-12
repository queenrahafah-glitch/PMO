import { useEffect, useMemo, useState } from 'react';
import { CostEfficiencyTable } from './components/CostEfficiencyTable';
import { DebugView } from './components/DebugView';
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

export default function App() {
  if (GOOGLE_SHEET_ID && new URLSearchParams(window.location.search).has('debug')) {
    return <DebugView sheetId={GOOGLE_SHEET_ID} />;
  }
  return <Dashboard />;
}

function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState<Record<number, boolean>>({ 0: true });

  useEffect(() => {
    loadData()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

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

  if (error) {
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
      <TopBar query={query} onQueryChange={setQuery} todayLabel={todayLabel} />
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
    </div>
  );
}
