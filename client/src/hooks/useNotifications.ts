import { useEffect, useRef } from 'react';

// Persistent audio context that stays alive for background playback
let persistentAudioContext: AudioContext | null = null;
let audioContextInitialized = false;

const hasNotificationApi = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window;

const getNotificationPermission = (): NotificationPermission | null => {
  if (!hasNotificationApi()) return null;
  return Notification.permission;
};

// Initialize audio context after user interaction (required by browsers)
const initializeAudioContext = () => {
  if (audioContextInitialized && persistentAudioContext) {
    return persistentAudioContext;
  }

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    persistentAudioContext = new AudioContextClass();
    audioContextInitialized = true;
    console.log('[Notifications] Audio context initialized, state:', persistentAudioContext.state);
    
    // Resume if suspended
    if (persistentAudioContext.state === 'suspended') {
      persistentAudioContext.resume().then(() => {
        console.log('[Notifications] Audio context resumed');
      }).catch((err) => {
        console.warn('[Notifications] Could not resume audio context:', err);
      });
    }

    return persistentAudioContext;
  } catch (error) {
    console.error('[Notifications] Error initializing audio context:', error);
    return null;
  }
};

// Play notification sound using Web Audio API
// This works even when the tab is in the background (if initialized after user interaction)
const playNotificationSound = () => {
  console.log('[Notifications] Attempting to play sound...');
  
  // Try to use persistent audio context first
  let audioContext = persistentAudioContext;
  
  // If no persistent context, try to initialize one
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = initializeAudioContext();
  }

  if (audioContext) {
    // Resume if suspended (browsers suspend audio contexts in background tabs)
    if (audioContext.state === 'suspended') {
      console.log('[Notifications] Resuming suspended audio context...');
      audioContext.resume().then(() => {
        console.log('[Notifications] Audio context resumed, playing sound...');
        playSoundWithContext(audioContext!);
      }).catch((err) => {
        console.warn('[Notifications] Could not resume audio context:', err);
        // Try fallback
        playSoundFallback();
      });
    } else {
      playSoundWithContext(audioContext);
    }
  } else {
    // Fallback: try to use HTML5 Audio
    playSoundFallback();
  }
};

// Helper function to play sound with audio context
const playSoundWithContext = (audioContext: AudioContext | any) => {
  try {
    // Don't close the persistent context - keep it alive for future sounds
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Create a pleasant notification sound
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    console.log('[Notifications] Sound started playing');
    
    // Note: We don't close the persistent audio context - keep it alive for background playback
  } catch (error) {
    console.error('[Notifications] Error playing sound with context:', error);
    playSoundFallback();
  }
};

// Fallback: use HTML5 Audio (works better in background tabs)
const playSoundFallback = () => {
  try {
    console.log('[Notifications] Using HTML5 Audio fallback...');
    
    // Create a more reliable beep sound using data URL
    // This is a simple sine wave encoded as WAV
    const sampleRate = 44100;
    const duration = 0.3;
    const frequency = 800;
    const samples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples * 2, true);
    
    // Generate sine wave
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * frequency * t) * 0.3 * (1 - t / duration);
      const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
      view.setInt16(44 + i * 2, intSample, true);
    }
    
    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.preload = 'auto';
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log('[Notifications] HTML5 Audio playing successfully');
        // Clean up URL after playing
        audio.onended = () => {
          URL.revokeObjectURL(url);
        };
      }).catch((err) => {
        console.warn('[Notifications] Audio play was prevented:', err);
        URL.revokeObjectURL(url);
      });
    }
  } catch (fallbackError) {
    console.warn('[Notifications] Could not play notification sound:', fallbackError);
  }
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  return false;
};

