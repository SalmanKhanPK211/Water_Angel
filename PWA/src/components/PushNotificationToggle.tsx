import { Switch } from '@/components/ui/switch';
import { Bell, BellRing } from 'lucide-react';
import { usePushNotification } from '@/hooks/usePushNotification';
import { toast } from 'sonner';

const PushNotificationToggle = () => {
  const { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe } = usePushNotification();

  if (!isSupported) {
    return (
      <div className="flex items-center justify-between py-2 opacity-50">
        <div className="flex items-center gap-3">
          <BellRing className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="text-sm text-foreground">Push Notifications</span>
            <p className="text-xs text-muted-foreground">Not supported in this browser</p>
          </div>
        </div>
        <Switch disabled checked={false} />
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center justify-between py-2 opacity-50">
        <div className="flex items-center gap-3">
          <BellRing className="h-4 w-4 text-critical" />
          <div>
            <span className="text-sm text-foreground">Push Notifications</span>
            <p className="text-xs text-critical">Blocked — enable in browser settings</p>
          </div>
        </div>
        <Switch disabled checked={false} />
      </div>
    );
  }

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      const success = await subscribe();
      if (success) {
        toast.success('Push notifications enabled!');
      } else {
        toast.error('Failed to enable push notifications');
      }
    } else {
      const success = await unsubscribe();
      if (success) {
        toast.success('Push notifications disabled');
      } else {
        toast.error('Failed to disable push notifications');
      }
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <Bell className="h-4 w-4 text-primary" />
        <div>
          <span className="text-sm text-foreground">Push Notifications</span>
          <p className="text-xs text-muted-foreground">
            {isSubscribed ? 'Receiving alerts on this device' : 'Get alerts even when app is closed'}
          </p>
        </div>
      </div>
      <Switch
        checked={isSubscribed}
        onCheckedChange={handleToggle}
        disabled={loading}
      />
    </div>
  );
};

export default PushNotificationToggle;
