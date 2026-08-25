import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  animate,
} from 'framer-motion';
import { api } from '../api.js';
import { useI18n } from '../store/i18n.jsx';
import { useToast, useConfirm } from '../components/ui.jsx';
import { Loading, ErrorState, EmptyState } from '../components/ui.jsx';
import {
  IcX,
  IcCheck,
  IcBookmark,
  IcPlus,
  IcCards,
  IcSparkle,
  IcChat,
  IcShare,
  IcDownload,
} from '../components/icons.jsx';
import HomeTutorial from '../components/HomeTutorial.jsx';
import { catLabel, CATS } from '../util.js';
import { renderShareCard, downloadBlob } from '../utils/shareCard.js';

// Web Share API only exists on (most) mobile browsers — desktop gets just the
// "save to device" option in the sheet instead of a share button that can't
// do anything there.
const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

const SWIPE_THRESHOLD = 110;
const CARD_SPRING = { type: 'spring', stiffness: 420, damping: 22, mass: 0.9 };
const FLY_EASE = [0.16, 1, 0.3, 1];
// How long the skip/answer fly-out animation takes, and how long to wait
// before actually advancing — kept at roughly the same ~2/3 ratio as
// before so the card is safely off-screen (not just started moving) by
// the time it unmounts.
const FLY_DURATION = 0.9;
const FLY_UNMOUNT_DELAY = 600;
// The outgoing card's slide is a spring (bouncy, exact), but its fade should
// feel soft rather than snap to the spring's precision — ease it out on its
// own timing instead of tying opacity to the same physics as the slide.
const CARD_EXIT_TRANSITION = { ...CARD_SPRING, opacity: { duration: 0.32, ease: FLY_EASE } };
// Matches the resting look of the "next" preview card behind the deck
// (see backScale/backY/backOpacity below) so promoting it to the top card
// reads as a continuous rise instead of an instant pop into place.
const REST_BEHIND = { scale: 0.94, y: 14, opacity: 0.6 };
const CARD_REST = { x: '0%', scale: 1, y: 0, opacity: 1 };
const RISE_SPRING = { type: 'spring', stiffness: 380, damping: 28, mass: 0.8 };

// A second tap within this window counts as a double-tap; slow enough for a
// deliberate double-tap, tight enough that two separate taps don't merge.
const DOUBLE_TAP_MS = 300;
// How long a press has to hold still before it counts as "press and hold to
// share" rather than the start of a swipe or a tap.
const LONG_PRESS_MS = 550;
// How far the pointer can drift during that hold before it's treated as the
// start of a real swipe instead of jitter. A trackpad click (unlike a touch)
// physically depresses under finger pressure, which nudges the cursor a few
// pixels — framer-motion's drag gesture picks that up as movement, so without
// this tolerance onDragStart cancels the long-press timer almost instantly
// and press-and-hold-to-share never fires at all on a MacBook trackpad.
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

