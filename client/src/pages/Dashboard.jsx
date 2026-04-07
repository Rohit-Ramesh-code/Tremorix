import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { ArrowLeft, Menu, Bell, Share2, FileDown, Home, Dumbbell, Mail, User } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function Dashboard() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef(null);
  const exportRef = useRef(null);

  const handleExportPDF = async () => {
    if (!exportRef.current || !profile) return;
    setIsExporting(true);
    try {
      // Store current scroll to restore later, and scroll to top
      // html2canvas commonly renders blank canvases if the window is scrolled down
      const originalScrollTop = document.documentElement.scrollTop;
      document.documentElement.scrollTop = 0;

      // Small timeout to ensure DOM is settled after scroll and re-render
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        logging: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: exportRef.current.offsetWidth,
        height: exportRef.current.offsetHeight,
      });

      // Restore scroll
      document.documentElement.scrollTop = originalScrollTop;

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.setFontSize(16);
      pdf.setTextColor(13, 142, 188); // Teal color matching the app
      pdf.text(`Tremorix Report: ${profile.name}`, 15, 15);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 15, 22);

      // Add the image below the header text
      pdf.addImage(imgData, 'PNG', 10, 30, pdfWidth - 20, pdfHeight * ((pdfWidth - 20) / pdfWidth));
      pdf.save(`Tremorix_Report_${profile.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      // Fallback
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const avgRoll = telemetry.length
    ? (telemetry.reduce((sum, r) => sum + Math.abs(r.roll), 0) / telemetry.length).toFixed(1)
    : '—';

  const avgPitch = telemetry.length
    ? (telemetry.reduce((sum, r) => sum + Math.abs(r.pitch), 0) / telemetry.length).toFixed(1)
    : '—';

  // Compute combined magnitude vector for severity and frequency metrics
  const telemetryWithMag = telemetry.map(r => ({
    ...r,
    magnitude: Math.sqrt(Math.pow(r.pitch, 2) + Math.pow(r.roll, 2))
  }));

  const tremorEpisodeRate = (() => {
    if (!telemetryWithMag.length) return '—';
    const mean = telemetryWithMag.reduce((sum, r) => sum + r.magnitude, 0) / telemetryWithMag.length;
    const variance = telemetryWithMag.reduce((sum, r) => sum + Math.pow(r.magnitude - mean, 2), 0) / telemetryWithMag.length;
    const threshold = mean + Math.sqrt(variance);
    let episodes = 0;
    let wasAbove = false;
    for (const r of telemetryWithMag) {
      const above = r.magnitude > threshold;
      if (above && !wasAbove) episodes++;
      wasAbove = above;
    }
    return (episodes / (7 * 24)).toFixed(1);
  })();

  const severityAvgPeak = (() => {
    if (telemetryWithMag.length < 3) return '—';
    let peakSum = 0;
    let peakCount = 0;
    for (let i = 1; i < telemetryWithMag.length - 1; i++) {
      const prev = telemetryWithMag[i - 1].magnitude;
      const curr = telemetryWithMag[i].magnitude;
      const next = telemetryWithMag[i + 1].magnitude;
      if (curr > prev && curr > next) {
        peakSum += curr;
        peakCount++;
      }
    }
    return peakCount > 0 ? (peakSum / peakCount).toFixed(1) : '—';
  })();

  useEffect(() => {
    fetch('/api/profiles')
      .then(res => res.json())
      .then(profiles => {
        const found = profiles.find(p => String(p.id) === String(profileId));
        if (found) setProfile(found);
      });
  }, [profileId]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/profiles/${profileId}/telemetry`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load telemetry data');
        return res.json();
      })
      .then(data => { setTelemetry(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [profileId]);

  return (
    <div ref={dashboardRef} className="min-h-screen bg-gradient-to-b from-teal-50 to-blue-50 pb-24 font-['Inter',system-ui,sans-serif]">
      {/* Top Navigation Bar */}
      <nav className="bg-white/70 backdrop-blur-md shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <button className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors">
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </nav>

      {/* Header */}
      <header className="bg-white/70 backdrop-blur-md shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
              {profile ? profile.name.charAt(0) : 'U'}
            </div>
            <span className="font-semibold text-gray-900">
              Hi, {profile ? profile.name.split(' ')[0] : 'User'}
            </span>
          </div>
          <button className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors relative">
            <Bell className="w-5 h-5 text-gray-700" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
        <div className="px-6 pb-4">
          <p className="text-sm font-medium text-teal-700">Great job tracking your lunch! Data synced.</p>
          <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
      </header>

      <main className="px-4 sm:px-8 md:px-12 py-6 space-y-8 max-w-none mx-auto w-full">
        
        {/* Export Container: Wraps Chart & Metrics */}
        <div ref={exportRef} className={`space-y-8 p-4 -m-4 rounded-3xl ${isExporting ? 'bg-white' : 'bg-gradient-to-b from-teal-50 to-blue-50'}`}>
          {/* Chart Card */}
          <div className={`rounded-2xl p-5 shadow-sm border border-gray-100 ${isExporting ? 'bg-white' : 'bg-white/80 backdrop-blur-sm'}`}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Correction Frequency</h3>

            {loading && <p className="text-gray-500 text-sm mb-4">Loading telemetry...</p>}
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

            {!loading && !error && (
              <div className={`w-full ${isExporting ? (!exportRef.current ? 'h-[400px]' : '') : 'h-[400px] md:h-[500px]'}`} style={isExporting ? { width: exportRef.current?.offsetWidth || 800, height: 400 } : {}}>
                {isExporting ? (
                  <LineChart width={exportRef.current?.offsetWidth || 800} height={400} data={telemetry} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                    <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="recorded_at"
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      interval="preserveStartEnd"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={['dataMin - 5', 'dataMax + 5']}
                      allowDataOverflow
                      tickFormatter={(v) => `${v.toFixed(0)}°`}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      width={44}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v, name) => [`${Number(v).toFixed(2)}°`, name]}
                      labelFormatter={(v) => new Date(v).toLocaleString()}
                      contentStyle={{ fontSize: '0.8rem', border: '1px solid #e0e0e0', borderRadius: '8px' }}
                    />
                    <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="3 3" />
                    <Line
                      name="Roll (X-axis)"
                      type="monotone"
                      dataKey="roll"
                      stroke="#0D8ABC"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      name="Pitch (Y-axis)"
                      type="monotone"
                      dataKey="pitch"
                      stroke="#14B8A6"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </LineChart>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={telemetry} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                      <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="recorded_at"
                        tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })}
                        tick={{ fontSize: 11, fill: '#6B7280' }}
                        interval="preserveStartEnd"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={['dataMin - 5', 'dataMax + 5']}
                        allowDataOverflow
                        tickFormatter={(v) => `${v.toFixed(0)}°`}
                        tick={{ fontSize: 11, fill: '#6B7280' }}
                        width={44}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v, name) => [`${Number(v).toFixed(2)}°`, name]}
                        labelFormatter={(v) => new Date(v).toLocaleString()}
                        contentStyle={{ fontSize: '0.8rem', border: '1px solid #e0e0e0', borderRadius: '8px' }}
                      />
                      <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="3 3" />
                      <Line
                        name="Roll (X-axis)"
                        type="monotone"
                        dataKey="roll"
                        stroke="#0D8ABC"
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                      <Line
                        name="Pitch (Y-axis)"
                        type="monotone"
                        dataKey="pitch"
                        stroke="#14B8A6"
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>

          {/* Metrics Card */}
          <div className={`rounded-2xl p-5 shadow-sm border border-gray-100 ${isExporting ? 'bg-white' : 'bg-white/80 backdrop-blur-sm'}`}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Metrics Dashboard</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Avg Roll', avgRoll, (v) => v !== '—' ? `${v}°` : v],
                ['Avg Pitch', avgPitch, (v) => v !== '—' ? `${v}°` : v],
                ['Motion Freq.', tremorEpisodeRate, (v) => v !== '—' ? `${v}/hr` : v],
                ['Motion Activity', severityAvgPeak, (v) => v !== '—' ? `${v}° Peak` : v],
              ].map(([label, val, fmt]) => (
                <div key={label} className={`rounded-xl p-3 border border-teal-100/50 flex flex-col items-center justify-center ${isExporting ? 'bg-teal-50' : 'bg-teal-50/50'}`}>
                  <p className="text-[11px] text-teal-700/80 mb-1 font-medium">{label}</p>
                  <p className="font-semibold text-gray-900 text-lg leading-none">{fmt(val)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Share with Doctor */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Share with your doctor</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button className="py-4 px-4 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 active:scale-95 shadow-sm">
              <Share2 className="w-5 h-5" />
              Share
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="py-4 px-4 bg-white text-teal-600 border-2 border-teal-600 rounded-xl font-medium hover:bg-teal-50 transition-colors flex items-center justify-center gap-2 active:scale-95 shadow-sm disabled:opacity-50"
            >
              <FileDown className="w-5 h-5" />
              {isExporting ? 'Generating...' : 'Export PDF'}
            </button>
          </div>

          {/* Doctor Comments */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">
              Doctor notes on your shared reports
            </p>
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-1">Dr. Laura • 2 days ago</p>
              <p className="text-sm text-gray-700">
                I see your tremor was higher before your afternoon dose. Let's talk at your next visit.
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-2">(Not live chat)</p>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-md border-t border-gray-200 px-6 py-4 z-50">
        <div className="flex justify-around items-center max-w-md mx-auto">
          <NavButton icon={<Home />} label="Home" isActive onClick={() => navigate(0)} />
          <NavButton icon={<Dumbbell />} label="Exercises" onClick={() => navigate(`/profile/${profileId}/exercises`)} />
          <NavButton icon={<Mail />} label="Messages" onClick={() => navigate(`/profile/${profileId}/messages`)} />
          <NavButton icon={<User />} label="Profile" onClick={() => navigate(`/profile/${profileId}/settings`)} />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ icon, label, isActive = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-teal-600' : 'text-gray-500 hover:text-gray-700'
        }`}
    >
      <div className="w-6 h-6">{icon}</div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
