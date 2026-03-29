import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetch('/api/profiles')
      .then(res => res.json())
      .then(profiles => {
        const found = profiles.find(p => String(p.id) === String(profileId));
        if (found) setProfile(found);
      });
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
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1a1a2e' }}>
        {profile ? profile.name : `Profile ${profileId}`}
      </h1>
      <p style={{ color: '#666', marginTop: '8px' }}>
        Dashboard coming in Phase 2
      </p>
    </div>
  );
}
