import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const CARD_STYLE = {
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '24px',
  background: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  marginBottom: '24px',
};

export default function Dashboard() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    <div style={{
      minHeight: '100vh',
      background: '#fff',
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
      padding: '40px',
    }}>
      <button
        onClick={() => navigate('/')}
        style={{ background: 'none', border: 'none', color: '#0D8ABC', cursor: 'pointer', marginBottom: '24px', fontSize: '0.9rem' }}
      >
        &larr; Back to profiles
      </button>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1a1a2e', marginBottom: '32px' }}>
        {profile ? profile.name : `Profile ${profileId}`}
      </h1>
      <div style={CARD_STYLE}>
        <p style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#666',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          margin: '0 0 16px 0',
        }}>
          Mechanical Deviation (Pitch & Roll) — Past 7 Days
        </p>
        {loading && (
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Loading data…</p>
        )}
        {error && (
          <p style={{ color: '#c62828', fontSize: '0.9rem' }}>{error}</p>
        )}
        {!loading && !error && (
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetry} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                <CartesianGrid vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="recorded_at"
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })}
                  tick={{ fontSize: 11, fill: '#666' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['dataMin - 5', 'dataMax + 5']}
                  allowDataOverflow
                  tickFormatter={(v) => `${v.toFixed(0)}°`}
                  tick={{ fontSize: 11, fill: '#666' }}
                  width={44}
                />
                <Tooltip
                  formatter={(v, name) => [`${Number(v).toFixed(2)}°`, name]}
                  labelFormatter={(v) => new Date(v).toLocaleString()}
                  contentStyle={{ fontSize: '0.8rem', border: '1px solid #e0e0e0' }}
                />
                <ReferenceLine y={0} stroke="#999" strokeWidth={1} strokeDasharray="3 3" />
                <Line
                  name="Roll (X-axis)"
                  type="monotone"
                  dataKey="roll"
                  stroke="#0D8ABC"
                  dot={false}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
                <Line
                  name="Pitch (Y-axis)"
                  type="monotone"
                  dataKey="pitch"
                  stroke="#2E7D32"
                  dot={false}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div style={CARD_STYLE}>
        <p style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#666',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          margin: '0 0 16px 0',
        }}>
          Metrics — Past 7 Days
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['Avg X-axis deviation (Roll)', avgRoll, (v) => v !== '—' ? `${v}°` : v],
              ['Avg Y-axis deviation (Pitch)', avgPitch, (v) => v !== '—' ? `${v}°` : v],
              ['Tremor frequency', tremorEpisodeRate, (v) => v !== '—' ? `${v} episodes/hr` : v],
              ['Severity', severityAvgPeak, (v) => v !== '—' ? `${v}° Avg Peak` : v],
            ].map(([label, val, fmt]) => (
              <tr key={label} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{
                  padding: '12px 0',
                  color: '#1a1a2e',
                  fontSize: '0.95rem',
                }}>
                  {label}
                </td>
                <td style={{
                  padding: '12px 0',
                  color: '#1a1a2e',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  textAlign: 'right',
                }}>
                  {fmt(val)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
