import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './store/auth.jsx';
import { TutorialProvider, useTutorial } from './store/tutorial.jsx';
import { ToastProvider, ConfirmProvider, Loading } from './components/ui.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import BottomNav from './components/BottomNav.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';

import Welcome from './pages/Welcome.jsx';
import Awards from './pages/Awards.jsx';
import AwardsNatsha from './pages/AwardsNatsha.jsx';
import Signup from './pages/Signup.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Home from './pages/Home.jsx';
import PostAuthWelcome from './pages/PostAuthWelcome.jsx';
import Answer from './pages/Answer.jsx';
import Saved from './pages/Saved.jsx';
import History from './pages/History.jsx';
import Profile from './pages/Profile.jsx';
import AccountSettings from './pages/AccountSettings.jsx';
import Support from './pages/Support.jsx';

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
  // Mounted here (a sibling of <Outlet/>, same as BottomNav) rather than
  // inside Home — TabLayout doesn't unmount when the tour navigates
  // Home -> Saved -> History, so the overlay and its progress survive the
  // tab switches instead of resetting.
  const tutorial = useTutorial();
  return (
    <>
      <Outlet />
      <BottomNav />
      {tutorial.active && <OnboardingTour />}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <TutorialProvider>
          <div className="app-shell">
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<GuestOnly><Welcome /></GuestOnly>} />
              {/* Public regardless of auth state — reachable from the
                  landing page's "Made by" section whether or not the
                  visitor is logged in. */}
              <Route path="/awards" element={<Awards />} />
              <Route path="/awards/natsha" element={<AwardsNatsha />} />
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
              <Route path="/app/profile/settings" element={<Protected><AccountSettings /></Protected>} />
              <Route path="/app/profile/support" element={<Protected><Support /></Protected>} />
              <Route path="/app/welcome" element={<Protected><PostAuthWelcome /></Protected>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </TutorialProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
