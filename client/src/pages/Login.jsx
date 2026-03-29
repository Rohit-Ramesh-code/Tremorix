import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Eye, EyeOff, User, Heart, Stethoscope } from 'lucide-react';

const roleInfo = {
    patient: "You'll see your own tremor trends and exercises",
    caregiver: "You'll see care recipient's data and help with tracking",
    doctor: "You'll see your patient list and shared reports",
};

export default function Login() {
    const navigate = useNavigate();
    const [role, setRole] = useState('patient');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [profiles, setProfiles] = useState([]);

    useEffect(() => {
        fetch('/api/profiles')
            .then(res => res.json())
            .then(data => setProfiles(data))
            .catch(err => console.error(err));
    }, []);

    const handleLogin = () => {
        setIsLoading(true);
        setTimeout(() => {
            if (role === 'patient') {
                // Find Alice's profile specifically, default to 1 if missing safely
                const alice = profiles.find(p => p.name.toLowerCase().includes('alice'));
                navigate(`/profile/${alice ? alice.id : 1}`);
            } else {
                // Caregiver or Doctor routes to the patient selection
                navigate('/patients');
            }
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-teal-50 to-blue-50 flex flex-col">
            {/* Header */}
            <header className="px-6 py-6 flex items-center gap-4">
                <button
                    onClick={() => navigate('/')}
                    className="w-10 h-10 flex items-center justify-center hover:bg-white rounded-full transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Welcome back</h1>
                    <p className="text-sm text-gray-600">Let's pick up where you left off.</p>
                </div>
            </header>

            <main className="flex-1 px-6 pb-8 flex flex-col max-w-md mx-auto w-full">
                {/* Login Form */}
                <div className="space-y-6 mb-8">
                    {/* Email/Phone Input */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                            Email or Phone
                        </label>
                        <input
                            type="text"
                            id="email"
                            className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 focus:border-teal-500 focus:outline-none text-base"
                            placeholder="you@example.com"
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 focus:border-teal-500 focus:outline-none text-base pr-14"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Role Selection */}
                <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        I am a...
                    </label>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                        <RoleButton
                            icon={<User />}
                            label="Patient"
                            sublabel="Use Tremorix"
                            isActive={role === 'patient'}
                            onClick={() => setRole('patient')}
                        />
                        <RoleButton
                            icon={<Heart />}
                            label="Caregiver"
                            sublabel="Care for someone"
                            isActive={role === 'caregiver'}
                            onClick={() => setRole('caregiver')}
                        />
                        <RoleButton
                            icon={<Stethoscope />}
                            label="Doctor"
                            sublabel="Clinician"
                            isActive={role === 'doctor'}
                            onClick={() => setRole('doctor')}
                        />
                    </div>
                    <p className="text-sm text-gray-600 text-center">{roleInfo[role]}</p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-4 mb-6">
                    <button
                        onClick={handleLogin}
                        disabled={isLoading}
                        className="w-full bg-teal-600 text-white py-5 px-6 rounded-2xl text-lg font-semibold shadow-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Securely signing you in...' : 'Log in'}
                    </button>

                    <div className="flex justify-center gap-6 text-sm">
                        <button className="text-teal-600 hover:text-teal-700 font-medium pb-4">
                            Create account
                        </button>
                        <button className="text-gray-600 hover:text-gray-700 font-medium pb-4">
                            Forgot password?
                        </button>
                    </div>
                </div>

                {/* Trust Message */}
                <div className="flex items-center justify-center gap-2 text-xs text-gray-600 pt-4 border-t border-gray-200">
                    <Lock className="w-4 h-4" />
                    <span>Your health data is encrypted and you choose who sees it.</span>
                </div>
            </main>
        </div>
    );
}

function RoleButton({ icon, label, sublabel, isActive, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${isActive
                ? 'bg-teal-50 border-teal-500 shadow-sm'
                : 'bg-white border-gray-200 hover:border-teal-300'
                }`}
        >
            <div className={`w-8 h-8 ${isActive ? 'text-teal-600' : 'text-gray-600'} flex items-center justify-center`}>
                {icon}
            </div>
            <div className="text-center w-full">
                <div className="text-sm font-semibold text-gray-900 leading-tight">{label}</div>
                <div className="text-[10px] text-gray-600 mt-1 leading-tight">{sublabel}</div>
            </div>
        </button>
    );
}