// Show browser notification
// Uses Service Worker if available (works better in background), otherwise falls back to page notifications
export const showNotification = async (
  title: string,
  options?: NotificationOptions
): Promise<Notification | null> => {
  if (!('Notification' in window)) {
    return null;
  }

  if (Notification.permission !== 'granted') {
    // Permission not granted, but we can still play sound
    return null;
  }

  try {
    console.log('[Notifications] Creating browser notification:', { title, options });
    const uniqueTag = options?.tag ? `${options.tag}-${Date.now()}` : `whatsapp-${Date.now()}`;
    const notificationOptions = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: uniqueTag,
      requireInteraction: false,
      silent: false,
      ...options,
    };

    // Always use Service Worker when available so the same notifications show everywhere (active tab, other tab, minimized)
    const swController = 'serviceWorker' in navigator ? navigator.serviceWorker.controller : null;
    if (swController) {
      try {
        swController.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          options: notificationOptions,
        });
        console.log('[Notifications] ✅ Notification sent via Service Worker (same everywhere)');
        return null;
      } catch (e) {
        console.warn('[Notifications] Service Worker postMessage failed:', e);
      }
    }

    // SW controller not ready yet – use registration (e.g. right after load)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration) {
          await registration.showNotification(title, notificationOptions);
          console.log('[Notifications] ✅ Notification shown via Service Worker');
          return null;
        }
      } catch (swError) {
        console.warn('[Notifications] Service Worker notification failed:', swError);
      }
    }

    // Fallback: page notification (only when no Service Worker)
    const notification = new Notification(title, notificationOptions);
    setTimeout(() => notification.close(), 8000);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return notification;
  } catch (error) {
    console.error('[Notifications] Error showing notification:', error);
    return null;
  }
};

// Expose test functions to window immediately (before hook runs)
if (typeof window !== 'undefined') {
  (window as any).testNotification = async () => {
    console.log('[Notifications] Testing notification...');
    console.log('[Notifications] Current permission status:', getNotificationPermission() ?? 'unsupported');
    if (!hasNotificationApi()) {
      console.error('[Notifications] ❌ Notifications not supported in this browser');
      return;
    }
    playNotificationSound();
    if (getNotificationPermission() === 'granted') {
      try {
        await showNotification('Test Notification', {
          body: 'This is a test notification. Switch to another tab/app - you should still see and hear this!',
          tag: 'test',
        });
        console.log('[Notifications] ✅ Test notification shown');
        console.log('[Notifications] 💡 Now switch to another tab/app - the notification should still appear!');
      } catch (error) {
        console.error('[Notifications] Error showing test notification:', error);
      }
    } else {
      console.log('[Notifications] ❌ Permission not granted. Current status:', getNotificationPermission());
      console.log('[Notifications] 💡 Run: requestNotificationPermission() to grant permission');
    }
  };

  (window as any).requestNotificationPermission = requestNotificationPermission;
  
  (window as any).testMessageNotification = (senderName = 'Test User', messageBody = 'This is a test message') => {
    console.log('[Notifications] Testing message notification with:', { senderName, messageBody });
    notifyNewMessage({
      fromMe: false,
      body: messageBody,
      senderName: senderName,
      chatId: 'test-chat-id',
    });
  };

  // Helper to check notification sound settings
  (window as any).checkNotificationSound = () => {
    console.log('%c[Notifications] Checking notification sound settings...', 'color: #2196F3; font-weight: bold;');
    console.log('Permission:', getNotificationPermission() ?? 'unsupported');
    console.log('Browser:', navigator.userAgent);
    console.log('');
    console.log('💡 IMPORTANT: JavaScript cannot play sounds in background tabs/apps due to browser security.');
    console.log('💡 Browser notifications play OS-level sound which is controlled by:');
    console.log('   1. Browser notification settings (Chrome: Settings → Privacy → Notifications)');
    console.log('   2. OS notification settings (Windows: Settings → System → Notifications)');
    console.log('   3. Do Not Disturb mode (if enabled, sounds are muted)');
    console.log('');
    console.log('✅ To enable notification sounds:');
    console.log('   - Make sure browser notifications are enabled');
    console.log('   - Check OS notification settings allow sounds');
    console.log('   - Disable Do Not Disturb mode');
    console.log('   - Test with: testNotification()');
  };
  
  console.log('%c[Notifications] Test functions available:', 'color: #4CAF50; font-weight: bold;');
  console.log('  - testNotification() - Test basic notification');
  console.log('  - testMessageNotification("Sender Name", "Message text") - Test message notification');
  console.log('  - requestNotificationPermission() - Request notification permission');
  console.log('  - checkNotificationSound() - Check notification sound settings');
}

