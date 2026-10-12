import { translateError } from '../i18n.js';
import { useI18n } from '../store/i18n.jsx';

// The red banner at the top of the login / signup / password-reset pages.
// Takes the request's Error itself (not its message) so a server error is
// re-worded when the visitor switches language with the banner showing;
// a plain string is shown as is.
export default function ErrorBanner({ err }) {
  const { lang } = useI18n();
  if (!err) return null;
  const text =
    typeof err === 'string' ? err : translateError(lang, err.data?.error_code, err.message);
  return <div className="err-inline">{text}</div>;
}
