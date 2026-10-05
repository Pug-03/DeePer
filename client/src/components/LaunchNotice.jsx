import { useLaunch } from '../launch.js';
import Countdown from './Countdown.jsx';

// Quiet "not open yet" note with the launch countdown, shown under the
// sign-up and log-in forms. Renders nothing once launch time passes, so it
// just vanishes on its own with no trace and no deploy.
export default function LaunchNotice({ t }) {
  const { remaining } = useLaunch();
  if (!remaining) return null;
  return (
    <div className="launch-notice">
      <p className="launch-notice-text">{t('launch.notice')}</p>
      <Countdown remaining={remaining} t={t} className="countdown--small" />
    </div>
  );
}