// Hook to initialize notification system
export function useNotifications() {
  const permissionRequested = useRef(false);
  const audioInitialized = useRef(false);

  useEffect(() => {
    // Check current permission status
    console.log('%c[Notifications] Initializing notification system...', 'color: #2196F3; font-weight: bold;');
    console.log('[Notifications] Current permission status:', getNotificationPermission() ?? 'unsupported');
    console.log('[Notifications] Notification API available:', hasNotificationApi());
    
    // Initialize audio context after user interaction
    const initAudioOnInteraction = () => {
      if (!audioInitialized.current) {
        audioInitialized.current = true;
        const ctx = initializeAudioContext();
        if (ctx) {
          console.log('[Notifications] Audio context initialized and ready for background playback');
        }
        // Remove listeners after first interaction
        document.removeEventListener('click', initAudioOnInteraction);
        document.removeEventListener('keydown', initAudioOnInteraction);
        document.removeEventListener('touchstart', initAudioOnInteraction);
      }
    };

    // Set up listeners for user interaction to initialize audio
    document.addEventListener('click', initAudioOnInteraction, { once: true });
    document.addEventListener('keydown', initAudioOnInteraction, { once: true });
    document.addEventListener('touchstart', initAudioOnInteraction, { once: true });

    // Resume audio context when page becomes visible (helps with background playback)
    const handleVisibilityChange = () => {
      if (persistentAudioContext && persistentAudioContext.state === 'suspended') {
        console.log('[Notifications] Page visible, resuming audio context...');
        persistentAudioContext.resume().then(() => {
          console.log('[Notifications] Audio context resumed');
        }).catch((err) => {
          console.warn('[Notifications] Could not resume audio context:', err);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Request permission when component mounts (only once)
    if (!permissionRequested.current) {
      permissionRequested.current = true;
      // Request permission after a short delay to avoid blocking initial render
      setTimeout(() => {
        // If already granted, just log it
        if (getNotificationPermission() === 'granted') {
          console.log('%c[Notifications] ✅ Permission already granted!', 'color: #4CAF50; font-weight: bold;');
        } else {
          requestNotificationPermission().then((granted) => {
            if (granted) {
              console.log('%c[Notifications] ✅ Permission granted!', 'color: #4CAF50; font-weight: bold;');
            } else {
              console.log('%c[Notifications] ❌ Permission denied or not supported', 'color: #f44336; font-weight: bold;');
              console.log('[Notifications] 💡 You can manually grant permission in browser settings');
            }
          }).catch((err) => {
            console.error('[Notifications] Error requesting permission:', err);
          });
        }
      }, 1000);
    }

    return () => {
      // Cleanup listeners
      document.removeEventListener('click', initAudioOnInteraction);
      document.removeEventListener('keydown', initAudioOnInteraction);
      document.removeEventListener('touchstart', initAudioOnInteraction);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    requestPermission: requestNotificationPermission,
    showNotification,
    playSound: playNotificationSound,
  };
}

// Function to handle new message notifications
export const notifyNewMessage = (message: {
  fromMe?: boolean;
  body?: string;
  senderName?: string;
  chatId?: string;
}) => {
  console.log('[Notifications] notifyNewMessage called with:', {
    fromMe: message.fromMe,
    senderName: message.senderName,
    body: message.body?.substring(0, 50),
    chatId: message.chatId,
    notificationPermission: getNotificationPermission() ?? 'unsupported'
  });

  // Only notify for incoming messages (not from the user)
  if (message.fromMe) {
    console.log('[Notifications] Skipping notification - message is from user');
    return;
  }

  // Try to play JavaScript sound (works in active tab only due to browser restrictions)
  // Note: This won't work in background tabs/apps due to browser security policies
  console.log('[Notifications] Attempting to play JavaScript sound (may not work in background tabs)...');
  playNotificationSound();

  // Show browser notification if permission is granted
  // Browser notifications play OS-level sound which works even in background tabs/apps
  if (getNotificationPermission() === 'granted') {
    const senderName = message.senderName || 'Unknown';
    const messageBody = message.body || '[Media]';
    const preview = messageBody.length > 100 
      ? messageBody.substring(0, 100) + '...' 
      : messageBody;

    console.log('[Notifications] Showing browser notification (OS sound will play if enabled):', { senderName, preview });
    showNotification(`${senderName}`, {
      body: preview,
      tag: `chat-${message.chatId}`, // Group by chat
      data: {
        chatId: message.chatId,
      },
    }).then((notification) => {
      if (notification) {
        console.log('[Notifications] ✅ Page notification shown');
      } else {
        console.log('[Notifications] ✅ Service Worker notification shown (works in background!)');
      }
      console.log('[Notifications] 💡 OS sound should play if enabled in Windows notification settings');
    }).catch((error) => {
      console.error('[Notifications] ⚠️ Failed to create browser notification:', error);
    });
  } else {
    console.log('[Notifications] Browser notification permission not granted:', getNotificationPermission() ?? 'unsupported');
    console.log('[Notifications] 💡 Grant notification permission to get sound alerts in background tabs/apps');
  }
};
