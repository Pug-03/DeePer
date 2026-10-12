import { useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast, useConfirm } from '../components/ui.jsx';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from './avatar.js';
import { shrinkImage, AVATAR_SIDE } from './shrinkImage.js';

// Changing or removing your own profile photo — shared by Profile and the
// My-information page. Render a hidden file input with `inputRef` and
// `onFileChange`; `pick` opens it, `remove` asks first, then deletes.
export function useAvatarEdit() {
  const { setUser } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const pick = () => inputRef.current?.click();

  const onFileChange = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (!AVATAR_TYPES.includes(picked.type)) {
      toast(t('err.AVATAR_TYPE_INVALID'));
      return;
    }
    const file = await shrinkImage(picked, AVATAR_SIDE);
    if (file.size > AVATAR_MAX_BYTES) {
      toast(t('err.AVATAR_TOO_LARGE'));
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const d = await api.upload('/auth/me/avatar', form);
      setUser(d.user);
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({ message: t('confirm.avatarMsg') });
    if (!ok) return;
    setBusy(true);
    try {
      const d = await api.del('/auth/me/avatar');
      setUser(d.user);
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  return { busy, inputRef, pick, onFileChange, remove };
}
