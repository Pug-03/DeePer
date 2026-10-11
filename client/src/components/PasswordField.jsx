import { useState } from 'react';
import { useI18n } from '../store/i18n.jsx';
import { IcEye, IcEyeOff } from './icons.jsx';

export default function PasswordField({
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete,
  required,
  autoFocus,
  children,
}) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  // A password being chosen (signup, change, reset) has to be typed by hand:
  // no copying it out, cutting, pasting or dropping text in — so the person
  // actually types it, twice where there's a confirm box. Logging in with an
  // existing password still allows paste.
  const handTyped = autoComplete === 'new-password';
  const block = (e) => e.preventDefault();
  const guard = handTyped ? { onCopy: block, onCut: block, onPaste: block, onDrop: block } : {};

  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="input-wrap">
        <input
          className="input"
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoFocus={autoFocus}
          {...guard}
        />
        <button
          type="button"
          className="input-eye"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? t('common.hidePassword') : t('common.showPassword')}
          tabIndex={-1}
        >
          {show ? <IcEyeOff size={20} /> : <IcEye size={20} />}
        </button>
      </div>
      {children}
    </div>
  );
}
