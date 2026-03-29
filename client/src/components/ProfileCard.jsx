import { useNavigate } from 'react-router-dom';

export default function ProfileCard({ profile }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/profile/${profile.id}`)}
      style={{
        cursor: 'pointer',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.15s ease',
        minWidth: '180px',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'}
    >
      <img
        src={profile.avatar_url}
        alt={profile.name}
        width={80}
        height={80}
        style={{ borderRadius: '50%' }}
        onError={e => { e.target.style.display = 'none'; }}
      />
      <span style={{ fontWeight: 600, fontSize: '1rem', color: '#1a1a2e' }}>
        {profile.name}
      </span>
    </div>
  );
}
