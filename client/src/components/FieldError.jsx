// Message shown right under a form field that failed validation. The field
// itself takes invalidProps(...) so it turns red (aria-invalid) and is
// linked to this message for screen readers.
export default function FieldError({ id, msg }) {
  if (!msg) return null;
  return (
    <p className="field-err" id={id} role="alert">
      {msg}
    </p>
  );
}

// Props for the input behind errors[field]; its message must render with
// id `pf-${field}-err`.
export function invalidProps(field, errors) {
  return errors[field] ? { 'aria-invalid': true, 'aria-describedby': `pf-${field}-err` } : {};
}
