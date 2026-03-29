import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProfileSelect from './pages/ProfileSelect';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import PatientList from './pages/PatientList';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProfileSelect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/patients" element={<PatientList />} />
        <Route path="/profile/:profileId" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
