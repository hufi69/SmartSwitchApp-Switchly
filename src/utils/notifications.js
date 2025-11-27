import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Check if running in Expo Go
const isExpoGo = () => {
  try {
    return !__DEV__ ? false : true; // Simplified check
  } catch {
    return false;
  }
};

// Configure notification handler (only if not Expo Go)
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (error) {
  console.log('⚠️ Running in Expo Go - notifications will use fallback');
}

// Request notification permissions
export const requestNotificationPermissions = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('❌ Notification permissions not granted (Expo Go limitation)');
   
      return false;
    }
    
    console.log('✅ Notification permissions granted');
    
    // For Android, create notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Switchly Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4361EE',
        sound: 'default',
      });
      
      await Notifications.setNotificationChannelAsync('safety', {
        name: 'Safety Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#FF0000',
        sound: 'default',
      });
    }
    
    return true;
  } catch (error) {
    console.log('⚠️ Expo Go Limitation: Push notifications not supported');
    console.log('💡 Using Alert fallback for testing');
    console.log('✅ Notifications will work in production build');
    return false;
  }
};

// Save notification to Firebase for notification center (Always works!)
const saveNotificationToFirebase = async (title, body, type) => {
  try {
    const { getAuth } = await import('firebase/auth');
    const { getDatabase, ref: dbRef, set } = await import('firebase/database');
    
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const db = getDatabase();
    const notificationId = Date.now().toString();
    const notificationRef = dbRef(db, `users/${userId}/notifications/${notificationId}`);
    
    await set(notificationRef, {
      title,
      body,
      type,
      timestamp: new Date().toISOString(),
      read: false,
    });
    
    console.log('💾 Notification saved to Firebase (viewable in Notification Center)');
  } catch (error) {
    console.error('Error saving notification to Firebase:', error);
  }
};

// Send local push notification (with Expo Go fallback)
export const sendNotification = async (title, body, data = {}) => {
  // ALWAYS save to Firebase for notification center
  await saveNotificationToFirebase(title, body, data.type);
  
  try {
    // Try to send push notification (works in production build)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        data: data,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
      },
      trigger: null, // Show immediately
    });
    
    console.log(`📬 Push notification sent: ${title}`);
  } catch (error) {
    // Expo Go fallback - Show alert + save to notification center
    console.log(`💾 Notification saved to center (Expo Go mode): ${title}`);
    Alert.alert(title, body, [
      { 
        text: 'View All', 
        onPress: () => console.log('Navigate to Notifications screen')
      },
      { text: 'OK' }
    ]);
  }
};

// Notification types
export const NotificationTypes = {
  OVERVOLTAGE: 'overvoltage',
  UNDERVOLTAGE: 'undervoltage',
  HIGH_POWER: 'high_power',
  DEVICE_OFFLINE: 'device_offline',
  DEVICE_ONLINE: 'device_online',
  TIMER_COMPLETE: 'timer_complete',
};

// Send alert notifications with sound and vibration
export const sendOvervoltageAlert = async (voltage) => {
  const title = '⚠️ Overvoltage Alert';
  const body = `Voltage is too high: ${voltage.toFixed(1)}V. Device may be at risk.`;
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: NotificationTypes.OVERVOLTAGE, voltage },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 500, 250, 500],
        categoryIdentifier: 'safety',
      },
      trigger: null,
    });
    
    await saveNotificationToFirebase(title, body, NotificationTypes.OVERVOLTAGE);
  } catch (error) {
    Alert.alert(title, body);
  }
};

export const sendUndervoltageAlert = async (voltage) => {
  const title = '⚠️ Undervoltage Alert';
  const body = `Voltage is too low: ${voltage.toFixed(1)}V. Check your power supply.`;
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: NotificationTypes.UNDERVOLTAGE, voltage },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 500, 250, 500],
        categoryIdentifier: 'safety',
      },
      trigger: null,
    });
    
    await saveNotificationToFirebase(title, body, NotificationTypes.UNDERVOLTAGE);
  } catch (error) {
    Alert.alert(title, body);
  }
};

export const sendHighPowerAlert = async (power) => {
  const title = '⚡ High Power Consumption';
  const body = `Power usage is high: ${power.toFixed(0)}W. Check your connected device.`;
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: NotificationTypes.HIGH_POWER, power },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
      },
      trigger: null,
    });
    
    await saveNotificationToFirebase(title, body, NotificationTypes.HIGH_POWER);
  } catch (error) {
    Alert.alert(title, body);
  }
};

export const sendDeviceOfflineAlert = async () => {
  const title = '🔴 Device Offline';
  const body = 'Your Switchly device is not responding. Check your connection.';
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: NotificationTypes.DEVICE_OFFLINE },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 500, 500, 500],
        categoryIdentifier: 'safety',
      },
      trigger: null,
    });
    
    await saveNotificationToFirebase(title, body, NotificationTypes.DEVICE_OFFLINE);
  } catch (error) {
    Alert.alert(title, body);
  }
};

export const sendDeviceOnlineAlert = async () => {
  const title = '🟢 Device Online';
  const body = 'Your Switchly device is back online.';
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: NotificationTypes.DEVICE_ONLINE },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        vibrate: [0, 250],
      },
      trigger: null,
    });
    
    await saveNotificationToFirebase(title, body, NotificationTypes.DEVICE_ONLINE);
  } catch (error) {
    Alert.alert(title, body);
  }
};

export const sendTimerCompleteAlert = async (timerName) => {
  const title = '⏰ Timer Complete';
  const body = `Timer "${timerName}" has finished.`;
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: NotificationTypes.TIMER_COMPLETE, timerName },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        vibrate: [0, 250, 250, 250],
      },
      trigger: null,
    });
    
    await saveNotificationToFirebase(title, body, NotificationTypes.TIMER_COMPLETE);
  } catch (error) {
    Alert.alert(title, body);
  }
};
