import { Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Documents from './pages/Documents.jsx';
import DocumentDetail from './pages/DocumentDetail.jsx';
import Scholarships from './pages/Scholarships.jsx';
import Assessments from './pages/Assessments.jsx';
import AssessmentDetail from './pages/AssessmentDetail.jsx';
import Profile from './pages/Profile.jsx';
import Admin from './pages/Admin.jsx';
import NotFound from './pages/NotFound.jsx';
export default function App() {
  return <Routes>
    <Route element={<PublicLayout />}><Route path="/" element={<Landing />} /><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /></Route>
    <Route element={<ProtectedRoute />}><Route path="/app" element={<AppLayout />}><Route index element={<Dashboard />} /><Route path="documents" element={<Documents />} /><Route path="documents/:id" element={<DocumentDetail />} /><Route path="scholarships" element={<Scholarships />} /><Route path="assessments" element={<Assessments />} /><Route path="assessments/:id" element={<AssessmentDetail />} /><Route path="profile" element={<Profile />} /><Route element={<ProtectedRoute admin />}><Route path="admin" element={<Admin />} /></Route></Route></Route>
    <Route path="*" element={<NotFound />} />
  </Routes>;
}
