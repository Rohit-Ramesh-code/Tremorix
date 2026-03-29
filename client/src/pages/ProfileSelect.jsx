import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Waves, BarChart3, Stethoscope, Activity } from 'lucide-react';

export default function ProfileSelect() {
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [targetId, setTargetId] = useState(1);

  // Pre-fetch the profile list to know where to route
  useEffect(() => {
    fetch('/api/profiles')
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) setTargetId(data[0].id);
      })
      .catch(err => console.error(err));
  }, []);

  const handleAction = () => {
    // Navigate straight to the first profile's real dashboard to see the synthetic data!
    navigate(`/profile/${targetId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-blue-50 flex flex-col">
      {/* Header */}
      <header className="px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-600 rounded-2xl flex items-center justify-center">
            <Waves className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tremorix</h1>
        </div>
      </header>

      <main className="flex-1 px-6 pb-8 flex flex-col">
        {/* Value Proposition */}
        <div className="text-center mt-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            A steady hand for your everyday meals.
          </h2>
          <p className="text-gray-700 max-w-md mx-auto font-[Anaheim] italic text-[20px]">
            Track tremor gently, share insights with your doctor, celebrate the small wins.
          </p>
        </div>

        {/* Hero Section with Animation */}
        <div className="flex-1 flex items-center justify-center my-8">
          <motion.div
            className="relative w-64 h-64"
            animate={{
              rotate: [0, -2, 2, -1, 1, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-blue-500 rounded-full opacity-20 blur-2xl"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="w-32 h-40 relative"
                animate={{
                  x: [-2, 2, -2],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {/* Spoon bowl */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-24 rounded-full border-4 border-gray-400 bg-[#e5ecf3d9]"></div>
                {/* Spoon handle */}
                <div className="absolute top-20 left-1/2 -translate-x-1/2 w-6 h-20 rounded-full border-4 border-gray-400 bg-[#f0f5feed]"></div>
                {/* Shine effect */}
                <div className="absolute top-4 left-1/2 -translate-x-1/4 w-8 h-12 bg-white/40 rounded-full blur-sm"></div>

                <motion.div
                  className="absolute -right-6 top-1/2 -translate-y-1/2"
                  animate={{
                    opacity: [0.4, 0.8, 0.4],
                    scale: [0.9, 1.1, 0.9],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Waves className="w-12 h-12 text-teal-500" />
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Key Benefits Row */}
        <div className="overflow-x-auto -mx-6 px-6 mb-8">
          <div className="flex gap-4 pb-2 justify-center flex-wrap">
            <BenefitCard
              title="Track tremor automatically"
              description="During meals, without extra effort"
              icon={<BarChart3 className="w-8 h-8" />}
            />
            <BenefitCard
              title="Share clear summaries"
              description="Help your doctor understand your patterns"
              icon={<Stethoscope className="w-8 h-8" />}
            />
            <BenefitCard
              title="Get gentle exercises"
              description="Positive feedback and helpful tips"
              icon={<Activity className="w-8 h-8" />}
            />
          </div>
        </div>

        {/* Call to Action */}
        <div className="space-y-4 max-w-md mx-auto w-full">
          <button
            onClick={handleAction}
            className="w-full bg-teal-600 text-white py-5 px-6 rounded-2xl text-lg font-semibold shadow-lg hover:bg-teal-700 transition-colors active:scale-[0.98]"
          >
            Get Started
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-white text-teal-700 py-5 px-6 rounded-2xl text-lg font-semibold border-2 border-teal-600 hover:bg-teal-50 transition-colors active:scale-[0.98]"
          >
            Log in
          </button>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 pt-2">
            <Lock className="w-4 h-4" />
            <span>You are in control of what you share.</span>
          </div>
        </div>

        {/* Footer Links */}
        <footer className="mt-8 flex justify-center gap-6 text-sm text-gray-600">
          <a href="#" className="hover:text-teal-600">Privacy & data use</a>
          <a href="#" className="hover:text-teal-600">For doctors</a>
          <a href="#" className="hover:text-teal-600">Support</a>
        </footer>
      </main>
    </div>
  );
}

function BenefitCard({ title, description, icon }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm min-w-[280px] border border-gray-100">
      <div className="text-teal-600 mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
