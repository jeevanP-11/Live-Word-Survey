import { Navigate, Route, Routes } from 'react-router-dom';
import SurveyPage from './pages/SurveyPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import CreateSurvey from './pages/CreateSurvey';
import AdminSurveyDetail from './pages/AdminSurveyDetail';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/s/:slug" element={<SurveyPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/new" element={<CreateSurvey />} />
      <Route path="/admin/surveys/:id" element={<AdminSurveyDetail />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="font-mono text-mute">Page not found.</p>
    </div>
  );
}
