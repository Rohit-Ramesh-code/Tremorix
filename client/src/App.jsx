import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProfileSelect from './pages/ProfileSelect';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProfileSelect />} />
        <Route path="/profile/:profileId" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