function TopCard({ q, onSkip, onAnswer, onSave, onDragProgress, onFlyProgress, flyRegistry, saved, seamless }) {
  const { t } = useI18n();
  const toast = useToast();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const noOp = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const yesOp = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);

  // Double-tap-to-save, mirroring the "double-tap to like" gesture from
  // photo/video feeds — here it saves the question instead. onTap (rather
  // than onClick) is framer-motion's tap gesture, so it only fires for a
  // real tap and not at the end of a drag/swipe. The confirmation itself
  // (blur + saved icon) is driven by the `saved` prop from Home, so it
  // looks the same whether triggered by a double-tap, the save button, or
  // the keyboard shortcut.
  const lastTap = useRef(0);
  // Framer's onTap still fires on the pointer-up that ends a long-press (it
  // only cares about position, not hold duration) — set whenever the share
  // gesture fires, so the very next tap is swallowed instead of being read
  // as one half of a double-tap-to-save.
  const longPressFired = useRef(false);
  const handleTap = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      onSave?.();
    } else {
      lastTap.current = now;
    }
  };

  // Press-and-hold to share, mirroring how Instagram/TikTok posts long-press
  // for actions beyond a tap. A plain setTimeout armed on pointerdown and
  // disarmed on pointerup/cancel/leave — and, importantly, on the drag
  // actually starting, so beginning a real swipe never fires it: the timer
  // alone can't tell a held-still finger from the first instant of a drag.
  //
  // The hold itself only renders the image and opens a sheet with explicit
  // choices (share to another app / save to device) — it doesn't fire
  // navigator.share() directly. A website can't deep-link straight into one
  // specific app (Instagram, LINE, ...) with a file; the OS share sheet is
  // the only thing that can actually hand the image to them, and only in
  // response to a real click on that sheet's own button, which is also a
  // safer bet for browsers that require a direct user gesture to allow it.
  const pressTimer = useRef(null);
  const pressStart = useRef({ x: 0, y: 0 });
  const [sharing, setSharing] = useState(false);
  const [shareFlash, setShareFlash] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBlob, setShareBlob] = useState(null);
  const [sharePreviewUrl, setSharePreviewUrl] = useState('');
  // Mirrors sharePreviewUrl so the unmount-cleanup effect below (which only
  // runs once, with an empty dependency array) can always revoke whichever
  // URL is actually live at that point — reading the state value directly
  // there would close over its value from the very first render instead.
  const sharePreviewUrlRef = useRef('');

  const clearPressTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const startPressTimer = (e) => {
    pressStart.current = { x: e.clientX, y: e.clientY };
    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      openShareSheet();
    }, LONG_PRESS_MS);
  };
  const handlePressMove = (e) => {
    if (!pressTimer.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) clearPressTimer();
  };
  const openShareSheet = async () => {
    if (sharing) return;
    longPressFired.current = true;
    navigator.vibrate?.(15);
    setSharing(true);
    try {
      const blob = await renderShareCard({ text: q.text, categoryLabel: catLabel(q.category) });
      if (!blob) throw new Error('render failed');
      if (sharePreviewUrlRef.current) URL.revokeObjectURL(sharePreviewUrlRef.current);
      const url = URL.createObjectURL(blob);
      sharePreviewUrlRef.current = url;
      setSharePreviewUrl(url);
      setShareBlob(blob);
      setShareOpen(true);
    } catch {
      toast(t('home.shareFailed'));
    } finally {
      setSharing(false);
    }
  };
  const closeShareSheet = () => {
    setShareOpen(false);
    if (sharePreviewUrlRef.current) {
      URL.revokeObjectURL(sharePreviewUrlRef.current);
      sharePreviewUrlRef.current = '';
    }
    setSharePreviewUrl('');
    setShareBlob(null);
  };
  const shareToApps = async () => {
    if (!shareBlob) return;
    try {
      const file = new File([shareBlob], 'deeper-question.png', { type: 'image/png' });
      const shareData = { files: [file], title: 'DeePer', text: t('home.shareCaption') };
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        // Falls back to a link-only share when the browser supports
        // navigator.share but not attaching files.
        await navigator.share({ title: 'DeePer', text: t('home.shareCaption'), url: window.location.origin });
      }
      setShareFlash(true);
      setTimeout(() => setShareFlash(false), 900);
    } catch (e) {
      if (e?.name !== 'AbortError') toast(t('home.shareFailed'));
    } finally {
      closeShareSheet();
    }
  };
  const saveToDevice = async () => {
    if (!shareBlob) return;
    // On iOS/Android, an <a download> blob link never reaches the Photos
    // library — Safari in particular just drops it in Files as a generic
    // file, which is exactly the "downloads but as a file, not a photo"
    // complaint this replaced. The OS share sheet's own "Save Image" entry
    // is the only thing on those platforms that actually writes a real photo
    // to the camera roll, so route through navigator.share first and only
    // fall back to the blob-download link where file sharing isn't there at
    // all (desktop), where a plain download is the normal, expected outcome.
    const file = new File([shareBlob], 'deeper-question.png', { type: 'image/png' });
    if (canShareFiles && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        setShareFlash(true);
        setTimeout(() => setShareFlash(false), 900);
      } catch (e) {
        if (e?.name !== 'AbortError') toast(t('home.shareFailed'));
      } finally {
        closeShareSheet();
      }
      return;
    }
    downloadBlob(shareBlob, 'deeper-question.png');
    toast(t('home.shareSaved'));
    closeShareSheet();
  };
  // If the card unmounts mid-hold (or with the sheet still open — e.g. a
  // keyboard shortcut fires skip/answer), don't leave a pending timer or a
  // dangling object URL behind.
  useEffect(
    () => () => {
      clearPressTimer();
      if (sharePreviewUrlRef.current) URL.revokeObjectURL(sharePreviewUrlRef.current);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Mirror this card's live drag offset up to the deck so the card behind it
  // can rise/scale in sync. A fresh TopCard always starts at rest, so reset
  // the mirrored value on mount rather than trusting the outgoing card's
  // in-flight fly-out animation to have finished settling it.
  const flying = useRef(false);
  useLayoutEffect(() => {
    flying.current = false;
    onDragProgress?.(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useMotionValueEvent(x, 'change', (v) => {
    if (!flying.current) onDragProgress?.(v);
  });

  const fly = (dir) => {
    // Stop following x — from here the card behind's reveal replays as its
    // own fixed animation (see onFlyProgress in DeckStack) instead of
    // continuing to mirror wherever the drag left it, so a swipe and a
    // button tap both play the exact same reveal.
    flying.current = true;
    onFlyProgress?.();
    if (dir === 'skip') {
      animate(y, 600, { duration: FLY_DURATION, ease: FLY_EASE });
      animate(x, -80, { duration: FLY_DURATION, ease: FLY_EASE });
      setTimeout(onSkip, FLY_UNMOUNT_DELAY);
    } else {
      animate(x, 520, { duration: FLY_DURATION, ease: FLY_EASE });
      animate(y, -20, { duration: FLY_DURATION, ease: FLY_EASE });
      setTimeout(onAnswer, FLY_UNMOUNT_DELAY);
    }
  };

  // Lets the parent's action buttons (and keyboard shortcuts) trigger the
  // same fly animation as a swipe. Re-registers every render so it's always
  // this card's latest fly closure — guarded by q.id so a still-exiting
  // card's delayed cleanup can never clobber a newer card's registration
  // (AnimatePresence keeps the outgoing card mounted for its exit animation,
  // so both can briefly coexist).
  useEffect(() => {
    flyRegistry.current = { id: q.id, fly };
    return () => {
      if (flyRegistry.current?.id === q.id) flyRegistry.current = null;
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const onDragEnd = (_e, info) => {
    if (info.offset.x < -SWIPE_THRESHOLD) fly('skip');
    else if (info.offset.x > SWIPE_THRESHOLD) fly('yes');
    else {
      animate(x, 0, { type: 'spring', stiffness: 320, damping: 26 });
      animate(y, 0, { type: 'spring', stiffness: 320, damping: 26 });
    }
  };

  const srcLabel =
    q.source === 'ai' ? t('home.srcAi') : q.source === 'user' ? t('home.srcUser') : 'DeePer';

  return (
    <>
      <motion.div
        className="qcard glass"
        style={{ x, y, rotate }}
        drag
        dragElastic={0.7}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        onDragEnd={onDragEnd}
        onTap={handleTap}
        onPointerDown={startPressTimer}
        onPointerMove={handlePressMove}
        onPointerUp={clearPressTimer}
        onPointerCancel={clearPressTimer}
        onPointerLeave={clearPressTimer}
        whileTap={{ scale: 0.985, cursor: 'grabbing' }}
      >
        {/* The red border/glow used to be a static class, so it snapped in
            instantly the moment a new card became top. When this promotion is
            seamless, the preview card behind already faded its own glow in
            during the reveal (see backGlow in DeckStack) — starting this one
            over from 0 would flash it off and re-fade, undoing that. Only
            category-switch/first-load mounts (not seamless, no preview to
            hand off from) get their own fresh 0.45s fade-in. */}
        <motion.div
          className="qcard-glow"
          initial={{ opacity: seamless ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: seamless ? 0 : 0.45, ease: FLY_EASE }}
        />
        <span className="q-source">{srcLabel}</span>
        <motion.span
          className="swipe-hint"
          style={{ opacity: noOp, color: '#fff', left: 22, right: 'auto' }}
        >
          <IcX size={34} sw={3} />
        </motion.span>
        <motion.span className="swipe-hint" style={{ opacity: yesOp, color: 'var(--green)' }}>
          <IcCheck size={34} sw={3} />
        </motion.span>
        <p className="q-text">{q.text}</p>
        {saved && (
          // Plain conditional mount, not a framer-motion opacity tween — animating
          // opacity on an element with backdrop-filter makes the browser
          // recompute the blur every frame, which showed up as the text behind
          // it flickering during the fade-in. A straight show/hide has no such
          // per-frame recompute.
          <div className="card-saved-overlay">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
            >
              <IcBookmark size={64} />
            </motion.div>
          </div>
        )}
        {shareFlash && (
          <div className="card-share-overlay">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
            >
              <IcShare size={64} />
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Portaled to <body>: the card above is transformed (x/y/rotate via
          drag), which would make a position:fixed sheet nested inside it
          anchor to the card's own box instead of the viewport. */}
      {createPortal(
        <AnimatePresence>
          {shareOpen && (
            <motion.div
              className="share-sheet-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeShareSheet}
            >
              <motion.div
                className="share-sheet glass glass--red"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
              >
                {sharePreviewUrl && <img className="share-sheet-preview" src={sharePreviewUrl} alt="" />}
                <p className="share-sheet-hint">{t('home.shareLongPressHint')}</p>
                <p className="share-sheet-title">{t('home.shareSheetTitle')}</p>

                {canShareFiles && (
                  <button type="button" className="share-sheet-btn" onClick={shareToApps}>
                    <span className="share-sheet-btn-ic">
                      <IcShare size={22} />
                    </span>
                    <span className="share-sheet-btn-text">
                      <span className="share-sheet-btn-label">{t('home.shareToApps')}</span>
                      <span className="share-sheet-btn-sub">{t('home.shareToAppsSub')}</span>
                    </span>
                  </button>
                )}
                <button type="button" className="share-sheet-btn" onClick={saveToDevice}>
                  <span className="share-sheet-btn-ic">
                    <IcDownload size={22} />
                  </span>
                  <span className="share-sheet-btn-text">
                    <span className="share-sheet-btn-label">{t('home.saveToDevice')}</span>
                    <span className="share-sheet-btn-sub">
                      {t(canShareFiles ? 'home.saveToDeviceSubShare' : 'home.saveToDeviceSub')}
                    </span>
                  </span>
                </button>

                <button type="button" className="btn btn--ghost share-sheet-cancel" onClick={closeShareSheet}>
                  {t('common.cancel')}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function DeckStack({ current, next, onSkip, onAnswer, onSave, enterDir, flyRegistry, saved }) {
  // Split in two: `progress` drives scale, `reveal` drives y/opacity. During
  // a real drag both track the finger together, same as one value would.
  // But animating scale on a backdrop-filter card forces the browser to
  // resample the blur at every intermediate size — genuinely expensive, and
  // visibly janky once it runs for the fly/save duration instead of a single
  // per-frame drag update. y/opacity don't have that cost, so on a
  // button/keyboard-triggered fly or save (no drag to follow), only `reveal`
  // eases smoothly; `progress` jumps straight to its end value.
  const progress = useMotionValue(0);
  const reveal = useMotionValue(0);
  const backScale = useTransform(progress, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [1, 0.94, 1]);
  const backY = useTransform(reveal, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [0, 14, 0]);
  const backOpacity = useTransform(reveal, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [1, 0.6, 1]);
  // The preview card behind is plain (no red glow) at rest, so fading its
  // glow in from fully-hidden as it rises — same `reveal` value, same
  // timing — is what actually reads as "the red edge gradually appears"
  // during the swipe/save reveal, instead of it only showing up later once
  // the card is formally promoted.
  const backGlow = useTransform(reveal, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [1, 0, 1]);

  useEffect(() => {
    if (saved) {
      progress.set(SWIPE_THRESHOLD);
      animate(reveal, SWIPE_THRESHOLD, { duration: 0.4, ease: FLY_EASE });
    }
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  // If the outgoing card actually flew away (a real swipe) or the save-flash
  // effect above already eased it up, the card behind has already risen to
  // CARD_REST by now via the mirrored progress above — mount it there
  // directly instead of replaying the rise, so the swap reads as one
  // continuous motion rather than a shrink back to REST_BEHIND and regrow.
  const seamless = !enterDir && Math.abs(progress.get()) >= SWIPE_THRESHOLD;

  return (
    <div className="deck" data-tut="deck">
      {next && (
        // Outer wrapper fades in once on mount (opacity multiplies with the
        // inner style-bound one below). Delayed to start only once the
        // current card's own rise (RISE_SPRING, settles in ~0.3s) has
        // essentially finished — fading it in from t=0 still overlapped
        // visually with that rise the whole time, which read as the same
        // flash even smoothed out. Starting after avoids any window where
        // both cards are visible together. Since this only plays on mount
        // (not on every re-render), swipe-driven updates aren't affected.
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.32, ease: FLY_EASE }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <motion.div className="qcard glass" style={{ scale: backScale, y: backY, opacity: backOpacity }}>
            <motion.div className="qcard-glow" style={{ opacity: backGlow }} />
            <p className="q-text" style={{ opacity: 0.5 }}>
              {next.text}
            </p>
          </motion.div>
        </motion.div>
      )}
      <AnimatePresence initial={false}>
        <motion.div
          key={current.id}
          initial={enterDir ? { x: `${-enterDir * 100}%` } : seamless ? CARD_REST : REST_BEHIND}
          animate={CARD_REST}
          // Swipes fly the card off-canvas via its own motion values before
          // this unmounts, so this fallback exit never actually shows for
          // them — it only matters for the save path, where the card is
          // still sitting in place (behind its blur overlay) when it's
          // removed. Without it the card behind popped straight to
          // CARD_REST the instant the outgoing one vanished, no crossfade.
          exit={
            enterDir
              ? { x: `${enterDir * 100}%`, opacity: 0 }
              : { opacity: 0, scale: 0.94, transition: { duration: 0.2, ease: FLY_EASE } }
          }
          transition={enterDir ? CARD_EXIT_TRANSITION : seamless ? { duration: 0 } : RISE_SPRING}
          style={{ position: 'absolute', inset: 0 }}
        >
          <TopCard
            q={current}
            onSkip={onSkip}
            onAnswer={onAnswer}
            onSave={onSave}
            onDragProgress={(v) => {
              progress.set(v);
              reveal.set(v);
            }}
            onFlyProgress={() => {
              // Reset first: a real drag may have already carried `reveal`
              // partway (or all the way, elastic-damped) toward the
              // threshold, so animating from wherever it happened to be
              // made the reveal's visible length depend on how far the
              // user had dragged — sometimes a full smooth rise, sometimes
              // already there and invisible. Restarting from 0 makes every
              // fly (swipe or button) play the identical reveal.
              // Also: this has to finish by FLY_UNMOUNT_DELAY, not
              // FLY_DURATION — the real TopCard takes over (fully revealed,
              // instantly, since seamless) the moment onSkip/onAnswer fires
              // at FLY_UNMOUNT_DELAY, which is well before the front card's
              // own FLY_DURATION fly-out completes. Using FLY_DURATION here
              // left this only 2/3 done at that handoff, so it visibly
              // jumped the rest of the way the instant the real card
              // mounted — reads as "rises for a bit, then snaps".
              progress.set(SWIPE_THRESHOLD);
              reveal.set(0);
              animate(reveal, SWIPE_THRESHOLD, { duration: FLY_UNMOUNT_DELAY / 1000, ease: FLY_EASE });
            }}
            flyRegistry={flyRegistry}
            saved={saved}
            seamless={seamless}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Elastic "liquid" tab indicator: instead of one spring animating the whole
// pill box, the edge in the direction of travel races ahead on a snappy
// spring while the trailing edge lags on a much softer one. That asymmetry
// is what makes the capsule visibly stretch across whatever it's passing
// over before catching up and snapping to width at the target, the same
// feel as iOS/Instagram segmented-control tab bars — a plain shared-layout
// spring moves the box as a rigid unit and never produces that stretch.
function CatTabs({ category, onSwitch }) {
  const { t } = useI18n();
  const rowRef = useRef(null);
  const pillRefs = useRef({});
  const mountedRef = useRef(false);
  const leftX = useMotionValue(0);
  const rightX = useMotionValue(0);
  const width = useTransform([leftX, rightX], ([l, r]) => Math.max(r - l, 0));

  const moveTo = (cat, animated) => {
    const rowEl = rowRef.current;
    const pillEl = pillRefs.current[cat];
    if (!rowEl || !pillEl) return;
    const rowRect = rowEl.getBoundingClientRect();
    const pillRect = pillEl.getBoundingClientRect();
    const targetLeft = pillRect.left - rowRect.left;
    const targetRight = pillRect.right - rowRect.left;
    if (!animated) {
      leftX.set(targetLeft);
      rightX.set(targetRight);
      return;
    }
    const movingRight = targetLeft > leftX.get();
    const LEAD = { type: 'spring', stiffness: 700, damping: 40, mass: 0.6 };
    const LAG = { type: 'spring', stiffness: 170, damping: 26, mass: 1 };
    animate(leftX, targetLeft, movingRight ? LAG : LEAD);
    animate(rightX, targetRight, movingRight ? LEAD : LAG);
  };

  useLayoutEffect(() => {
    moveTo(category, false);
    mountedRef.current = true;
    // Pill widths depend on the webfont, which can still be loading at
    // first paint — snap (no animation) to the correct spot once it's in,
    // otherwise the indicator can start from a slightly wrong position.
    const reposition = () => moveTo(category, false);
    window.addEventListener('resize', reposition);
    document.fonts?.ready?.then(reposition);
    return () => window.removeEventListener('resize', reposition);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mountedRef.current) moveTo(category, true);
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Press-and-drag across the pill row, not just tap-per-pill — pointer
  // capture keeps targeting the pill the press started on, so this looks
  // up whatever's actually under the finger by coordinate instead of
  // trusting the event's own target.
  const dragSwitch = (clientX, clientY) => {
    const pillEl = document.elementFromPoint(clientX, clientY)?.closest('[data-cat]');
    if (pillEl) onSwitch(pillEl.dataset.cat);
  };

  return (
    <div
      className="cat-row"
      data-tut="cats"
      style={{ marginBottom: 6 }}
      ref={rowRef}
      onPointerDown={(e) => dragSwitch(e.clientX, e.clientY)}
      onPointerMove={(e) => e.buttons === 1 && dragSwitch(e.clientX, e.clientY)}
    >
      <motion.span className="pill-bg pill-bg--elastic" style={{ left: leftX, width }} />
      {CATS.map((c) => {
        const isActive = category === c;
        return (
          <button
            key={c}
            ref={(el) => (pillRefs.current[c] = el)}
            data-cat={c}
            className={`pill ${isActive ? 'active' : ''}`}
            onClick={() => onSwitch(c)}
          >
            <motion.span
              key={isActive ? 'on' : 'off'}
              className="pill-label"
              initial={isActive ? { scale: 0.82 } : false}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 14 }}
            >
              {t(`cat.${c}`)}
            </motion.span>
          </button>
        );
      })}
    </div>
  );
}

export default function Home() {
  const nav = useNavigate();
  const toast = useToast();
  const confirmDlg = useConfirm();
  const { t } = useI18n();

  const [category, setCategory] = useState(() => localStorage.getItem('dt_cat') || 'couple');
  const [deck, setDeck] = useState([]);
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ready | error | empty
  const [error, setError] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newQ, setNewQ] = useState('');
  const [addCat, setAddCat] = useState(() => localStorage.getItem('dt_cat') || 'couple');
  const [showTutorial, setShowTutorial] = useState(
    () => localStorage.getItem('dt_tutorial_pending') === '1',
  );
  const [enterDir, setEnterDir] = useState(0);
  const [saveFlash, setSaveFlash] = useState(false);
  const seen = useRef(new Set());
  const firstLoad = useRef(true);
  const flyRegistry = useRef(null);

  const fetchBatch = useCallback(async (cat, { reset = false, silent = false } = {}) => {
    try {
      if (reset) {
        seen.current = new Set();
        if (!silent) setStatus('loading');
      }
      const exclude = [...seen.current].join(',');
      const d = await api.get(`/questions/?category=${cat}&limit=20&exclude=${exclude}`);
      setAiEnabled(d.ai_enabled);
      const fresh = d.questions.filter((q) => !seen.current.has(q.id));
      fresh.forEach((q) => seen.current.add(q.id));
      setDeck((prev) => (reset ? fresh : [...prev, ...fresh]));
      if (reset) {
        setIdx(0);
        setStatus(fresh.length ? 'ready' : 'empty');
      }
      return fresh.length;
    } catch (e) {
      setError(e.message);
      setStatus('error');
      return 0;
    }
  }, []);

  useEffect(() => {
    fetchBatch(category, { reset: true, silent: !firstLoad.current });
    firstLoad.current = false;
  }, [category, fetchBatch]);

  const current = deck[idx];
  const remaining = deck.length - idx;

  // enterDir only needs to drive the one card-slide transition right after a
  // category switch — clear it once that card has been rendered so normal
  // swipe-driven advances go back to their plain (non-sliding) transition.
  useEffect(() => {
    if (enterDir !== 0) setEnterDir(0);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === 'ready' && remaining > 0 && remaining <= 4) {
      fetchBatch(category);
    }
    if (status === 'ready' && remaining === 0) {
      setStatus('empty');
    }
  }, [remaining, status, category, fetchBatch]);

  const switchCat = (v) => {
    if (v === category) return;
    setEnterDir(CATS.indexOf(v) > CATS.indexOf(category) ? 1 : -1);
    localStorage.setItem('dt_cat', v);
    setCategory(v);
  };

  const advance = useCallback(() => setIdx((i) => i + 1), []);
  const doSkip = () => {
    if (flyRegistry.current?.id === current?.id) flyRegistry.current.fly('skip');
  };
  const doAnswer = () => {
    if (flyRegistry.current?.id === current?.id) flyRegistry.current.fly('yes');
  };

  const goAnswer = () => {
    if (!current) return;
    nav('/app/answer', { state: { question: { text: current.text, category } } });
  };

  // Confirmation is a blur-and-icon flash on the card itself instead of a
  // toast: blur it in, hold briefly so the icon reads, then advance past it.
  const SAVE_FLASH_MS = 520;
  const save = async () => {
    if (!current || saveFlash) return;
    try {
      await api.post('/saved', { question_text: current.text, category });
      setSaveFlash(true);
      setTimeout(() => {
        setSaveFlash(false);
        advance();
      }, SAVE_FLASH_MS);
    } catch (e) {
      toast(e.message);
    }
  };

  // Desktop keyboard shortcuts for the card deck: ←/→ mirror the swipe
  // gestures (skip/answer), ↑ mirrors the save button. Kept in a ref so the
  // listener is attached once instead of re-subscribing on every render.
  const keyStateRef = useRef();
  keyStateRef.current = { status, current, showTutorial, doSkip, doAnswer, save };
  useEffect(() => {
    const onKeyDown = (e) => {
      const { status, current, showTutorial, doSkip, doAnswer, save } = keyStateRef.current;
      if (status !== 'ready' || !current || showTutorial) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        doSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        doAnswer();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const generateAi = async () => {
    setGenerating(true);
    try {
      const d = await api.post('/questions/generate', { category, count: 6 });
      const fresh = d.questions.filter((q) => !seen.current.has(q.id));
      fresh.forEach((q) => seen.current.add(q.id));
      setDeck((prev) => [...prev, ...fresh]);
      setStatus('ready');
      toast(
        <>
          <IcSparkle size={16} /> {t('home.aiDone')}
        </>,
      );
    } catch (e) {
      toast(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const addOwn = async (e) => {
    e.preventDefault();
    const text = newQ.trim();
    if (text.length < 3) return;
    try {
      const d = await api.post('/questions', { category: addCat, text });
      setNewQ('');
      setAdding(false);
      // No more swiping to reach a just-typed question: ask straight away
      // whether to jump into answering it now, or park it in Saved (the
      // existing "answer it later" list) instead.
      const answerNow = await confirmDlg({
        icon: <IcChat size={36} />,
        title: t('home.addedTitle'),
        message: t('home.addedMsg'),
        confirmText: t('home.answerNow'),
        cancelText: t('home.saveForLater'),
        danger: false,
      });
      if (answerNow) {
        nav('/app/answer', {
          state: { question: { text: d.question.text, category: d.question.category } },
        });
      } else {
        await api.post('/saved', { question_text: d.question.text, category: d.question.category });
        toast(
          <>
            <IcBookmark size={16} /> {t('home.savedForLater')}
          </>,
        );
      }
    } catch (e2) {
      toast(e2.message);
    }
  };

  return (
    <>
      <div className="page page--tab stagger">
        <div className="row-between" style={{ marginBottom: 16 }}>
          <div className="brand-mark">
            <span className="dot" />
            <span style={{ fontSize: 22, fontWeight: 700 }}>DeePer</span>
          </div>
          <button
            className="btn btn--sm btn--ghost"
            data-tut="add"
            onClick={() =>
              setAdding((a) => {
                const next = !a;
                if (next) setAddCat(category);
                return next;
              })
            }
          >
            <IcPlus size={18} /> {t('home.addQuestion')}
          </button>
        </div>

        <CatTabs category={category} onSwitch={switchCat} />

        {adding && (
          <form className="glass fade-up" style={{ padding: 14, margin: '14px 0' }} onSubmit={addOwn}>
            <div className="field">
              <label>{t('home.addCatLabel')}</label>
              <select className="select" value={addCat} onChange={(e) => setAddCat(e.target.value)}>
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {t(`cat.${c}`)}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="textarea"
              style={{ minHeight: 80 }}
              placeholder={t('home.addPh')}
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              maxLength={200}
            />
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn--primary btn--sm" disabled={newQ.trim().length < 3}>
                {t('home.add')}
              </button>
            </div>
          </form>
        )}

        {status === 'loading' && <Loading label={t('home.loading')} />}

        {status === 'error' && (
          <ErrorState message={error} onRetry={() => fetchBatch(category, { reset: true })} />
        )}

        {status === 'empty' && (
          <EmptyState
            icon={<IcCards size={44} />}
            title={t('home.emptyTitle')}
            subtitle={aiEnabled ? t('home.emptySubAi') : t('home.emptySub')}
            action={
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => fetchBatch(category, { reset: true })}
                >
                  {t('home.restart')}
                </button>
                {aiEnabled && (
                  <button className="btn btn--primary btn--sm" onClick={generateAi} disabled={generating}>
                    {generating ? (
                      t('home.generating')
                    ) : (
                      <>
                        <IcSparkle size={16} /> {t('home.genAi')}
                      </>
                    )}
                  </button>
                )}
              </div>
            }
          />
        )}

        {status === 'ready' && current && (
          <>
            <DeckStack
              current={current}
              next={deck[idx + 1]}
              onSkip={advance}
              onAnswer={goAnswer}
              onSave={save}
              enterDir={enterDir}
              flyRegistry={flyRegistry}
              saved={saveFlash}
            />

            <div className="actions">
              <button
                className="fab fab-md fab--x"
                data-tut="actionSkip"
                onClick={doSkip}
                aria-label={t('home.aSkip')}
              >
                <IcX size={26} />
              </button>
              <button
                className="fab fab-md fab--save"
                data-tut="actionSave"
                onClick={save}
                aria-label={t('home.aSave')}
              >
                <IcBookmark size={26} />
              </button>
              <button
                className="fab fab-md fab--check"
                data-tut="actionAnswer"
                onClick={doAnswer}
                aria-label={t('home.aAnswer')}
              >
                <IcCheck size={26} />
              </button>
            </div>
          </>
        )}
      </div>

      {showTutorial && status === 'ready' && current && (
        <HomeTutorial
          onDone={() => {
            localStorage.removeItem('dt_tutorial_pending');
            setShowTutorial(false);
          }}
        />
      )}
    </>
  );
}
