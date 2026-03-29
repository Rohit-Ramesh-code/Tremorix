import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PatientList() {
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/profiles')
            .then(res => res.json())
            .then(data => {
                setProfiles(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-teal-50 to-blue-50 flex flex-col px-6">
            {/* Header */}
            <header className="py-6 flex items-center gap-4 mt-4 mb-4">
                <button
                    onClick={() => navigate('/login')}
                    className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Your Patients</h1>
                    <p className="text-sm text-gray-600">Select a profile to view history.</p>
                </div>
            </header>

            <main className="flex-1 max-w-md mx-auto w-full flex flex-col gap-4">
                {loading ? (
                    <div className="text-center text-teal-600 font-medium py-10">Fetching secure data...</div>
                ) : (
                    profiles.map(profile => (
                        <button
                            key={profile.id}
                            onClick={() => navigate(`/profile/${profile.id}`)}
                            className="bg-white p-6 rounded-2xl shadow-sm border-2 border-transparent hover:border-teal-400 flex items-center gap-6 transition-all active:scale-[0.98]"
                        >
                            <img
                                src={profile.avatar_url}
                                alt={profile.name}
                                className="w-16 h-16 rounded-full object-cover shadow-sm bg-teal-100"
                            />
                            <div className="text-left flex-1">
                                <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
                                <p className="text-sm text-teal-600 font-medium mt-1">View Timeline →</p>
                            </div>
                        </button>
                    ))
                )}
            </main>
        </div>
    );
}
