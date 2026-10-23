import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Loading from './Loading.jsx';
export default function ProtectedRoute({ admin = false }) { const { user, loading } = useAuth(); const location = useLocation(); if (loading) return <Loading />; if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />; if (admin && user.role !== 'admin') return <Navigate to="/app" replace />; return <Outlet />; }
