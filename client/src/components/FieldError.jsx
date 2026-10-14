import { useI18n } from '../store/i18n.jsx';

// Message shown right under a form field that failed validation. The field
// itself takes invalidProps(...) so it turns red (aria-invalid) and is
// linked to this message for screen readers.
// `msg` may be an i18n key — then it's translated here, so it follows a
// language switch made while it's showing — or text that's shown as is
// (a key that isn't one comes back unchanged).
export default function FieldError({ id, msg }) {
  const { t } = useI18n();
  if (!msg) return null;
  return (
    <p className="field-err" id={id} role="alert">
      {t(msg)}
    </p>
  );
}

// Props for the input behind errors[field]; its message must render with
// id `pf-${field}-err`.
export function invalidProps(field, errors) {
  return errors[field] ? { 'aria-invalid': true, 'aria-describedby': `pf-${field}-err` } : {};
}
