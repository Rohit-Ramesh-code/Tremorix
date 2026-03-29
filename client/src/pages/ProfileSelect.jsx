import { useState, useEffect } from 'react';
import ProfileCard from '../components/ProfileCard';

export default function ProfileSelect() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/profiles')
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setProfiles(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f7fa',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1a1a2e', marginBottom: '8px' }}>
        Tremorix
      </h1>
      <p style={{ color: '#666', marginBottom: '40px', fontSize: '0.95rem' }}>
        Select a profile to view tremor stabilization history
      </p>
      {loading && <p style={{ color: '#666' }}>Loading profiles...</p>}
      {error && <p style={{ color: '#c62828' }}>Error: {error}</p>}
      {!loading && !error && (
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {profiles.map(profile => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}
