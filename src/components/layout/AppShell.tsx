import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { ToastViewport } from '../ui/ToastViewport';
import { ProximityAlertBanner } from '../proximity/ProximityAlertBanner';
import { PushMessageListener } from '../notifications/PushMessageListener';
import { AdminAmbientController } from '../admin/AdminAmbientController';
import { isSupabaseConfigured } from '../../lib/supabase';
import { SupportChatWidget } from '../support/SupportChatWidget';
import { ProfileAccentController } from '../profile/ProfileAccentController';
import { PlusPersonalizationController } from '../profile/PlusPersonalizationController';

export function AppShell() {
  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <AdminAmbientController />
      <ProfileAccentController />
      <PlusPersonalizationController />
      <div className="relative z-30"><Header /></div>
      <ProximityAlertBanner />
      <main className="relative z-10 flex-1">
        <Outlet />
      </main>
      <div className="relative z-10"><Footer /></div>
      <ToastViewport />
      <PushMessageListener />
      {isSupabaseConfigured && <SupportChatWidget />}
    </div>
  );
}
