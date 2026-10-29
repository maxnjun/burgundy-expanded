"use client";
import {useEffect} from 'react';
import {Capacitor, CapacitorHttp} from '@capacitor/core';
import {App} from '@capacitor/app';
import {usePathname} from 'next/navigation';
import {nativeRequest} from './transport';

// Only the Android export imports this module. Next's assets stay on local fetch.
if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  const webFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
    return url.origin === location.origin && url.pathname.startsWith('/api/')
      ? nativeRequest(new Request(input instanceof Request ? input : url, init), CapacitorHttp.request)
      : webFetch(input, init);
  };
}

export default function NativeRuntime() {
  const path = usePathname();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    try {if (!sessionStorage.getItem('burgundy-native-started')) {
      sessionStorage.setItem('burgundy-native-started', '1');
      const previous = localStorage.getItem('burgundy-native-page');
      if (path === '/' && previous === '/online') {location.replace('/online/'); return;}
    }
    localStorage.setItem('burgundy-native-page', path.replace(/\/$/, '') === '/online' ? '/online' : '/');
    } catch {/* The game's existing save warning reports unavailable storage. */}
  }, [path]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handles = [
      App.addListener('appStateChange', ({isActive}) => {
        if (isActive) window.dispatchEvent(new Event('pageshow'));
      }),
      App.addListener('backButton', ({canGoBack}) => {
        const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
        if (dialog) {dialog.close(); return;}
        if (canGoBack) {history.back(); return;}
        if (window.confirm('자동 저장된 게임을 유지하고 앱을 종료하시겠습니까?')) void App.exitApp();
      }),
    ];
    return () => {for (const handle of handles) void handle.then(h => h.remove());};
  }, []);
  return <aside className="native-apk-note">Android 앱 · 로컬 게임은 오프라인 지원 · 온라인은 인터넷 필요 · 서버 버전이 달라지면 새 APK를 설치하세요.</aside>;
}
