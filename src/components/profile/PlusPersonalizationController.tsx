import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { useIsCreator } from '../../hooks/useIsCreator';
import { fetchMyRefoundPlusEntitlement, isRefoundPlusActive } from '../../lib/refoundPlusService';
import {
  DEFAULT_PLUS_PERSONALIZATION,
  onPlusPersonalizationChange,
  readPlusPersonalization,
  type PlusPersonalization,
} from '../../lib/plusPersonalization';
import { CircuitAmbience } from './CircuitAmbience';

export function PlusPersonalizationController() {
  const { user } = useAuth();
  const { isCreator, loading: adminLoading } = useIsCreator();
  const cursorRef = useRef<HTMLSpanElement>(null);
  const [settings, setSettings] = useState<PlusPersonalization>(DEFAULT_PLUS_PERSONALIZATION);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    const root = document.documentElement;
    root.removeAttribute('data-user-ambient');
    root.removeAttribute('data-custom-cursor');
    setAllowed(false);
    setSettings(DEFAULT_PLUS_PERSONALIZATION);

    if (!user || adminLoading) return () => { active = false; };
    const enable = (hasPlus: boolean) => {
      if (!active) return;
      const canUse = !isCreator && hasPlus;
      setAllowed(canUse);
      if (canUse) setSettings(readPlusPersonalization(user.id));
    };
    if (isCreator) enable(true);
    else void fetchMyRefoundPlusEntitlement(user.id).then(({ entitlement }) => enable(isRefoundPlusActive(entitlement)));

    return () => { active = false; };
  }, [user, isCreator, adminLoading]);

  useEffect(() => {
    if (!allowed) return;
    const sync = () => setSettings(user ? readPlusPersonalization(user.id) : DEFAULT_PLUS_PERSONALIZATION);
    return onPlusPersonalizationChange(sync);
  }, [allowed, user]);

  useEffect(() => {
    const root = document.documentElement;
    if (!allowed || !user) {
      root.removeAttribute('data-user-ambient');
      root.removeAttribute('data-custom-cursor');
      return () => {
        root.removeAttribute('data-user-ambient');
        root.removeAttribute('data-custom-cursor');
      };
    }

    root.dataset.userAmbient = settings.ambient.toLowerCase();
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (finePointer && settings.cursor !== 'OFF') root.dataset.customCursor = settings.cursor.toLowerCase();
    else root.removeAttribute('data-custom-cursor');

    const cursor = cursorRef.current;
    if (!cursor || !finePointer || settings.cursor === 'OFF') {
      return () => {
        root.removeAttribute('data-user-ambient');
        root.removeAttribute('data-custom-cursor');
      };
    }
    const onMove = (event: PointerEvent) => {
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      cursor.dataset.visible = 'true';
      cursor.dataset.interactive = event.target instanceof Element && Boolean(event.target.closest('a,button,[role="button"],input,select,textarea')) ? 'true' : 'false';
    };
    const onLeave = () => { cursor.dataset.visible = 'false'; cursor.dataset.pressed = 'false'; };
    const onDown = (event: PointerEvent) => {
      if (event.button === 0 && event.pointerType !== 'touch') cursor.dataset.pressed = 'true';
    };
    const onUp = () => { cursor.dataset.pressed = 'false'; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.documentElement.addEventListener('pointerenter', onLeave);
    return () => {
      root.removeAttribute('data-user-ambient');
      root.removeAttribute('data-custom-cursor');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.documentElement.removeEventListener('pointerenter', onLeave);
    };
  }, [allowed, settings, user]);

  if (!allowed) return null;
  return <>
    {settings.ambient !== 'OFF' && <div className="refound-user-ambience" data-effect={settings.ambient.toLowerCase()} aria-hidden="true">
      {settings.ambient === 'CIRCUIT' && <CircuitAmbience />}
    </div>}
    {settings.cursor !== 'OFF' && createPortal(
      <span ref={cursorRef} className="refound-custom-cursor-position" aria-hidden="true">
        <span className={`refound-custom-cursor refound-custom-cursor-${settings.cursor.toLowerCase()}`} />
      </span>,
      document.body,
    )}
  </>;
}
