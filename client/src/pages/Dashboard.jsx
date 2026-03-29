import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
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

  const avgAngle = telemetry.length
    ? (telemetry.reduce((sum, r) => sum + r.correction_angle, 0) / telemetry.length).toFixed(1)
    : '—';

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
          Correction Angle — Past 7 Days
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
                  domain={[5, 130]}
                  allowDataOverflow
                  tickFormatter={(v) => `${v}°`}
                  tick={{ fontSize: 11, fill: '#666' }}
                  width={44}
                />
                <Tooltip
                  formatter={(v) => [`${Number(v).toFixed(1)}°`, 'Correction Angle']}
                  labelFormatter={(v) => new Date(v).toLocaleString()}
                  contentStyle={{ fontSize: '0.8rem', border: '1px solid #e0e0e0' }}
                />
                <Line
                  type="monotone"
                  dataKey="correction_angle"
                  stroke="#0D8ABC"
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
          Averages — Past 7 Days
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['Avg X-axis deviation', avgAngle],
              ['Avg Y-axis deviation', avgAngle],
            ].map(([label, val]) => (
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
                  {val !== '—' ? `${val}°` : val}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
