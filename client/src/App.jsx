import { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './store/auth.jsx';
import { TutorialProvider, useTutorial } from './store/tutorial.jsx';
import { ToastProvider, ConfirmProvider, Loading } from './components/ui.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import BottomNav from './components/BottomNav.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';

import { lazyPage, preloadPages } from './lazyPage.js';
// The landing page ships in the main bundle so first visits paint fast;
// every other page is its own chunk, fetched when first opened (and
// warmed up in the background once the landing page is idle).
import Welcome from './pages/Welcome.jsx';
// The four tabs stay in the main bundle too: the onboarding tour walks
// across them, and a tab suspending mid-tour reset the tour's step.
import Home from './pages/Home.jsx';
import Saved from './pages/Saved.jsx';
import History from './pages/History.jsx';
import Profile from './pages/Profile.jsx';
const Awards = lazyPage(() => import('./pages/Awards.jsx'));
const AwardsNatsha = lazyPage(() => import('./pages/AwardsNatsha.jsx'));
const Signup = lazyPage(() => import('./pages/Signup.jsx'));
const Login = lazyPage(() => import('./pages/Login.jsx'));
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword.jsx'));
const PostAuthWelcome = lazyPage(() => import('./pages/PostAuthWelcome.jsx'));
const Answer = lazyPage(() => import('./pages/Answer.jsx'));
const AccountSettings = lazyPage(() => import('./pages/AccountSettings.jsx'));
const LoginHistory = lazyPage(() => import('./pages/LoginHistory.jsx'));
const Support = lazyPage(() => import('./pages/Support.jsx'));
const Social = lazyPage(() => import('./pages/Social.jsx'));
const Review = lazyPage(() => import('./pages/Review.jsx'));
const Report = lazyPage(() => import('./pages/Report.jsx'));
// Owner-only, so never preloaded for visitors.
const Admin = lazyPage(() => import('./pages/Admin.jsx'), { preload: false });
const SponsorInquiry = lazyPage(() => import('./pages/SponsorInquiry.jsx'));
import VisitBeacon from './components/VisitBeacon.jsx';

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
  useEffect(preloadPages, []);
  return (
    <ToastProvider>
      <ConfirmProvider>
        <TutorialProvider>
          <div className="app-shell">
            <ScrollToTop />
            <VisitBeacon />
            <Suspense fallback={<Loading />}>
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
                {/* Open to guests and signed-in users alike. */}
                <Route path="/report" element={<Report />} />
                <Route path="/sponsor" element={<SponsorInquiry />} />
                {/* Owner-only back office with its own login, separate from user accounts. */}
                <Route path="/admin" element={<Admin />} />

                <Route path="/app" element={<Protected><TabLayout /></Protected>}>
                  <Route index element={<Navigate to="home" replace />} />
                  <Route path="home" element={<Home />} />
                  <Route path="saved" element={<Saved />} />
                  <Route path="history" element={<History />} />
                  <Route path="profile" element={<Profile />} />
                </Route>

                <Route path="/app/answer" element={<Protected><Answer /></Protected>} />
                <Route path="/app/profile/settings" element={<Protected><AccountSettings /></Protected>} />
                <Route path="/app/profile/login-history" element={<Protected><LoginHistory /></Protected>} />
                <Route path="/app/profile/support" element={<Protected><Support /></Protected>} />
                <Route path="/app/profile/social" element={<Protected><Social /></Protected>} />
                <Route path="/app/profile/review" element={<Protected><Review /></Protected>} />
                <Route path="/app/welcome" element={<Protected><PostAuthWelcome /></Protected>} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </TutorialProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
