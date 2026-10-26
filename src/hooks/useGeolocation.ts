import { useCallback, useEffect, useRef, useState } from 'react';

export type GeolocationStatus =
  | 'idle' // never requested
  | 'requesting' // waiting on the browser prompt / first fix
  | 'granted' // actively have a position
  | 'denied' // user (or browser policy) refused permission
  | 'unavailable' // position could not be determined
  | 'timeout' // request took too long
  | 'unsupported' // navigator.geolocation doesn't exist
  | 'error'; // anything else

export interface Position {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
}

export interface UseGeolocationResult {
  status: GeolocationStatus;
  position: Position | null;
  errorMessage: string | null;
  /** Explicitly triggers the browser permission prompt / starts watching. Never called automatically. */
  request: () => void;
  /** Stops watching and resets to idle. */
  clear: () => void;
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 60_000,
};

/**
 * Wraps the HTML5 Geolocation API with explicit opt-in semantics: nothing
 * happens — no permission prompt, no watch — until `request()` is called.
 * When `watch` is true, keeps tracking position changes until `clear()` is
 * called or the component unmounts.
 */
export function useGeolocation(watch: boolean): UseGeolocationResult {
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [position, setPosition] = useState<Position | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    setStatus('granted');
    setErrorMessage(null);
    setPosition({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracyMeters: pos.coords.accuracy ?? null,
    });
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setStatus('denied');
        setErrorMessage('Location permission was denied.');
        break;
      case err.POSITION_UNAVAILABLE:
        setStatus('unavailable');
        setErrorMessage('Your location could not be determined right now.');
        break;
      case err.TIMEOUT:
        setStatus('timeout');
        setErrorMessage('Locating you took too long. Please try again.');
        break;
      default:
        setStatus('error');
        setErrorMessage('Something went wrong getting your location.');
    }
  }, []);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      setErrorMessage('Geolocation is not supported in this browser.');
      return;
    }

    setStatus('requesting');
    setErrorMessage(null);

    if (watch) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, GEOLOCATION_OPTIONS);
    } else {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, GEOLOCATION_OPTIONS);
    }
  }, [watch, handleSuccess, handleError]);

  const clear = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus('idle');
    setPosition(null);
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { status, position, errorMessage, request, clear };
}
