import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './store/auth.jsx';
import { ToastProvider, ConfirmProvider, Loading } from './components/ui.jsx';
import BottomNav from './components/BottomNav.jsx';

import Welcome from './pages/Welcome.jsx';
import Signup from './pages/Signup.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Home from './pages/Home.jsx';
import Answer from './pages/Answer.jsx';
import Saved from './pages/Saved.jsx';
import History from './pages/History.jsx';
import Profile from './pages/Profile.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to="/app/home" replace />;
  return children;
}

function TabLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<GuestOnly><Welcome /></GuestOnly>} />
            <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />

            <Route path="/app" element={<Protected><TabLayout /></Protected>}>
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<Home />} />
              <Route path="saved" element={<Saved />} />
              <Route path="history" element={<History />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            <Route path="/app/answer" element={<Protected><Answer /></Protected>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
