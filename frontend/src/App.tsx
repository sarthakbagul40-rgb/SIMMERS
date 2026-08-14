import React, { useState, useEffect, useRef } from 'react';
import type { UserState, PantryItem, Quest, UserSettings, PresetItem, ShoppingItem } from './types';
import { HERO_RANKS, getCurrentHeroRank, getNextHeroRank, SUPPORTED_CURRENCIES, getCurrencyInfo } from './types';



import { DbService, getLocalDateString, getDaysDifference, formatDisplayDate, getItemCategory, calculateFinancialSavings } from './services/db';
import { BackupService } from './services/backup';
import { scanPacketExpiryDate } from './services/aiScanner';
import { compressImage } from './utils/imageCompressor';
import { ZoomableImageModal } from './components/ZoomableImageModal';
import { InAppCameraModal } from './components/InAppCameraModal';
import { NativeStorageService } from './services/storage';
import { App as CapacitorApp } from '@capacitor/app';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import { getDynamicPantryQuests } from './services/recipeGenerator';
import { PRESET_ITEMS } from './data/presets';
import { Mascot } from './components/Mascot';
import type { MascotState, MascotOutfit } from './components/Mascot';
import { HybridSyncService } from './services/hybridSyncService';
import { InputValidator, sanitizeText } from './utils/validation';
import { NotificationService } from './services/notificationService';
import { CurrencyService } from './services/currencyService';
import { QuestService, ALL_ACHIEVEMENTS } from './services/questService';
import type { Achievement } from './types';
import { DeviceService } from './services/deviceService';





function App() {
  // Navigation & Loading States
  const [activeTab, setActiveTab] = useState<'home' | 'pantry' | 'quests' | 'settings'>('home');
  const [, setInitialLoading] = useState(true);

  // Device ID & Household Group States
  const [deviceId, setDeviceId] = useState<string>('');
  const [householdMemberCount, setHouseholdMemberCount] = useState<number>(1);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState<string>('');

  // Loaded DB State
  const [user, setUser] = useState<UserState>(DbService.loadUser());
  const [items, setItems] = useState<PantryItem[]>(DbService.loadItems());
  const [, setQuests] = useState<Quest[]>(DbService.loadQuests());
  const [settings, setSettings] = useState<UserSettings>(DbService.loadSettings());

  // Initial App Hydration effect (Hydrate native storage, then fade out splash screen)
  useEffect(() => {
    const initApp = async () => {
      await NativeStorageService.initStorage();

      // Register / load persistent Device Profile (Zero Login / Zero Signup)
      const profile = await DeviceService.getDeviceProfile();
      setDeviceId(profile.deviceId);
      await HybridSyncService.registerDeviceProfile(profile);

      // Sync DB state post-hydration
      let loadedUser = DbService.loadUser();
      let loadedItems = DbService.loadItems();
      let loadedQuests = DbService.loadQuests();
      let loadedSettings = DbService.loadSettings();



      setUser(loadedUser);
      setItems(loadedItems);
      setQuests(loadedQuests);

      // Automatic cloud account & household recovery for returning users via persistent Device ID
      let activeHouseholdCode = loadedSettings.householdCode;
      if (!activeHouseholdCode && profile.deviceId) {
        const foundCode = await HybridSyncService.findDeviceHousehold(profile.deviceId);
        if (foundCode) {
          activeHouseholdCode = foundCode;
          loadedSettings = { ...loadedSettings, householdCode: foundCode };
          DbService.saveSettings(loadedSettings);
        }
      }
      setSettings(loadedSettings);

      if (activeHouseholdCode) {
        const count = await HybridSyncService.getHouseholdMembersCount(activeHouseholdCode);
        setHouseholdMemberCount(count);

        const cloudItems = await HybridSyncService.pullItemsFromCloud(activeHouseholdCode);
        if (cloudItems !== null && Array.isArray(cloudItems)) {
          setItems(cloudItems);
          DbService.saveItems(cloudItems);
        }
      }

      // Auto-detect & update local currency with 100% accuracy if unconfigured
      const detected = await CurrencyService.detectLocalCurrency();
      if (detected && (!loadedSettings.currency || loadedSettings.currency === 'INR')) {
        const updated = { ...loadedSettings, currency: detected };
        DbService.saveSettings(updated);
        setSettings(updated);
      }

      const onboardingDone = localStorage.getItem('simmer_onboarding_done') === 'true';
      setShowOnboarding(!onboardingDone);

      setInitialLoading(false);
      const splash = document.getElementById('splash-root');
      if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 400);
      }
    };
    initApp();
  }, []);

  // Household Group 5-Second Real-Time Sync Loop
  useEffect(() => {
    if (!settings.householdCode) return;

    const syncHouseholdInterval = setInterval(async () => {
      // Pause network polling if app is in background to save battery & network bandwidth
      if (typeof document !== 'undefined' && document.hidden) return;

      try {
        const cloudItems = await HybridSyncService.pullItemsFromCloud(settings.householdCode!);

        if (cloudItems !== null && Array.isArray(cloudItems)) {
          setItems(prev => {
            const isDifferent = JSON.stringify(prev) !== JSON.stringify(cloudItems);
            if (isDifferent) {
              DbService.saveItems(cloudItems);
              return cloudItems;
            }
            return prev;
          });
        }

        const count = await HybridSyncService.getHouseholdMembersCount(settings.householdCode!);
        setHouseholdMemberCount(count);
      } catch (e) {
        console.warn('[HouseholdSyncLoop] Auto sync error:', e);
      }
    }, 5000);

    return () => clearInterval(syncHouseholdInterval);
  }, [settings.householdCode]);

  // Fast Instant Tab Switching Handler
  const handleTabSwitch = (newTab: 'home' | 'pantry' | 'quests' | 'settings') => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
  };




  // Mascot animation state overrides
  const [mascotAnimationState, setMascotAnimationState] = useState<MascotState>('idle');

  // Interactive UI helpers
  const [selectedItem, setSelectedItem] = useState<PantryItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isStreakAlert, setIsStreakAlert] = useState(false);

  // Item Editing States
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editShelfLife, setEditShelfLife] = useState(5);

  // Onboarding Modal & Convincing Notification Permission States
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('simmer_onboarding_done') !== 'true';
  });
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isOnboardingProcessing, setIsOnboardingProcessing] = useState(false);
  const [showNotifWarningModal, setShowNotifWarningModal] = useState(false);
  const [pendingNotifCallback, setPendingNotifCallback] = useState<((enabled: boolean) => void) | null>(null);

  const requestNotificationPermissionWithPrompt = async (onComplete?: (enabled: boolean) => void) => {
    const granted = await NotificationService.requestPermissions();
    if (granted) {
      const updatedSettings = { ...settings, notificationEnabled: true };
      DbService.saveSettings(updatedSettings);
      setSettings(updatedSettings);
      NotificationService.scheduleExpiryNotifications(items, updatedSettings, user);
      if (onComplete) onComplete(true);
    } else {
      setShowNotifWarningModal(true);
      if (onComplete) {
        setPendingNotifCallback(() => onComplete);
      }
    }
  };

  // Android Hardware Back Button Navigation Handler
  useEffect(() => {
    const backListener = CapacitorApp.addListener('backButton', () => {
      if (showAddModal) {
        setShowAddModal(false);
        return;
      }
      if (selectedItem) {
        setSelectedItem(null);
        return;
      }
      if (editingItem) {
        setEditingItem(null);
        return;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return;
      }
      // On main screen with no open modals: minimize app to background without losing session
      CapacitorApp.minimizeApp();
    });

    return () => {
      backListener.then((h) => h.remove());
    };
  }, [showAddModal, selectedItem, editingItem, activeTab]);

  // Android Camera App Restored Listener (Handles background activity destruction during camera launch)
  useEffect(() => {
    const restoreListener = CapacitorApp.addListener('appRestoredResult', async (data: any) => {
      if (data && data.pluginId === 'Camera' && data.methodName === 'getPhoto' && data.result) {
        const image = data.result;
        try {
          let base64Data = '';
          if (image.webPath) {
            const res = await fetch(image.webPath);
            const blob = await res.blob();
            const file = new File([blob], 'camera_photo.jpg', { type: blob.type || 'image/jpeg' });
            base64Data = await compressImage(file, 1600, 1600, 0.90);
          } else if (image.base64String) {
            base64Data = `data:image/jpeg;base64,${image.base64String}`;
          }

          if (base64Data) {
            setScannedImageBase64(base64Data);
            setShowAddModal(true);
            setAddItemStep(2);

            // Restore item name & shelf life saved before activity destruction
            const savedName = localStorage.getItem('simmer_pending_item_name');
            const savedLife = localStorage.getItem('simmer_pending_shelf_life');

            setScanStatus({ message: '⚡ Optimizing photo & scanning packet label...', type: 'info' });

            const result = await scanPacketExpiryDate(base64Data, 'image/jpeg', settings.geminiApiKey, image.path || image.webPath);
            setIsScanning(false);

            const finalName = savedName || result.itemName || 'Scanned Item';
            setChosenItemName(finalName);

            if (result.success && result.daysFromToday) {
              setCustomShelfLife(result.daysFromToday);
              setScanStatus({
                message: `🎯 Verified Expiry Date: ${result.detectedText || result.expiryDate} (${result.daysFromToday} days left)!`,
                type: 'success'
              });
            } else if (savedLife) {
              setCustomShelfLife(Number(savedLife));
              setScanStatus({
                message: result.error || 'Expiry date unclear or missing. Please select/adjust the expiry date manually below.',
                type: 'warning'
              });
            } else {
              setScanStatus({
                message: result.error || 'Expiry date unclear or missing. Please select/adjust the expiry date manually below.',
                type: 'warning'
              });
            }
          }
        } catch (err) {
          console.error('Error handling restored camera result:', err);
        }
      }
    });

    return () => {
      restoreListener.then((h: any) => h.remove());
    };
  }, [settings.geminiApiKey]);

  const handleFinishOnboarding = async () => {
    setIsOnboardingProcessing(true);
    
    let notifEnabled = settings.notificationEnabled;
    if ('Notification' in window && Notification.permission === 'granted') {
      notifEnabled = true;
    }

    const detectedCurrency = await CurrencyService.detectLocalCurrency();
    
    const updatedSettings = {
      ...settings,
      notificationEnabled: notifEnabled,
      currency: detectedCurrency || settings.currency || 'INR'
    };
    
    DbService.saveSettings(updatedSettings);
    setSettings(updatedSettings);

    NativeStorageService.set('simmer_onboarding_done', 'true');
    NativeStorageService.set('pantry_rpg_has_seeded', 'true');
    setShowOnboarding(false);
    setIsOnboardingProcessing(false);
  };

  const handleStartEditingItem = (item: PantryItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditShelfLife(item.shelfLifeDays);
  };

  const handleSaveItemEdit = () => {
    if (!editingItem || !editName.trim()) return;
    const cleanName = editName.trim();
    DbService.updateItem(editingItem.id, cleanName, editShelfLife);
    syncState();
    setEditingItem(null);
    setSelectedItem(null);
    setToastMessage(`Updated "${cleanName}"! ✏️`);
    setTimeout(() => setToastMessage(null), 2500);
  };
  
// Particle Confetti Effect Component for Quest Rewards & Milestones
const ConfettiCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#34d399', '#fbbf24'];
    const particles = Array.from({ length: 75 }).map(() => ({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.6,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 16 - 8,
      size: Math.random() * 9 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12
    }));

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.42; // gravity
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 3000
      }}
    />
  );
};

  // Feedback Animations & Confetti State
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerConfettiEffect = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  const [toast, setToast] = useState<{
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    undoAction?: () => void;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [xpFloatPopup, setXpFloatPopup] = useState<string | null>(null);
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    undoAction?: () => void,
    duration = 4000
  ) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    let inferredType = type;
    if (type === 'info') {
      if (message.includes('❌') || message.includes('⚠️') || message.includes('🚫') || message.includes('failed')) {
        inferredType = message.includes('⚠️') ? 'warning' : 'error';
      } else if (message.includes('🎉') || message.includes('✅') || message.includes('✨') || message.includes('🔗') || message.includes('🏆') || message.includes('🛒') || message.includes('📋') || message.includes('😋')) {
        inferredType = 'success';
      }
    }
    setToast({ message, type: inferredType, undoAction });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  };

  const setToastMessage = (msg: string | null, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    if (!msg) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast(null);
    } else {
      showToast(msg, type);
    }
  };
  
  // Custom item inputs
  const [customName, setCustomName] = useState('');
  const [customShelfLife, setCustomShelfLife] = useState(5);

  // Pantry Filtering, Searching & Sorting States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'urgent' | 'expired' | 'safe'>('all');
  const [sortOrder, setSortOrder] = useState<'urgency' | 'name' | 'dateAdded'>('urgency');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [pantryViewMode, setPantryViewMode] = useState<'list' | 'calendar'>('list');

  // Financial Savings & Currency State
  const [savingsTimeframe, setSavingsTimeframe] = useState<'week' | 'month' | 'all'>('week');

  const handleCurrencyChange = (newCurrency: string) => {
    const updated = { ...settings, currency: newCurrency };
    DbService.saveSettings(updated);
    setSettings(updated);
    setToastMessage(`Currency updated to ${newCurrency}! 💱`);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleSendTestNotification = async () => {
    setToastMessage('⚙️ Sending test notification in 3 seconds...');
    const success = await NotificationService.sendTestNotification();
    if (success) {
      setToastMessage('🔔 Test notification scheduled! Check your top bar in 3s.');
    } else {
      setToastMessage('⚠️ Notification permission rejected. Please enable in phone settings.');
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Household Cloud Sync State & Handlers
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const handleCreateHousehold = async () => {
    setIsSyncingCloud(true);
    try {
      const activeDeviceId = deviceId || (await DeviceService.getDeviceId());
      const code = await HybridSyncService.createHousehold(activeDeviceId);

      await HybridSyncService.pushItemsToCloud(code, items, activeDeviceId);

      const updatedSettings = { ...settings, householdCode: code };
      DbService.saveSettings(updatedSettings);
      setSettings(updatedSettings);
      setHouseholdMemberCount(1);
      setToastMessage(`🎉 Created Household ${code}! Share code with up to 5 family members!`);
    } catch (err) {
      console.error('[Household] Error creating household:', err);
      setToastMessage('⚠️ Unable to create household. Please check your connection.');
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleJoinHousehold = async () => {
    if (!joinCodeInput.trim()) return;
    const val = InputValidator.validateHouseholdCode(joinCodeInput);
    if (!val.valid) {
      setToastMessage(`❌ ${val.error}`);
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    setIsSyncingCloud(true);
    try {
      const cleanCode = joinCodeInput.trim().toUpperCase();
      const activeDeviceId = deviceId || (await DeviceService.getDeviceId());

      const joinResult = await HybridSyncService.joinHousehold(cleanCode, activeDeviceId);

      if (!joinResult.success) {
        setToastMessage(joinResult.message || `❌ Could not join Household "${cleanCode}".`);
        return;
      }

      const cloudItems = await HybridSyncService.pullItemsFromCloud(cleanCode);

      if (cloudItems && cloudItems.length > 0) {
        DbService.saveItems(cloudItems);
        setItems(cloudItems);
      } else {
        await HybridSyncService.pushItemsToCloud(cleanCode, items, activeDeviceId);
      }

      const updatedSettings = { ...settings, householdCode: cleanCode };
      DbService.saveSettings(updatedSettings);
      setSettings(updatedSettings);
      setHouseholdMemberCount(joinResult.memberCount || 1);
      setJoinCodeInput('');
      setToastMessage(`🔗 Joined Household ${cleanCode}! Group system active (${joinResult.memberCount || 1}/6 members).`);
    } catch (err) {
      console.error('[Household] Error joining household:', err);
      setToastMessage('⚠️ Could not connect to household. Please try again.');
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleManualCloudSync = async () => {
    if (!settings.householdCode) return;
    setIsSyncingCloud(true);
    try {
      await HybridSyncService.pushItemsToCloud(settings.householdCode, items, deviceId);

      const cloudItems = await HybridSyncService.pullItemsFromCloud(settings.householdCode);

      if (cloudItems !== null && Array.isArray(cloudItems)) {
        DbService.saveItems(cloudItems);
        setItems(cloudItems);
      }
      setToastMessage(`🔄 Household Pantry Synced!`);
    } catch (err) {
      console.error('[Household] Error manual cloud sync:', err);
      setToastMessage('⚠️ Household sync failed. Please check internet connection.');
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  const handleLeaveHousehold = () => {
    const updatedSettings = { ...settings, householdCode: null };
    DbService.saveSettings(updatedSettings);
    setSettings(updatedSettings);
    setToastMessage(`🚪 Left Household.`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleRestoreFromKey = async () => {
    if (!recoveryKeyInput.trim()) return;
    try {
      const cleanKey = recoveryKeyInput.trim().toUpperCase();
      await DeviceService.restoreDeviceKey(cleanKey);
      setDeviceId(cleanKey);

      const foundHousehold = await HybridSyncService.findDeviceHousehold(cleanKey);
      if (foundHousehold) {
        const updatedSettings = { ...settings, householdCode: foundHousehold };
        DbService.saveSettings(updatedSettings);
        setSettings(updatedSettings);
        const cloudItems = await HybridSyncService.pullItemsFromCloud(foundHousehold);
        if (cloudItems && cloudItems.length > 0) {
          DbService.saveItems(cloudItems);
          setItems(cloudItems);
        }
        setToastMessage(`🛡️ Household & Pantry Restored from Recovery Key!`);
      } else {
        setToastMessage(`🛡️ Device ID updated to "${cleanKey}"!`);
      }
      setRecoveryKeyInput('');
    } catch (err) {
      console.error('[AccountRecovery] Error restoring key:', err);
      setToastMessage('⚠️ Could not restore key. Please check your key and try again.');
    } finally {
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Bulk Pantry Actions States
  const [isBulkSelectMode, setIsBulkSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkConsume = () => {
    if (selectedItemIds.length === 0) return;
    const count = selectedItemIds.length;
    let totalXp = 0;
    selectedItemIds.forEach(id => {
      const res = DbService.consumeItem(id);
      if (res.success) totalXp += res.xpGained;
    });
    syncState();
    setSelectedItemIds([]);
    setIsBulkSelectMode(false);
    triggerMascotAnimation('happy', 2500);
    setToastMessage(`😋 Rescued ${count} items! +${totalXp} XP`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleBulkSpoil = () => {
    if (selectedItemIds.length === 0) return;
    const count = selectedItemIds.length;
    selectedItemIds.forEach(id => {
      DbService.spoilItem(id);
    });
    syncState();
    setSelectedItemIds([]);
    setIsBulkSelectMode(false);
    triggerMascotAnimation('sad', 2500);
    setToastMessage(`🤢 Marked ${count} items as spoiled.`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 2-Step Add Item Flow States
  const [addItemStep, setAddItemStep] = useState<1 | 2>(1);
  const [chosenItemName, setChosenItemName] = useState('');

  // Packet Expiry Scanner States
  const [scannedImageBase64, setScannedImageBase64] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);
  
  // Ad simulation
  const [adTimer, setAdTimer] = useState<number | null>(null);
  const [showAdModal, setShowAdModal] = useState(false);

  // Settings Page States & Toggles
  const [mascotNameInput, setMascotNameInput] = useState(user.mascotName);
  const [showHelpAccordion, setShowHelpAccordion] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);



  // Shopping List & Rescue History State
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => DbService.loadShoppingList());
  const [pantrySubTab, setPantrySubTab] = useState<'shopping' | 'history'>('shopping');
  const [newShoppingItemName, setNewShoppingItemName] = useState('');

  // Hero Quest Board States
  const [questSubTab, setQuestSubTab] = useState<'daily' | 'raid' | 'achievements'>('daily');
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  // In-App Camera Viewfinder State
  const [showInAppCamera, setShowInAppCamera] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const handleAddShoppingItem = (nameToAdd?: string) => {
    const targetName = (nameToAdd || newShoppingItemName).trim();
    if (!targetName) return;
    const val = InputValidator.validateFoodName(targetName);
    if (!val.valid) {
      alert(val.error);
      return;
    }

    const newItem: ShoppingItem = {
      id: Date.now().toString(),
      name: targetName,
      category: getItemCategory(targetName),
      isBought: false,
      dateAdded: new Date().toISOString()
    };

    const updated = [newItem, ...shoppingList];
    setShoppingList(updated);
    DbService.saveShoppingList(updated);
    if (!nameToAdd) setNewShoppingItemName('');
  };

  const handleMarkBoughtItem = (shopItem: ShoppingItem) => {
    const preset = PRESET_ITEMS.find(p => p.name.toLowerCase() === shopItem.name.toLowerCase());
    const shelfLife = preset ? preset.defaultShelfLife : 7;

    const newPantryItem: PantryItem = {
      id: Date.now().toString(),
      name: shopItem.name,
      shelfLifeDays: shelfLife,
      dateAdded: getLocalDateString(),
      status: 'active',
      markedAt: null,
      category: shopItem.category || getItemCategory(shopItem.name)
    };

    const updatedItems = [newPantryItem, ...items];
    setItems(updatedItems);
    DbService.saveItems(updatedItems);

    const updatedList = shoppingList.filter(s => s.id !== shopItem.id);
    setShoppingList(updatedList);
    DbService.saveShoppingList(updatedList);

    // Mascot animation & XP reward
    setMascotAnimationState('celebrate');
    setTimeout(() => setMascotAnimationState('idle'), 2500);

    setUser(prevUser => {
      let newXp = prevUser.currentXp + 20;
      let newLevel = prevUser.currentLevel;
      if (newXp >= 100) {
        newXp -= 100;
        newLevel += 1;
      }
      const updated = { ...prevUser, currentXp: newXp, currentLevel: newLevel };
      DbService.saveUser(updated);
      return updated;
    });

    setXpFloatPopup('+20 XP');
    setTimeout(() => setXpFloatPopup(null), 1500);
    setToastMessage(`🎉 Bought ${shopItem.name}! Added to Pantry & +20 XP!`);
  };


  const handleDeleteShoppingItem = (id: string) => {
    const updated = shoppingList.filter(s => s.id !== id);
    setShoppingList(updated);
    DbService.saveShoppingList(updated);
  };





  // Quests Checklist & 24h Daily Reset State
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [dailyQuestsState, setDailyQuestsState] = useState<{
    lastGeneratedAt: number;
    quests: any[];
    completedQuestIds: string[];
    allCompletedAt: number | null;
  }>(() => {
    const loaded = DbService.loadDailyQuests();
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const activeItems = DbService.loadItems().filter((i) => i.status === 'active');

    if (!loaded || !loaded.quests || loaded.quests.length === 0) {
      const newQuests = getDynamicPantryQuests(activeItems);
      const newState = {
        lastGeneratedAt: now,
        quests: newQuests,
        completedQuestIds: [],
        allCompletedAt: null
      };
      DbService.saveDailyQuests(newState);
      return newState;
    }

    // Check if 24 hours have passed since all quests were completed
    if (loaded.allCompletedAt && (now - loaded.allCompletedAt >= TWENTY_FOUR_HOURS)) {
      const newQuests = getDynamicPantryQuests(activeItems);
      const newState = {
        lastGeneratedAt: now,
        quests: newQuests,
        completedQuestIds: [],
        allCompletedAt: null
      };
      DbService.saveDailyQuests(newState);
      return newState;
    }

    return loaded;
  });

  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0);

  const animTimerRef = useRef<any>(null);

  // Live 24-hour Countdown Timer (Starts AFTER all quests are completed)
  useEffect(() => {
    const updateTimer = () => {
      if (!dailyQuestsState.allCompletedAt) {
        setTimeRemainingSeconds(0);
        return;
      }

      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const nextReset = dailyQuestsState.allCompletedAt + TWENTY_FOUR_HOURS;
      const diff = Math.max(0, Math.floor((nextReset - now) / 1000));

      if (diff <= 0) {
        const activeItems = DbService.loadItems().filter((i) => i.status === 'active');
        const newQuests = getDynamicPantryQuests(activeItems);
        const newState = {
          lastGeneratedAt: now,
          quests: newQuests,
          completedQuestIds: [],
          allCompletedAt: null
        };
        DbService.saveDailyQuests(newState);
        setDailyQuestsState(newState);
        setCheckedIngredients({});
        setToastMessage('🌅 24h timer completed! New daily quests are now available!');
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        setTimeRemainingSeconds(diff);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [dailyQuestsState.allCompletedAt]);

  const formatCountdown = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  };

  // Sync state to local storage on modification & schedule push notifications
  const syncState = () => {
    const loadedUser = DbService.loadUser();
    const loadedItems = DbService.loadItems();
    const loadedQuests = DbService.loadQuests();
    const loadedSettings = DbService.loadSettings();
    setUser(loadedUser);
    setItems(loadedItems);
    setQuests(loadedQuests);
    NotificationService.scheduleExpiryNotifications(loadedItems, loadedSettings, loadedUser);

    // Auto-sync item edits, additions, and deletions to cloud tied to user's deviceId & household
    if (loadedSettings.householdCode) {
      const activeDeviceId = deviceId || localStorage.getItem('simmer_device_id') || undefined;
      HybridSyncService.pushItemsToCloud(loadedSettings.householdCode, loadedItems, activeDeviceId);
    }
  };

  useEffect(() => {
    NotificationService.requestPermissions();
    NotificationService.scheduleExpiryNotifications(items, settings, user);
  }, []);

  // --- INITIAL CHECK ON MOUNT ---
  useEffect(() => {
    DbService.updateQuestStatus();

    // Streak validation
    const today = getLocalDateString();
    if (user.streakDays > 0 && user.lastActionDate) {
      const diff = getDaysDifference(user.lastActionDate, today);
      if (diff > 1) {
        setIsStreakAlert(true);
      }
    }
  }, []);

  // Mascot dynamic state calculation based on health
  useEffect(() => {
    if (mascotAnimationState === 'idle' || mascotAnimationState === 'sad') {
      if (user.mascotHealth < 50) {
        setMascotAnimationState('sad');
      } else {
        setMascotAnimationState('idle');
      }
    }
  }, [user.mascotHealth]);

  // Mascot temporary animations helper
  const triggerMascotAnimation = (targetState: MascotState, durationMs: number) => {
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    setMascotAnimationState(targetState);
    animTimerRef.current = setTimeout(() => {
      setMascotAnimationState(user.mascotHealth < 50 ? 'sad' : 'idle');
    }, durationMs);
  };

  // Feedback helper when item is added
  const triggerItemAddedFeedback = (itemName: string, itemId?: string) => {
    setToastMessage(`✨ ${itemName} added to pantry!`);
    setXpFloatPopup('+25 XP');
    if (itemId) setLastAddedItemId(itemId);
    triggerMascotAnimation('happy', 1500);

    setTimeout(() => {
      setToastMessage(null);
      setXpFloatPopup(null);
    }, 2200);
  };

  // Claim Quest Reward
  const handleClaimQuestXp = (questId: string, rewardXp: number) => {
    if (dailyQuestsState.completedQuestIds.includes(questId)) return;

    const updatedCompletedIds = [...dailyQuestsState.completedQuestIds, questId];
    const isAllFinished = updatedCompletedIds.length === dailyQuestsState.quests.length && dailyQuestsState.quests.length > 0;
    const completionTime = isAllFinished ? Date.now() : dailyQuestsState.allCompletedAt;

    const updatedState = {
      ...dailyQuestsState,
      completedQuestIds: updatedCompletedIds,
      allCompletedAt: completionTime
    };
    DbService.saveDailyQuests(updatedState);
    setDailyQuestsState(updatedState);

    const updatedUser = { ...user };
    let newXp = updatedUser.currentXp + rewardXp;
    let newLevel = updatedUser.currentLevel;

    if (newXp >= 100) {
      newLevel += Math.floor(newXp / 100);
      newXp = newXp % 100;
      triggerMascotAnimation('celebrate', 2500);
    } else {
      triggerMascotAnimation('happy', 1500);
    }

    updatedUser.currentXp = newXp;
    updatedUser.currentLevel = newLevel;
    DbService.saveUser(updatedUser);
    setUser(updatedUser);

    triggerConfettiEffect();
    triggerMascotAnimation('celebrate', 3000);

    if (isAllFinished) {
      setShowCompletionModal(true);
    } else {
      setToastMessage(`🏆 Quest Completed! +${rewardXp} XP Earned! 🎉`);
      setTimeout(() => setToastMessage(null), 2500);
    }

    setXpFloatPopup(`+${rewardXp} XP`);
    setTimeout(() => {
      setXpFloatPopup(null);
    }, 2500);
  };



  // --- ACTIONS ---

  // In-App Live Camera Capture Handler (Zero Activity Destruction)
  const handleCapturedPhotoFromInAppCamera = async (base64Data: string) => {
    setShowInAppCamera(false);
    if (!base64Data) return;

    try {
      setScannedImageBase64(base64Data);
      setIsScanning(true);
      setScanStatus({ message: '⚡ Optimizing photo & scanning packet label...', type: 'info' });

      const result = await scanPacketExpiryDate(base64Data, 'image/jpeg', settings.geminiApiKey);
      setIsScanning(false);

      if (result.itemName && !chosenItemName) {
        setChosenItemName(result.itemName);
      }

      if (result.success && result.daysFromToday) {
        setCustomShelfLife(result.daysFromToday);
        setScanStatus({
          message: `🎯 Verified Expiry Date: ${result.detectedText || result.expiryDate} (${result.daysFromToday} days left)!`,
          type: 'success'
        });
      } else {
        setScanStatus({
          message: result.error || 'Expiry date unclear or missing. Please select/adjust the expiry date manually below.',
          type: 'warning'
        });
      }
    } catch (err: any) {
      console.error('Error scanning captured photo:', err);
      setIsScanning(false);
      setScanStatus({
        message: 'Could not process photo. Please enter expiry date manually.',
        type: 'warning'
      });
    }
  };

  // Step 1 direct camera scan button
  const handleDirectScanFromStep1 = () => {
    setChosenItemName('');
    setAddItemStep(2);
    setShowInAppCamera(true);
  };

  // Step 1 preset select
  const handleSelectPreset = (preset: PresetItem) => {
    setChosenItemName(preset.name);
    setCustomShelfLife(Math.max(1, preset.defaultShelfLife));
    setAddItemStep(2);
  };

  // Step 1 custom name submit
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const cleanName = sanitizeText(customName.trim());
    const val = InputValidator.validateFoodName(cleanName);
    if (!val.valid) {
      alert(val.error);
      return;
    }
    const defaultLife = cleanName.toLowerCase().includes('egg') ? 21 : cleanName.toLowerCase().includes('chicken') ? 3 : 5;
    setChosenItemName(cleanName);
    setCustomShelfLife(defaultLife);
    setAddItemStep(2);
  };

  // Step 2 final Add Item submit
  const handleFinalAddItem = () => {
    if (isSubmitting || !chosenItemName) return;
    const sanitizedName = sanitizeText(chosenItemName);
    const valName = InputValidator.validateFoodName(sanitizedName);
    if (!valName.valid) {
      alert(valName.error);
      return;
    }
    const valLife = InputValidator.validateShelfLife(customShelfLife);
    if (!valLife.valid) {
      alert(valLife.error);
      return;
    }
    setIsSubmitting(true);
    try {
      const result = DbService.addItem(sanitizedName, customShelfLife);
      if (!result.success) {
        alert(result.error);
        return;
      }
      syncState();
      const name = sanitizedName;
      setCustomName('');
      setChosenItemName('');
      setCustomShelfLife(5);
      setScannedImageBase64(null);
      setScanStatus(null);
      setAddItemStep(1);
      setShowAddModal(false);
      localStorage.removeItem('simmer_pending_item_name');
      localStorage.removeItem('simmer_pending_shelf_life');
      triggerItemAddedFeedback(name, result.item?.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetModal = () => {
    setShowAddModal(false);
    setAddItemStep(1);
    setCustomName('');
    setChosenItemName('');
    setScannedImageBase64(null);
    setScanStatus(null);
    localStorage.removeItem('simmer_pending_item_name');
    localStorage.removeItem('simmer_pending_shelf_life');
  };

  // Native & Web Gallery Photo Picker Handler
  const handleGalleryPick = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
        width: 1200,
        height: 1200
      });

      if (image && image.webPath) {
        setIsScanning(true);
        setScanStatus({ message: '⚡ Optimizing photo & scanning packet label...', type: 'info' });
        const res = await fetch(image.webPath);
        const blob = await res.blob();
        const file = new File([blob], 'gallery_photo.jpg', { type: blob.type || 'image/jpeg' });
        const compressedBase64 = await compressImage(file, 1600, 1600, 0.90);
        setScannedImageBase64(compressedBase64);

        const result = await scanPacketExpiryDate(compressedBase64, 'image/jpeg', settings.geminiApiKey, image.path || image.webPath);
        setIsScanning(false);

        if (result.itemName && !chosenItemName) {
          setChosenItemName(result.itemName);
        }

        if (result.success && result.daysFromToday) {
          setCustomShelfLife(result.daysFromToday);
          setScanStatus({
            message: `🎯 Verified Expiry Date: ${result.detectedText || result.expiryDate} (${result.daysFromToday} days left)!`,
            type: 'success'
          });
        } else {
          setScanStatus({
            message: result.error || 'Expiry date unclear or missing. Please select/adjust the expiry date manually below.',
            type: 'warning'
          });
        }
      }
    } catch (err: any) {
      console.log('Native gallery picker fallback to web input:', err);
      if (galleryInputRef.current) {
        galleryInputRef.current.value = '';
        galleryInputRef.current.click();
      }
    }
  };

  // Packet Photo Upload & Optical Extraction Handler (Web Fallback)
  const handlePacketPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const val = InputValidator.validateUploadedImage(file);
    if (!val.valid) {
      alert(val.error);
      if (e.target) e.target.value = '';
      return;
    }

    setIsScanning(true);
    setScanStatus({ message: '⚡ Optimizing photo & scanning packet label...', type: 'info' });

    try {
      const compressedBase64 = await compressImage(file, 1600, 1600, 0.90);
      setScannedImageBase64(compressedBase64);

      const result = await scanPacketExpiryDate(compressedBase64, 'image/jpeg', settings.geminiApiKey);
      setIsScanning(false);

      if (result.success && result.daysFromToday) {
        setCustomShelfLife(result.daysFromToday);
        setScanStatus({
          message: `🎯 Verified Expiry Date: ${result.detectedText || result.expiryDate} (${result.daysFromToday} days left)!`,
          type: 'success'
        });
      } else {
        setScanStatus({
          message: result.error || 'Expiry date unclear or missing. Please select/adjust the expiry date manually below.',
          type: 'warning'
        });
      }
    } catch (err) {
      console.error('Error compressing/scanning packet photo:', err);
      setIsScanning(false);
      setScanStatus({
        message: 'Could not process photo. Please enter expiry date manually.',
        type: 'warning'
      });
    }
  };

  const handleConsume = (id: string) => {
    const result = DbService.consumeItem(id);
    if (result.success) {
      syncState();
      setSelectedItem(null);
      if (result.levelUp) {
        triggerMascotAnimation('celebrate', 2500);
      } else {
        triggerMascotAnimation('happy', 1200);
      }
    }
  };

  const handleSpoil = (id: string) => {
    const result = DbService.spoilItem(id);
    if (result.success) {
      syncState();
      setSelectedItem(null);
      triggerMascotAnimation('hurt', 1200);
      showToast('🗑️ Marked item as Spoiled', 'warning', () => {
        const unspoilRes = DbService.unspoilItem(id);
        if (unspoilRes.success) {
          syncState();
          showToast('✅ Restored item to active!', 'success');
        }
      }, 5000);
    }
  };

  const handleDelete = (id: string) => {
    DbService.deleteItem(id, settings.householdCode || undefined);
    syncState();
    setSelectedItem(null);
  };

  const handleExtendShelfLife = (id: string, days: number) => {
    if (selectedItem) {
      const updatedDays = selectedItem.shelfLifeDays + days;
      DbService.editShelfLife(id, updatedDays);
      setSelectedItem({ ...selectedItem, shelfLifeDays: updatedDays });
      syncState();
    }
  };

  const handleReviveStreak = () => {
    const result = DbService.reviveStreak();
    if (result.success) {
      setIsStreakAlert(false);
      syncState();
      triggerMascotAnimation('celebrate', 2000);
    } else {
      alert(result.error);
    }
  };

  const handleIgnoreStreak = () => {
    const updatedUser = { ...user, streakDays: 0, lastActionDate: getLocalDateString() };
    DbService.saveUser(updatedUser);
    setUser(updatedUser);
    setIsStreakAlert(false);
  };




  // Watch rewarded ad simulation
  const handleWatchAd = () => {
    setShowAdModal(true);
    setAdTimer(5);
  };

  useEffect(() => {
    if (adTimer === null) return;
    if (adTimer === 0) {
      DbService.addStreakShields(50);
      syncState();
      setShowAdModal(false);
      setAdTimer(null);
      triggerMascotAnimation('happy', 1500);
      return;
    }
    const interval = setTimeout(() => {
      setAdTimer(adTimer - 1);
    }, 1000);
    return () => clearTimeout(interval);
  }, [adTimer]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const result = await BackupService.importBackup(files[0]);
      if (result.success) {
        alert('Data successfully imported!');
        syncState();
      } else {
        alert(`Import failed: ${result.error}`);
      }
    }
  };

  // Calculate status badge style matching Stitch Screen 2
  const getItemStatusBadge = (item: PantryItem) => {
    const today = getLocalDateString();
    const dateAddedStr = item.dateAdded.substring(0, 10);
    const elapsed = getDaysDifference(dateAddedStr, today);
    const remaining = item.shelfLifeDays - elapsed;

    if (remaining <= 0) return { label: 'EXPIRED', class: 'badge-expired', accentClass: 'accent-expired', days: remaining };
    if (remaining <= 3) return { label: `${remaining} DAY LEFT`, class: 'badge-warning', accentClass: 'accent-warning', days: remaining };
    if (remaining >= 365) return { label: '🏷️ LONG LIFE', class: 'badge-safe', accentClass: 'accent-safe', days: '365+' };
    return { label: `${remaining} DAYS LEFT`, class: 'badge-safe', accentClass: 'accent-safe', days: remaining };
  };

  // Preset icon mapping
  const getItemIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('milk')) return '🥛';
    if (lower.includes('bread')) return '🍞';
    if (lower.includes('yogurt')) return '🍶';
    if (lower.includes('egg')) return '🥚';
    if (lower.includes('apple') || lower.includes('fruit')) return '🍎';
    if (lower.includes('cheese')) return '🧀';
    if (lower.includes('chicken')) return '🍗';
    return '🥫';
  };

  // Dark mode effect
  useEffect(() => {
    if (settings.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [settings.darkMode]);

  const getMascotOutfit = (): MascotOutfit => {
    if (user.customOutfit && user.customOutfit !== 'auto') {
      return user.customOutfit === 'none' ? 'none' : user.customOutfit;
    }
    if (user.currentLevel >= 15) return 'astronaut';
    if (user.currentLevel >= 10) return 'crown';
    if (user.currentLevel >= 5) return 'chef';
    return 'none';
  };




  const handleSaveMascotName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = InputValidator.validateMascotName(mascotNameInput);
    if (!val.valid) {
      alert(val.error);
      return;
    }
    const cleanName = sanitizeText(mascotNameInput.trim());
    const updatedUser = { ...user, mascotName: cleanName };
    DbService.saveUser(updatedUser);
    setUser(updatedUser);
    setMascotAnimationState('celebrate');
    setTimeout(() => setMascotAnimationState('idle'), 2500);
    setToastMessage(`✨ Mascot renamed to "${cleanName}"!`);
    setShowRenameModal(false);
  };

  const handleToggleDarkMode = () => {
    const nextMode = !settings.darkMode;
    if (nextMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    requestAnimationFrame(() => {
      const updatedSettings = { ...settings, darkMode: nextMode };
      DbService.saveSettings(updatedSettings);
      setSettings(updatedSettings);
    });
  };

  const handleToggleNotifications = async () => {
    if (!settings.notificationEnabled) {
      await requestNotificationPermissionWithPrompt();
      setToastMessage('🔔 Push notifications enabled!');
      setTimeout(() => setToastMessage(null), 2500);
    } else {
      const updatedSettings = { ...settings, notificationEnabled: false };
      DbService.saveSettings(updatedSettings);
      setSettings(updatedSettings);
      NotificationService.scheduleExpiryNotifications(items, updatedSettings, user);
      setToastMessage('🔕 Notifications turned off.');
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  const handleNotificationTimeChange = (index: number, newTime: string) => {
    const val = InputValidator.validateNotificationTime(newTime);
    if (!val.valid) {
      alert(val.error);
      return;
    }
    const currentTimes = [...(settings.notificationTimes || [settings.notificationTime || '08:00'])];
    currentTimes[index] = newTime;
    const updatedSettings = { 
      ...settings, 
      notificationTime: currentTimes[0], 
      notificationTimes: currentTimes 
    };
    DbService.saveSettings(updatedSettings);
    setSettings(updatedSettings);
    NotificationService.scheduleExpiryNotifications(items, updatedSettings, user);
  };

  const handleAddNotificationTime = () => {
    const currentTimes = [...(settings.notificationTimes || [settings.notificationTime || '08:00'])];
    const nextTimes = ['12:00', '18:00', '21:00', '09:00', '15:00'];
    const unusedTime = nextTimes.find(t => !currentTimes.includes(t)) || '12:00';
    currentTimes.push(unusedTime);
    const updatedSettings = { 
      ...settings, 
      notificationTimes: currentTimes 
    };
    DbService.saveSettings(updatedSettings);
    setSettings(updatedSettings);
    NotificationService.scheduleExpiryNotifications(items, updatedSettings, user);
    setToastMessage('⏰ New reminder time added!');
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleDeleteNotificationTime = (index: number) => {
    const currentTimes = [...(settings.notificationTimes || [settings.notificationTime || '08:00'])];
    if (currentTimes.length <= 1) {
      alert('You must keep at least 1 reminder time active!');
      return;
    }
    currentTimes.splice(index, 1);
    const updatedSettings = { 
      ...settings, 
      notificationTime: currentTimes[0], 
      notificationTimes: currentTimes 
    };
    DbService.saveSettings(updatedSettings);
    setSettings(updatedSettings);
    NotificationService.scheduleExpiryNotifications(items, updatedSettings, user);
  };


  const handleConfirmResetAllData = () => {
    localStorage.clear();
    window.location.reload();
  };

  const toggleCheckIngredient = (ingKey: string) => {
    setCheckedIngredients((prev) => ({ ...prev, [ingKey]: !prev[ingKey] }));
  };


  return (
    <div className={`app-container tab-${activeTab}`}>
      {/* Party Confetti Particle Canvas */}
      {showConfetti && <ConfettiCanvas />}

      {/* Floating Success / Notification Toast Banner */}
      {toast && (
        <div className={`toast-stitch toast-${toast.type || 'info'}`}>
          <span>{toast.message}</span>
          {toast.undoAction && (
            <button
              type="button"
              className="toast-undo-btn"
              onClick={() => {
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                const action = toast.undoAction;
                setToast(null);
                if (action) action();
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Floating XP Number Pop-up */}
      {xpFloatPopup && <div className="xp-float-popup">{xpFloatPopup}</div>}

      <div className="content-area">
        
        {/* Streak Alert Banner */}
        {isStreakAlert && (
          <div className="card-stitch" style={{ borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 6px 0', color: 'var(--danger)' }}>🔥 Streak in Danger!</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px' }}>
              Your <strong>{user.streakDays}-day</strong> streak was broken! Revive it for 50 Shields.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-stitch-primary" onClick={handleReviveStreak} style={{ padding: '8px', fontSize: '12px' }}>
                Use 50 Shields 🛡️
              </button>
              <button className="btn-stitch-secondary" onClick={handleWatchAd} style={{ padding: '8px', fontSize: '12px' }}>
                Watch Ad (+50 🛡️)
              </button>
              <button className="btn-stitch-secondary" onClick={handleIgnoreStreak} style={{ padding: '8px', fontSize: '12px', border: 'none', boxShadow: 'none' }}>
                Reset
              </button>
            </div>
          </div>
        )}

        {/* ================= 1. HOME SCREEN (STITCH SCREEN 1) ================= */}
            {activeTab === 'home' && (
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', justifyContent: 'space-between' }}>
                <div>
                  <div className="top-header-stitch">
                    <div className="top-header-title">SIMMER</div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {settings.householdCode && (
                        <div className="streak-pill-stitch" style={{ backgroundColor: '#10b981', color: '#ffffff' }}>
                          👨‍👩‍👧 {settings.householdCode}
                        </div>
                      )}
                      <div 
                        className="streak-pill-stitch"
                        title={`${user.streakDays}-day active streak! Tap to view details.`}
                        onClick={() => showToast(`🔥 ${user.streakDays}-day streak! Consume or add 1 item daily to keep it burning!`, 'info')}
                        style={{ cursor: 'pointer' }}
                      >
                        {user.streakDays}d streak 🔥
                      </div>
                    </div>
                  </div>

              {/* Stitch Hero Mascot Stage with Overlapping Card */}
              <Mascot
                name={user.mascotName}
                health={user.mascotHealth}
                level={user.currentLevel}
                xp={user.currentXp}
                outfit={getMascotOutfit()}
                state={mascotAnimationState}
                rankTitle={getCurrentHeroRank(user.currentLevel).title}
                rankIcon={getCurrentHeroRank(user.currentLevel).icon}
              />

              {/* 💰 LOCAL FINANCIAL SAVINGS & FOOD WASTE IMPACT CARD */}
              {(() => {
                const daysBack = savingsTimeframe === 'week' ? 7 : savingsTimeframe === 'month' ? 30 : 3650;
                const savingsData = calculateFinancialSavings(items, settings, daysBack);
                const currInfo = getCurrencyInfo(settings.currency || 'INR');

                return (
                  <div
                    className="card-stitch"
                    style={{
                      marginTop: '20px',
                      padding: '16px 18px',
                      background: settings.darkMode ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)',
                      border: '2px solid #10b981',
                      boxShadow: '0 8px 24px -4px rgba(16, 185, 129, 0.2)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '22px' }}>💰</span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                            Food Waste Savings
                          </h3>
                          <div style={{ fontSize: '10px', color: '#10b981', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Local Currency: {currInfo.name}
                          </div>
                        </div>
                      </div>

                      {/* Timeframe Selector Pills */}
                      <div style={{ display: 'flex', gap: '4px', backgroundColor: settings.darkMode ? '#0f172a' : '#ffffff', padding: '3px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                        <button
                          style={{
                            border: 'none',
                            padding: '3px 8px',
                            fontSize: '10px',
                            fontWeight: '800',
                            borderRadius: '7px',
                            cursor: 'pointer',
                            backgroundColor: savingsTimeframe === 'week' ? '#10b981' : 'transparent',
                            color: savingsTimeframe === 'week' ? '#ffffff' : (settings.darkMode ? '#94a3b8' : '#64748b')
                          }}
                          onClick={() => setSavingsTimeframe('week')}
                        >
                          7 Days
                        </button>
                        <button
                          style={{
                            border: 'none',
                            padding: '3px 8px',
                            fontSize: '10px',
                            fontWeight: '800',
                            borderRadius: '7px',
                            cursor: 'pointer',
                            backgroundColor: savingsTimeframe === 'month' ? '#10b981' : 'transparent',
                            color: savingsTimeframe === 'month' ? '#ffffff' : (settings.darkMode ? '#94a3b8' : '#64748b')
                          }}
                          onClick={() => setSavingsTimeframe('month')}
                        >
                          30 Days
                        </button>
                      </div>
                    </div>

                    {/* Big Money Display */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div>
                        <div style={{ fontSize: '28px', fontWeight: '900', color: '#10b981', letterSpacing: '-0.02em', lineHeight: 1 }}>
                          {savingsData.formattedSavings}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: settings.darkMode ? '#cbd5e1' : '#475569', marginTop: '4px' }}>
                          Saved from {savingsData.count} rescued groceries {savingsTimeframe === 'week' ? 'this week' : 'this month'}! 🥗
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* 2 Clean Action Options Pushed Down Towards End of Frame with Comfortable Spacing */}
            <div style={{ marginTop: '32px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <button 
                className="btn-stitch-primary" 
                onClick={() => setShowAddModal(true)} 
                style={{ padding: '16px', fontSize: '17px' }}
              >
                <span>⚡</span> + Add Pantry Item
              </button>

              <button 
                className="btn-stitch-secondary" 
                onClick={() => setActiveTab('pantry')} 
                style={{ padding: '14px', fontSize: '15px', borderRadius: '16px' }}
              >
                <span>🧺</span> Open My Pantry ({items.filter(i => i.status === 'active').length} active)
              </button>
            </div>
          </div>
        )}





        {/* ================= 2. PANTRY SCREEN (STITCH SCREEN 2) ================= */}
        {activeTab === 'pantry' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#1e1b4b' }}>My Pantry</h1>
                <div style={{ fontSize: '13px', color: settings.darkMode ? '#94a3b8' : '#64748b', fontWeight: '600', marginTop: '2px' }}>
                  [ {items.filter(i => i.status === 'active').length} active ]
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn-stitch-secondary"
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    backgroundColor: pantryViewMode === 'list' ? '#2563eb' : (settings.darkMode ? '#1e293b' : '#ffffff'),
                    color: pantryViewMode === 'list' ? '#ffffff' : (settings.darkMode ? '#cbd5e1' : '#475569')
                  }}
                  onClick={() => setPantryViewMode('list')}
                >
                  📋 List
                </button>
                <button
                  className="btn-stitch-secondary"
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    backgroundColor: pantryViewMode === 'calendar' ? '#2563eb' : (settings.darkMode ? '#1e293b' : '#ffffff'),
                    color: pantryViewMode === 'calendar' ? '#ffffff' : (settings.darkMode ? '#cbd5e1' : '#475569')
                  }}
                  onClick={() => setPantryViewMode('calendar')}
                >
                  📅 7-Day Schedule
                </button>
                <button
                  className="btn-stitch-secondary"
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    backgroundColor: isBulkSelectMode ? '#3b49df' : (settings.darkMode ? '#1e293b' : '#ffffff'),
                    color: isBulkSelectMode ? '#ffffff' : (settings.darkMode ? '#f8fafc' : '#0f172a'),
                    borderColor: isBulkSelectMode ? '#2563eb' : undefined
                  }}
                  onClick={() => {
                    setIsBulkSelectMode(!isBulkSelectMode);
                    setSelectedItemIds([]);
                  }}
                >
                  {isBulkSelectMode ? 'Cancel' : '☑️ Select'}
                </button>
              </div>
            </div>

            {/* Real-Time Search Bar */}
            <div style={{ marginTop: '12px', marginBottom: '8px', position: 'relative' }}>
              <input
                type="text"
                className="input-stitch"
                placeholder="🔍 Search pantry items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '10px 36px 10px 14px',
                  fontSize: '13px',
                  fontWeight: '700',
                  borderRadius: '14px'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer',
                    opacity: 0.6
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', margin: '6px 0 10px 0', overflowX: 'auto', paddingBottom: '4px' }}>
              {/* Sort Pill */}
              <button 
                className="btn-stitch-secondary" 
                style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', backgroundColor: sortOrder !== 'urgency' ? (settings.darkMode ? '#1e3a8a' : '#dbeafe') : (settings.darkMode ? '#1e293b' : '#ffffff') }}
                onClick={() => setSortOrder(prev => prev === 'urgency' ? 'name' : prev === 'name' ? 'dateAdded' : 'urgency')}
              >
                <span>📊</span> Sort: {sortOrder === 'urgency' ? 'Urgency' : sortOrder === 'name' ? 'Name (A-Z)' : 'Date Added'}
              </button>

              {/* Category Filter Pill */}
              <button 
                className="btn-stitch-secondary" 
                style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', backgroundColor: selectedCategory !== 'All' ? (settings.darkMode ? '#1e3a8a' : '#dbeafe') : (settings.darkMode ? '#1e293b' : '#ffffff') }}
                onClick={() => { setShowCategoryDropdown(!showCategoryDropdown); setShowFilterDropdown(false); }}
              >
                <span>🏷️</span> {selectedCategory === 'All' ? 'All Categories' : selectedCategory} ▾
              </button>

              {/* Status Filter Pill */}
              <button 
                className="btn-stitch-secondary" 
                style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap', backgroundColor: selectedFilter !== 'all' ? (settings.darkMode ? '#1e3a8a' : '#dbeafe') : (settings.darkMode ? '#1e293b' : '#ffffff') }}
                onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowCategoryDropdown(false); }}
              >
                <span>🔍</span> {selectedFilter === 'all' ? 'Filter' : selectedFilter.toUpperCase()} ▾
              </button>
            </div>

            {/* CATEGORY DROPDOWN MENU */}
            {showCategoryDropdown && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '6px 0', marginBottom: '10px' }}>
                {['All', 'Dairy', 'Produce', 'Bakery', 'Meat', 'Pantry'].map((cat) => (
                  <button
                    key={cat}
                    className="btn-stitch-secondary"
                    style={{
                      padding: '4px 12px',
                      fontSize: '11px',
                      backgroundColor: selectedCategory === cat ? '#3b49df' : (settings.darkMode ? '#1e293b' : '#ffffff'),
                      color: selectedCategory === cat ? '#ffffff' : (settings.darkMode ? '#f8fafc' : '#1e293b')
                    }}
                    onClick={() => { setSelectedCategory(cat); setShowCategoryDropdown(false); }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* STATUS FILTER DROPDOWN MENU */}
            {showFilterDropdown && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '6px 0', marginBottom: '10px' }}>
                {[
                  { id: 'all', label: 'All Statuses' },
                  { id: 'urgent', label: '⚠️ Expiring Soon (<= 3d)' },
                  { id: 'expired', label: '🔴 Expired' },
                  { id: 'safe', label: '🟢 Safe (> 3d)' }
                ].map((flt) => (
                  <button
                    key={flt.id}
                    className="btn-stitch-secondary"
                    style={{
                      padding: '4px 12px',
                      fontSize: '11px',
                      backgroundColor: selectedFilter === flt.id ? '#3b49df' : (settings.darkMode ? '#1e293b' : '#ffffff'),
                      color: selectedFilter === flt.id ? '#ffffff' : (settings.darkMode ? '#f8fafc' : '#1e293b')
                    }}
                    onClick={() => { setSelectedFilter(flt.id as any); setShowFilterDropdown(false); }}
                  >
                    {flt.label}
                  </button>
                ))}
              </div>
            )}


            {/* 7-DAY WEEKLY EXPIRY SCHEDULE GRID VIEW */}
            {pantryViewMode === 'calendar' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                {Array.from({ length: 7 }).map((_, dayIndex) => {
                  const targetDate = new Date();
                  targetDate.setDate(targetDate.getDate() + dayIndex);
                  const dateStr = getLocalDateString(targetDate);
                  const displayDayLabel = dayIndex === 0 ? 'Today' : dayIndex === 1 ? 'Tomorrow' : targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                  // Items expiring on this specific target date
                  const dayItems = items.filter(i => {
                    if (i.status !== 'active') return false;
                    const expiryDateIso = new Date(new Date(i.dateAdded).getTime() + i.shelfLifeDays * 86400000);
                    return getLocalDateString(expiryDateIso) === dateStr;
                  });

                  return (
                    <div
                      key={dayIndex}
                      className="card-stitch"
                      style={{
                        padding: '14px 16px',
                        borderLeft: dayIndex === 0 ? '4px solid #ef4444' : dayIndex === 1 ? '4px solid #f97316' : '4px solid #3b82f6',
                        backgroundColor: dayIndex === 0 ? (settings.darkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2') : undefined
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontWeight: '900', fontSize: '14px', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                          📅 {displayDayLabel}
                        </div>
                        <span className={`badge-stitch ${dayItems.length > 0 ? (dayIndex === 0 ? 'badge-danger' : 'badge-warning') : 'badge-safe'}`}>
                          {dayItems.length} {dayItems.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      {dayItems.length === 0 ? (
                        <div style={{ fontSize: '12px', color: settings.darkMode ? '#94a3b8' : '#64748b', fontStyle: 'italic' }}>
                          No items expiring on this day ✨
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {dayItems.map(item => (
                            <div
                              key={item.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 10px',
                                background: settings.darkMode ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '10px',
                                cursor: 'pointer'
                              }}
                              onClick={() => setSelectedItem(item)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '13px' }}>
                                <span>{getItemIcon(item.name)}</span>
                                <span>{item.name}</span>
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563eb' }}>
                                View Details ➔
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : items.filter(i => i.status === 'active').length === 0 ? (
              <div className="card-stitch" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <span style={{ fontSize: '40px' }}>🥫</span>
                <h3 style={{ margin: '10px 0 5px 0' }}>Your pantry is empty!</h3>
                <p style={{ margin: 0, fontSize: '13px', opacity: 0.7 }}>Tap Add Item to log your groceries.</p>
              </div>
            ) : (
              <div>
                {items
                  .filter((i) => i.status === 'active')
                  .filter((item) => {
                    // Search Query Filter
                    if (searchQuery.trim().length > 0) {
                      if (!item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())) {
                        return false;
                      }
                    }
                    // Category Filter
                    if (selectedCategory !== 'All') {
                      const itemCat = item.category || getItemCategory(item.name);
                      if (itemCat !== selectedCategory) return false;
                    }
                    // Status Filter
                    const badge = getItemStatusBadge(item);
                    const daysNum = typeof badge.days === 'number' ? badge.days : 999;
                    if (selectedFilter === 'urgent' && (daysNum > 3 || daysNum <= 0)) return false;
                    if (selectedFilter === 'expired' && daysNum > 0) return false;
                    if (selectedFilter === 'safe' && daysNum <= 3) return false;
                    return true;
                  })
                  .sort((a, b) => {
                    if (sortOrder === 'name') return a.name.localeCompare(b.name);
                    if (sortOrder === 'dateAdded') return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
                    // Default: Urgency (fewest days left first)
                    const daysA = typeof getItemStatusBadge(a).days === 'number' ? (getItemStatusBadge(a).days as number) : 999;
                    const daysB = typeof getItemStatusBadge(b).days === 'number' ? (getItemStatusBadge(b).days as number) : 999;
                    return daysA - daysB;
                  })
                  .map((item) => {
                    const badge = getItemStatusBadge(item);
                    const isNew = item.id === lastAddedItemId;
                    const isSelected = selectedItemIds.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`pantry-card-stitch ${badge.accentClass} ${isNew ? 'pantry-card-new-pop' : ''}`}
                        style={{
                          borderColor: isSelected ? '#2563eb' : undefined,
                          backgroundColor: isSelected ? (settings.darkMode ? '#1e3a8a' : '#eff6ff') : undefined
                        }}
                        onClick={() => {
                          if (isBulkSelectMode) {
                            toggleSelectItem(item.id);
                          } else {
                            setSelectedItem(item);
                          }
                        }}
                      >
                        <div className="pantry-card-left">
                          {isBulkSelectMode && (
                            <div className={`checkbox-box ${isSelected ? 'checked' : ''}`} style={{ marginRight: '10px' }}>
                              {isSelected ? '✓' : ''}
                            </div>
                          )}
                          <div className="pantry-card-icon">
                            {getItemIcon(item.name)}
                          </div>
                          <div className="pantry-card-info">
                            <div className="pantry-card-title">{item.name}</div>
                            <div className="pantry-card-sub">
                              Use By: {formatDisplayDate(item.dateAdded, item.shelfLifeDays)}
                            </div>
                          </div>
                        </div>

                        <span className={`badge-stitch ${badge.class}`}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* FLOATING BULK ACTIONS BAR */}
            {isBulkSelectMode && selectedItemIds.length > 0 && (
              <div
                style={{
                  position: 'sticky',
                  bottom: '80px',
                  zIndex: 50,
                  backgroundColor: settings.darkMode ? '#1e293b' : '#ffffff',
                  border: '2px solid #2563eb',
                  borderRadius: '18px',
                  padding: '12px 16px',
                  boxShadow: '0 12px 30px rgba(37, 99, 235, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '16px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                  {selectedItemIds.length} Selected
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn-stitch-primary"
                    style={{ padding: '8px 14px', fontSize: '12px', width: 'auto', backgroundColor: '#22c55e' }}
                    onClick={handleBulkConsume}
                  >
                    😋 Consume All
                  </button>
                  <button
                    className="btn-stitch-primary"
                    style={{ padding: '8px 14px', fontSize: '12px', width: 'auto', backgroundColor: '#ef4444' }}
                    onClick={handleBulkSpoil}
                  >
                    🤢 Mark Spoiled
                  </button>
                </div>
              </div>
            )}

            {/* Quick Presets Grid matching Stitch Screen 2 Bottom */}
            <div style={{ marginTop: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', marginBottom: '10px', color: '#475569' }}>
                QUICK ADD
              </div>
              <div className="preset-grid-stitch">
                {PRESET_ITEMS.slice(1, 4).map((preset) => (
                  <div key={preset.name} className="preset-card-stitch" onClick={() => { handleSelectPreset(preset); setShowAddModal(true); }}>
                    <span className="preset-card-icon">{preset.icon}</span>
                    <span className="preset-card-name">{preset.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating Action Pills Bar matching Stitch Screen 2 */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px', marginBottom: '20px' }}>
              <button className="btn-stitch-secondary" onClick={() => setShowAddModal(true)}>
                <span>✔️</span> Consumed
              </button>
              <button className="btn-stitch-secondary" onClick={() => setShowAddModal(true)}>
                <span>🗑️</span> Spoiled
              </button>
              <button className="btn-stitch-secondary" onClick={() => setShowAddModal(true)}>
                <span>⌛</span> Extend
              </button>
            </div>

            {/* COMBINED FEATURE: 🛒 SMART SHOPPING LIST & 📜 RESCUE HISTORY LOG */}
            <div className="card-stitch" style={{ padding: '18px', marginTop: '20px' }}>
              {/* Tab Selector Header */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  className="btn-stitch-secondary"
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '13px',
                    fontWeight: '900',
                    backgroundColor: pantrySubTab === 'shopping' ? '#3b49df' : '#ffffff',
                    color: pantrySubTab === 'shopping' ? '#ffffff' : '#1e293b'
                  }}
                  onClick={() => setPantrySubTab('shopping')}
                >
                  🛒 Grocery List ({shoppingList.length})
                </button>

                <button
                  className="btn-stitch-secondary"
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '13px',
                    fontWeight: '900',
                    backgroundColor: pantrySubTab === 'history' ? '#3b49df' : '#ffffff',
                    color: pantrySubTab === 'history' ? '#ffffff' : '#1e293b'
                  }}
                  onClick={() => setPantrySubTab('history')}
                >
                  📜 Rescue History Log
                </button>
              </div>

              {/* 1. SHOPPING LIST SUB-TAB */}
              {pantrySubTab === 'shopping' && (
                <div>
                  {/* Add Grocery Item Input */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <input
                      type="text"
                      placeholder="Add item (e.g. Milk, Eggs, Bread)..."
                      value={newShoppingItemName}
                      onChange={(e) => setNewShoppingItemName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddShoppingItem()}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        border: '2.5px solid #1e293b',
                        borderRadius: '12px',
                        fontFamily: 'inherit',
                        fontSize: '13px',
                        fontWeight: '700'
                      }}
                    />
                    <button
                      className="btn-stitch-primary"
                      onClick={() => handleAddShoppingItem()}
                      style={{ width: 'auto', padding: '0 16px', fontSize: '13px' }}
                    >
                      + Add
                    </button>
                  </div>

                  {/* Shopping Items List */}
                  {shoppingList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 10px', color: '#64748b' }}>
                      <div style={{ fontSize: '28px', marginBottom: '4px' }}>🛒</div>
                      <div style={{ fontSize: '13px', fontWeight: '800' }}>Your Grocery List is empty!</div>
                      <div style={{ fontSize: '11px', marginTop: '2px' }}>Type an item above to plan your next grocery trip.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {shoppingList.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',

                            alignItems: 'center',
                            backgroundColor: '#f8fafc',
                            border: '2px solid #1e293b',
                            borderRadius: '12px',
                            padding: '10px 12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '20px' }}>{getItemIcon(item.name)}</span>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{item.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>{item.category || getItemCategory(item.name)}</div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              className="btn-stitch-primary"
                              onClick={() => handleMarkBoughtItem(item)}
                              style={{
                                padding: '6px 12px',
                                fontSize: '11px',
                                width: 'auto',
                                backgroundColor: '#16a34a',
                                borderColor: '#14532d'
                              }}
                            >
                              Bought It! (+20 XP) ➔
                            </button>
                            <button
                              className="btn-stitch-secondary"
                              onClick={() => handleDeleteShoppingItem(item.id)}
                              style={{ padding: '6px 8px', fontSize: '11px', backgroundColor: '#f1f5f9' }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 2. FOOD RESCUE HISTORY LOG SUB-TAB */}
              {pantrySubTab === 'history' && (
                <div>
                  {/* Summary Stats Badges */}
                  {(() => {
                    const consumedCount = items.filter(i => i.status === 'consumed').length;
                    const spoiledCount = items.filter(i => i.status === 'spoiled').length;
                    const totalProcessed = consumedCount + spoiledCount;
                    const rescueRate = totalProcessed > 0 ? Math.round((consumedCount / totalProcessed) * 100) : 100;

                    return (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px', textAlign: 'center' }}>
                          <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #16a34a', borderRadius: '10px', padding: '6px' }}>
                            <div style={{ fontSize: '16px', fontWeight: '900', color: '#15803d' }}>{consumedCount}</div>
                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#166534' }}>Rescued 🥗</div>
                          </div>

                          <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #ef4444', borderRadius: '10px', padding: '6px' }}>
                            <div style={{ fontSize: '16px', fontWeight: '900', color: '#b91c1c' }}>{spoiledCount}</div>
                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#991b1b' }}>Spoiled 🔴</div>
                          </div>

                          <div style={{ backgroundColor: '#eff6ff', border: '1.5px solid #2563eb', borderRadius: '10px', padding: '6px' }}>
                            <div style={{ fontSize: '16px', fontWeight: '900', color: '#1d4ed8' }}>{rescueRate}%</div>
                            <div style={{ fontSize: '10px', fontWeight: '800', color: '#1e40af' }}>Rescue Rate 🌟</div>
                          </div>
                        </div>

                        {/* History Log Items */}
                        {items.filter(i => i.status !== 'active').length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px 10px', color: '#64748b' }}>
                            <div style={{ fontSize: '28px', marginBottom: '4px' }}>📜</div>
                            <div style={{ fontSize: '13px', fontWeight: '800' }}>No History Yet!</div>
                            <div style={{ fontSize: '11px', marginTop: '2px' }}>Items you mark Consumed or Spoiled will appear here.</div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {items
                              .filter(i => i.status !== 'active')
                              .slice(0, 10)
                              .map((pastItem) => (
                                <div
                                  key={pastItem.id}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',

                                    alignItems: 'center',
                                    backgroundColor: pastItem.status === 'consumed' ? '#f0fdf4' : '#fef2f2',
                                    border: `2px solid ${pastItem.status === 'consumed' ? '#16a34a' : '#ef4444'}`,
                                    borderRadius: '12px',
                                    padding: '8px 12px'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '20px' }}>{getItemIcon(pastItem.name)}</span>
                                    <div>
                                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{pastItem.name}</div>
                                      <div style={{ fontSize: '10px', color: pastItem.status === 'consumed' ? '#15803d' : '#b91c1c', fontWeight: '700' }}>
                                        {pastItem.status === 'consumed' ? '✔️ Rescued' : '🔴 Spoiled'} • {formatDisplayDate(pastItem.markedAt || pastItem.dateAdded)}
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    className="btn-stitch-secondary"
                                    onClick={() => {
                                      handleAddShoppingItem(pastItem.name);
                                      setToastMessage(`🛒 Added ${pastItem.name} to Grocery List!`);
                                    }}
                                    style={{ padding: '4px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                  >
                                    Restock 🛒
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}




        {/* ================= 3. HERO QUEST BOARD (STITCH SCREEN 3) ================= */}
        {activeTab === 'quests' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                ⚔️ Hero Quest Board
              </h1>
              <div style={{ fontSize: '13px', fontWeight: '700', color: settings.darkMode ? '#94a3b8' : '#64748b' }}>
                Complete daily bounties, raid challenges & unlock trophies!
              </div>
            </div>

            {/* Sub-Tabs Switcher */}
            <div className="quest-subtab-container">
              <button 
                className={`quest-subtab-btn ${questSubTab === 'daily' ? 'active' : ''}`}
                onClick={() => setQuestSubTab('daily')}
              >
                ⚔️ Daily Bounties
              </button>
              <button 
                className={`quest-subtab-btn ${questSubTab === 'raid' ? 'active' : ''}`}
                onClick={() => setQuestSubTab('raid')}
              >
                🛡️ Weekly Raid
              </button>
              <button 
                className={`quest-subtab-btn ${questSubTab === 'achievements' ? 'active' : ''}`}
                onClick={() => setQuestSubTab('achievements')}
              >
                🏆 Achievements
              </button>
            </div>

            {/* SUB-TAB 1: DAILY FOOD WASTE BOUNTIES */}
            {questSubTab === 'daily' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                    Today's Rescue Bounties
                  </div>
                  <div className="glowing-timer-badge" style={{ margin: 0, padding: '4px 10px', fontSize: '11px' }}>
                    <span>⏱️ Resets In:</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{formatCountdown(timeRemainingSeconds)}</span>
                  </div>
                </div>

                {/* Render Dynamic Quests based on Persisted Daily State */}
                {(() => {
                  const activeQuests = dailyQuestsState.quests;
                  const completedIds = dailyQuestsState.completedQuestIds;
                  const allCompleted = activeQuests.length > 0 && completedIds.length === activeQuests.length;

                  if (activeQuests.length === 0) {
                    return (
                      <div className="card-stitch" style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <span style={{ fontSize: '40px' }}>🍳</span>
                        <h3 style={{ margin: '10px 0 5px 0' }}>No Active Bounties!</h3>
                        <p style={{ margin: 0, fontSize: '13px', opacity: 0.7 }}>Add food items to your pantry to unlock rescue cooking quests!</p>
                      </div>
                    );
                  }

                  return (
                    <div>
                      {allCompleted && (
                        <div className="card-stitch" style={{
                          background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                          border: '2.5px solid #16a34a',
                          padding: '18px 16px',
                          textAlign: 'center',
                          marginBottom: '20px'
                        }}>
                          <div style={{ fontSize: '32px', marginBottom: '4px' }}>🎉🏆</div>
                          <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '900', color: '#14532d' }}>
                            All Daily Bounties Completed!
                          </h2>
                          <p style={{ margin: 0, fontSize: '13px', color: '#166534', fontWeight: '700' }}>
                            Great job! Tomorrow new bounties will be available in {formatCountdown(timeRemainingSeconds)}.
                          </p>
                        </div>
                      )}

                      {activeQuests.map((quest) => {
                        const checkedCount = quest.ingredients.filter((_: any, idx: number) => checkedIngredients[`${quest.id}_${idx}`]).length;
                        const totalCount = quest.ingredients.length;
                        const isCompleted = completedIds.includes(quest.id);
                        const isAllChecked = isCompleted || checkedCount === totalCount;

                        return (
                          <div key={quest.id} className="card-stitch" style={{ padding: '20px', marginBottom: '16px', opacity: isCompleted ? 0.9 : 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span style={{ fontSize: '28px' }}>{quest.icon || '🍳'}</span>
                                <div>
                                  <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                                    {quest.title}
                                  </h2>
                                  {quest.difficulty && (
                                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      ⭐ {quest.difficulty} QUEST
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className={`badge-stitch ${isCompleted ? 'badge-safe' : 'badge-purple'}`}>
                                {isCompleted ? '✔️ Claimed' : `+${quest.xpReward} XP`}
                              </span>
                            </div>

                            <p style={{ margin: '14px 0 16px 0', fontSize: '14px', lineHeight: '1.4', color: settings.darkMode ? '#cbd5e1' : '#334155' }}>
                              <strong>{quest.recipeName}:</strong> {quest.instruction}
                            </p>

                            <div style={{ fontWeight: '800', fontSize: '14px', marginBottom: '10px', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                              Ingredients Checklist
                            </div>

                            {quest.ingredients.map((ing: any, idx: number) => {
                              const itemKey = `${quest.id}_${idx}`;
                              const isChecked = isCompleted || !!checkedIngredients[itemKey];

                              return (
                                <div
                                  key={itemKey}
                                  className="quest-checklist-item"
                                  style={{ cursor: isCompleted ? 'default' : 'pointer' }}
                                  onClick={() => !isCompleted && toggleCheckIngredient(itemKey)}
                                >
                                  <div className={`checkbox-box ${isChecked ? 'checked' : ''}`}>
                                    {isChecked ? '✓' : ''}
                                  </div>
                                  <span style={{ textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1, fontWeight: ing.inPantry ? '800' : '600' }}>
                                    {ing.name}
                                  </span>
                                </div>
                              );
                            })}

                            <div 
                              style={{ 
                                marginTop: '16px', 
                                height: '34px', 
                                backgroundColor: settings.darkMode ? '#1e293b' : '#f1f5f9', 
                                border: `2.5px solid ${settings.darkMode ? '#334155' : '#1e293b'}`, 
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '800',
                                fontSize: '13px',
                                position: 'relative',
                                overflow: 'hidden'
                              }}
                            >
                              <div 
                                style={{ 
                                  position: 'absolute', 
                                  left: 0, 
                                  top: 0, 
                                  height: '100%', 
                                  width: isCompleted ? '100%' : `${(checkedCount / totalCount) * 100}%`, 
                                  backgroundColor: isAllChecked ? '#4ade80' : '#86efac', 
                                  transition: 'width 0.3s ease',
                                  zIndex: 1 
                                }}
                              ></div>
                              <span style={{ zIndex: 2, color: '#0f172a' }}>
                                {isCompleted ? '🏆 Bounty Claimed (+75 XP Secured)' : `${checkedCount}/${totalCount} Ingredients Prepared`}
                              </span>
                            </div>

                            {isAllChecked && !isCompleted && (
                              <button
                                className="btn-stitch-primary"
                                style={{ marginTop: '14px', backgroundColor: '#22c55e' }}
                                onClick={() => handleClaimQuestXp(quest.id, quest.xpReward)}
                              >
                                🎉 Claim +{quest.xpReward} XP Reward!
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* SUB-TAB 2: WEEKLY BOSS RAID */}
            {questSubTab === 'raid' && (
              <div>
                {(() => {
                  const raid = QuestService.getWeeklyRaid(items);
                  const progressPct = Math.min(100, Math.round((raid.currentCount / raid.targetCount) * 100));

                  return (
                    <div className="card-stitch" style={{ padding: '20px', background: settings.darkMode ? 'rgba(18, 24, 38, 0.85)' : 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <span style={{ fontSize: '42px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}>{raid.icon}</span>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '900', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            ⭐ WEEKLY BOSS RAID
                          </div>
                          <h2 style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                            {raid.title}
                          </h2>
                        </div>
                      </div>

                      <p style={{ fontSize: '13px', lineHeight: '1.5', color: settings.darkMode ? '#cbd5e1' : '#475569', margin: '0 0 16px 0' }}>
                        {raid.description}
                      </p>

                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', marginBottom: '6px' }}>
                          <span>Raid Progress</span>
                          <span style={{ color: raid.isCompleted ? '#16a34a' : '#3b82f6' }}>
                            {raid.currentCount} / {raid.targetCount} Items Rescued
                          </span>
                        </div>
                        <div style={{ height: '12px', backgroundColor: settings.darkMode ? '#334155' : '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: settings.darkMode ? 'rgba(30, 41, 59, 0.8)' : '#f8fafc', border: `1.5px solid ${settings.darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '14px', padding: '12px 14px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: settings.darkMode ? '#94a3b8' : '#64748b' }}>
                          Raid Victory Bounty:
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span className="badge-stitch badge-purple">+{raid.xpReward} XP</span>
                          <span className="badge-stitch badge-safe">+{raid.shieldReward} Shield 🛡️</span>
                        </div>
                      </div>

                      {raid.isCompleted ? (
                        <div style={{ textAlign: 'center', padding: '10px', color: '#16a34a', fontWeight: '900', fontSize: '14px' }}>
                          🏆 Raid Completed! Bonus Shield & XP Secured!
                        </div>
                      ) : (
                        <button className="btn-stitch-primary" onClick={() => handleTabSwitch('pantry')}>
                          🥗 Rescue Pantry Items Now ➔
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* SUB-TAB 3: UNLOCKABLE ACHIEVEMENTS & TROPHIES */}
            {questSubTab === 'achievements' && (
              <div>
                {(() => {
                  const unlockedIds = QuestService.getUnlockedAchievements(user, items, settings);

                  return (
                    <div>
                      <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: '800', color: settings.darkMode ? '#94a3b8' : '#64748b', marginBottom: '14px' }}>
                        🏆 Unlocked: {unlockedIds.length} / {ALL_ACHIEVEMENTS.length} Trophies
                      </div>

                      <div className="achievement-grid-stitch">
                        {ALL_ACHIEVEMENTS.map(ach => {
                          const isUnlocked = unlockedIds.includes(ach.id);
                          let currentProgress = 0;
                          if (ach.id.startsWith('streak_')) currentProgress = Math.min(user.streakDays, ach.targetCount);
                          else if (ach.id.startsWith('rescue_')) currentProgress = Math.min(items.filter(i => i.status === 'consumed').length, ach.targetCount);
                          else if (ach.id.startsWith('pantry_')) currentProgress = Math.min(items.length, ach.targetCount);
                          else if (ach.id === 'household_sync') currentProgress = settings.householdCode ? 1 : 0;

                          const progressPct = Math.min(100, Math.round((currentProgress / ach.targetCount) * 100));

                          return (
                            <div 
                              key={ach.id} 
                              className={`achievement-card-stitch ${isUnlocked ? 'unlocked' : 'locked'}`}
                              onClick={() => setSelectedAchievement(ach)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="achievement-badge-icon">{ach.icon}</div>
                              <div className="achievement-title" style={{ color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>{ach.title}</div>
                              <div className="achievement-desc">{ach.description}</div>
                              
                              <div className="achievement-progress-bar">
                                <div className="achievement-progress-fill" style={{ width: `${progressPct}%` }} />
                              </div>
                              <div style={{ fontSize: '10px', fontWeight: '800', color: isUnlocked ? '#10b981' : '#94a3b8', marginTop: '6px' }}>
                                {isUnlocked ? `✔️ Unlocked (+${ach.xpReward} XP)` : `${currentProgress}/${ach.targetCount}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}



        {/* ================= 4. SETTINGS & CONTROLS SCREEN ================= */}
        {activeTab === 'settings' && (
          <div>
            <h1 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: '900', textAlign: 'center', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
              ⚙️ Settings & Controls
            </h1>

            {/* 1. HERO USER PROFILE & STATS SUMMARY CARD */}
            <div className="card-stitch" style={{ padding: '20px', background: settings.darkMode ? 'rgba(18, 24, 38, 0.75)' : 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: settings.darkMode ? '#1e3a8a' : '#dbeafe',
                  border: `2px solid ${settings.darkMode ? '#3b82f6' : '#93c5fd'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '36px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  👾
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>{user.mascotName}</h2>
                    <span className="badge-stitch badge-purple">Lvl {user.currentLevel}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: settings.darkMode ? '#94a3b8' : '#64748b', fontWeight: '700', marginTop: '2px' }}>
                    {user.currentXp}/100 XP to next level
                  </div>
                </div>
              </div>


              {/* Stats Summary Pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '16px' }}>
                <div style={{ backgroundColor: settings.darkMode ? '#0f172a' : '#ffffff', border: `1.5px solid ${settings.darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '12px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: settings.darkMode ? '#94a3b8' : '#64748b' }}>STREAK</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#ea580c' }}>{user.streakDays}d 🔥</div>
                </div>
                <div style={{ backgroundColor: settings.darkMode ? '#0f172a' : '#ffffff', border: `1.5px solid ${settings.darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '12px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: settings.darkMode ? '#94a3b8' : '#64748b' }}>SHIELDS</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#2563eb' }}>{user.streakShields} 🛡️</div>
                </div>
                <div style={{ backgroundColor: settings.darkMode ? '#0f172a' : '#ffffff', border: `1.5px solid ${settings.darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '12px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: settings.darkMode ? '#94a3b8' : '#64748b' }}>RESCUED</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#16a34a' }}>{user.totalItemsConsumed} 🥗</div>
                </div>
              </div>

              {/* Rename Mascot Pencil Button & Save Button */}
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-stitch-secondary"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    padding: 0,
                    backgroundColor: settings.darkMode ? '#1e293b' : '#ffffff'
                  }}
                  onClick={() => {
                    setMascotNameInput(user.mascotName);
                    setShowRenameModal(true);
                  }}
                  title="Rename Mascot"
                >
                  ✏️
                </button>

                <button
                  type="button"
                  className="btn-stitch-primary"
                  style={{ flex: 1, padding: '12px', fontSize: '14px' }}
                  onClick={() => {
                    setMascotNameInput(user.mascotName);
                    setShowRenameModal(true);
                  }}
                >
                  Save / Rename Mascot
                </button>
              </div>
            </div>



            {/* 2. HERO RANK & PROGRESSION SYSTEM (10 RANKS) */}
            <div className="card-stitch" style={{ padding: '18px' }}>
              {(() => {
                const currentRank = getCurrentHeroRank(user.currentLevel);
                const nextRank = getNextHeroRank(user.currentLevel);

                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '22px' }}>🏆</span>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                          HERO RANK TIERS
                        </h3>
                      </div>

                      <span
                        className="badge-stitch"
                        style={{
                          backgroundColor: currentRank.badgeColor,
                          color: '#ffffff',
                          fontWeight: '900',
                          fontSize: '11px',
                          padding: '4px 10px'
                        }}
                      >
                        {currentRank.icon} {currentRank.title}
                      </span>
                    </div>

                    {/* Progress to Next Rank Banner */}
                    {nextRank ? (
                      <div style={{ backgroundColor: settings.darkMode ? '#0f172a' : '#f8fafc', border: `1.5px solid ${settings.darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '12px', padding: '10px 12px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', marginBottom: '4px', color: settings.darkMode ? '#cbd5e1' : '#334155' }}>
                          <span>Next Rank: {nextRank.icon} {nextRank.title}</span>
                          <span>Lvl {user.currentLevel} / {nextRank.minLevel}</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: settings.darkMode ? '#1e293b' : '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, Math.max(0, (user.currentLevel / nextRank.minLevel) * 100))}%`,
                              backgroundColor: '#3b49df',
                              borderRadius: '4px',
                              transition: 'width 0.3s ease'
                            }}
                          ></div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ backgroundColor: settings.darkMode ? '#064e3b' : '#f0fdf4', border: '1.5px solid #16a34a', borderRadius: '12px', padding: '8px 12px', marginBottom: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '800', color: settings.darkMode ? '#86efac' : '#15803d' }}>
                        🌌 MAX RANK ACHIEVED: Cosmic Food Deity!
                      </div>
                    )}

                    {/* Grid of 10 Ranks */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '10px' }}>
                      {HERO_RANKS.map((rank) => {
                        const isCurrent = currentRank.tier === rank.tier;
                        const isUnlocked = user.currentLevel >= rank.minLevel;

                        return (
                          <div
                            key={rank.tier}
                            style={{
                              backgroundColor: isCurrent 
                                ? (settings.darkMode ? 'rgba(30, 58, 138, 0.7)' : '#eff6ff') 
                                : isUnlocked 
                                  ? (settings.darkMode ? '#1e293b' : '#ffffff') 
                                  : (settings.darkMode ? '#0b0f19' : '#f8fafc'),
                              border: isCurrent 
                                ? '2px solid #2563eb' 
                                : isUnlocked 
                                  ? `1px solid ${settings.darkMode ? '#475569' : '#cbd5e1'}` 
                                  : `1px dashed ${settings.darkMode ? '#334155' : '#cbd5e1'}`,
                              borderRadius: '14px',
                              padding: '12px 14px',
                              opacity: isUnlocked ? 1 : 0.65,
                              boxShadow: isCurrent ? '0 4px 14px rgba(37, 99, 235, 0.25)' : 'none',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '26px' }}>{rank.icon}</span>
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: '900', color: isCurrent ? (settings.darkMode ? '#f8fafc' : '#1e3a8a') : (settings.darkMode ? '#f8fafc' : '#0f172a') }}>
                                    Tier {rank.tier}: {rank.title}
                                  </div>
                                  <div style={{ fontSize: '11px', color: isCurrent ? (settings.darkMode ? '#bfdbfe' : '#1e40af') : (settings.darkMode ? '#cbd5e1' : '#64748b'), fontWeight: '600', marginTop: '1px' }}>
                                    {rank.description}
                                  </div>
                                </div>
                              </div>

                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: '900',
                                  padding: '4px 8px',
                                  borderRadius: '8px',
                                  whiteSpace: 'nowrap',
                                  backgroundColor: isCurrent ? '#2563eb' : isUnlocked ? (settings.darkMode ? '#064e3b' : '#dcfce7') : (settings.darkMode ? '#0f172a' : '#f1f5f9'),
                                  color: isCurrent ? '#ffffff' : isUnlocked ? (settings.darkMode ? '#86efac' : '#15803d') : (settings.darkMode ? '#94a3b8' : '#64748b')
                                }}
                              >
                                {isCurrent ? 'CURRENT' : isUnlocked ? '✔️ UNLOCKED' : `🔒 Lvl ${rank.minLevel}`}
                              </span>
                            </div>

                            {/* Tier Perk Pill */}
                            <div
                              style={{
                                backgroundColor: isCurrent 
                                  ? (settings.darkMode ? '#1e40af' : '#dbeafe') 
                                  : isUnlocked 
                                    ? (settings.darkMode ? '#064e3b' : '#f0fdf4') 
                                    : (settings.darkMode ? '#0f172a' : '#f1f5f9'),
                                border: `1px solid ${isCurrent ? '#3b82f6' : isUnlocked ? (settings.darkMode ? '#15803d' : '#86efac') : (settings.darkMode ? '#334155' : '#cbd5e1')}`,
                                borderRadius: '8px',
                                padding: '6px 10px',
                                fontSize: '11px',
                                fontWeight: '800',
                                color: isCurrent 
                                  ? (settings.darkMode ? '#ffffff' : '#1e40af') 
                                  : isUnlocked 
                                    ? (settings.darkMode ? '#86efac' : '#166534') 
                                    : (settings.darkMode ? '#94a3b8' : '#475569'),
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <span>🎁 Perk:</span>
                              <span>{rank.perk}</span>
                            </div>
                          </div>



                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 2.5 FAMILY HOUSEHOLD CLOUD SYNC CARD */}
            <div className="card-stitch" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <span style={{ fontSize: '22px' }}>👨‍👩‍👧</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                    Family Household Cloud Sync
                  </h3>
                  <div style={{ fontSize: '11px', color: settings.darkMode ? '#cbd5e1' : '#64748b' }}>
                    Pair phones with spouses & roommates to share real-time pantry updates!
                  </div>
                </div>
              </div>

              {settings.householdCode ? (
                <div style={{ backgroundColor: settings.darkMode ? '#064e3b' : '#f0fdf4', border: '1.5px solid #10b981', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      🟢 Paired Group Active
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#047857', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '999px' }}>
                      👥 {householdMemberCount} / 6 Members
                    </span>
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: '900', letterSpacing: '0.06em', margin: '4px 0', color: settings.darkMode ? '#86efac' : '#166534' }}>
                    {settings.householdCode}
                  </div>
                  <div style={{ fontSize: '12px', color: settings.darkMode ? '#cbd5e1' : '#475569', marginBottom: '12px' }}>
                    All connected members share 1 unified pantry system in real time.
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button
                      className="btn-stitch-primary"
                      style={{ padding: '8px 14px', fontSize: '12px' }}
                      onClick={() => {
                        navigator.clipboard.writeText(settings.householdCode || '');
                        setToastMessage(`📋 Copied code ${settings.householdCode}!`);
                        setTimeout(() => setToastMessage(null), 2000);
                      }}
                    >
                      📋 Copy Code
                    </button>
                    <button
                      className="btn-stitch-secondary"
                      style={{ padding: '8px 14px', fontSize: '12px' }}
                      onClick={handleManualCloudSync}
                      disabled={isSyncingCloud}
                    >
                      {isSyncingCloud ? 'Syncing...' : '🔄 Sync Now'}
                    </button>
                    <button
                      className="btn-stitch-secondary"
                      style={{ padding: '8px 14px', fontSize: '12px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                      onClick={handleLeaveHousehold}
                    >
                      🚪 Leave
                    </button>
                  </div>

                  {deviceId && (
                    <div style={{ marginTop: '10px', fontSize: '10px', color: settings.darkMode ? '#94a3b8' : '#64748b', fontFamily: 'monospace' }}>
                      Device ID: {deviceId}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    className="btn-stitch-primary"
                    style={{ padding: '12px', fontSize: '14px' }}
                    onClick={handleCreateHousehold}
                    disabled={isSyncingCloud}
                  >
                    {isSyncingCloud ? 'Creating...' : '🔑 Create New Household (Get Code)'}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <input
                      type="text"
                      placeholder="Enter 6-digit code (e.g. SIM-8492)"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value)}
                      className="input-stitch"
                      style={{ flex: 1, padding: '10px 12px', fontSize: '13px', textTransform: 'uppercase' }}
                    />
                    <button
                      className="btn-stitch-secondary"
                      style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '800' }}
                      onClick={handleJoinHousehold}
                      disabled={isSyncingCloud || !joinCodeInput.trim()}
                    >
                      {isSyncingCloud ? 'Joining...' : '🔗 Join'}
                    </button>
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
                    Max 6 members per household group • 0 login/signup required
                  </div>
                </div>
              )}
            </div>

            {/* 2.8 ACCOUNT & DEVICE RECOVERY CARD (0 LOGIN REQUIRED) */}
            <div className="card-stitch" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '22px' }}>🛡️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                    Zero-Login Account Protection
                  </h3>
                  <div style={{ fontSize: '11px', color: settings.darkMode ? '#cbd5e1' : '#64748b' }}>
                    1-tap recovery key to restore your profile & household on any new phone!
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: settings.darkMode ? '#1e293b' : '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '4px' }}>
                  YOUR PERSONAL RECOVERY KEY:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: '900', color: '#3b82f6', letterSpacing: '0.05em' }}>
                    {DeviceService.getRecoveryKey(deviceId)}
                  </span>
                  <button
                    type="button"
                    className="btn-stitch-primary"
                    style={{ padding: '6px 12px', fontSize: '11px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(DeviceService.getRecoveryKey(deviceId));
                      setToastMessage('📋 Recovery key copied to clipboard!');
                      setTimeout(() => setToastMessage(null), 2000);
                    }}
                  >
                    📋 Copy Key
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '6px' }}>
                  RECOVER DATA ON NEW DEVICE:
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Enter Recovery Key or Device ID"
                    value={recoveryKeyInput}
                    onChange={(e) => setRecoveryKeyInput(e.target.value)}
                    className="input-stitch"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '12px', textTransform: 'uppercase' }}
                  />
                  <button
                    type="button"
                    className="btn-stitch-secondary"
                    onClick={handleRestoreFromKey}
                    disabled={!recoveryKeyInput.trim()}
                    style={{ padding: '8px 14px', fontSize: '12px', fontWeight: '800' }}
                  >
                    🔄 Restore
                  </button>
                </div>
              </div>
            </div>

            {/* 3. PREFERENCES & THEME CARD */}

            <div className="card-stitch" style={{ padding: '0 18px' }}>
              {/* Theme Selector Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1.5px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontWeight: '800' }}>
                  <span style={{ fontSize: '20px' }}>{settings.darkMode ? '🌙' : '☀️'}</span> Theme Style
                </div>
                <button 
                  className="btn-stitch-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px', backgroundColor: settings.darkMode ? '#334155' : '#ffffff', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}
                  onClick={handleToggleDarkMode}
                >
                  {settings.darkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </button>
              </div>

              {/* Local Currency Preference Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1.5px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontWeight: '800' }}>
                  <span style={{ fontSize: '20px' }}>💱</span> Local Currency
                </div>
                <select
                  value={settings.currency || 'INR'}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="btn-stitch-secondary"
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    backgroundColor: settings.darkMode ? '#1e293b' : '#ffffff',
                    color: settings.darkMode ? '#f8fafc' : '#0f172a'
                  }}
                >
                  {SUPPORTED_CURRENCIES.map(curr => (
                    <option key={curr.code} value={curr.code}>
                      {curr.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Master Notifications On/Off Toggle Row */}
              <div style={{ padding: '16px 0', borderBottom: '1.5px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontWeight: '800', fontSize: '14px', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                      <span style={{ fontSize: '20px' }}>🔔</span> App & Expiry Notifications
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {settings.notificationEnabled ? 'Alerts for expiring items & daily quests are active' : 'Notifications are off. You will not receive alerts.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={settings.notificationEnabled ? 'btn-stitch-primary' : 'btn-stitch-secondary'}
                    style={{
                      padding: '6px 16px',
                      fontSize: '12px',
                      fontWeight: '900',
                      backgroundColor: settings.notificationEnabled ? '#16a34a' : '#64748b',
                      color: '#ffffff',
                      borderColor: settings.notificationEnabled ? '#15803d' : '#475569'
                    }}
                    onClick={handleToggleNotifications}
                  >
                    {settings.notificationEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                {settings.notificationEnabled && (
                  <div style={{ marginTop: '10px', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn-stitch-secondary"
                      style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '800', backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                      onClick={handleSendTestNotification}
                    >
                      🔔 Test Notification (3s)
                    </button>
                  </div>
                )}
              </div>

              {/* Multi-Reminder Times List */}
              {settings.notificationEnabled && (
                <div style={{ padding: '16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a' }}>
                      ⏰ Reminder Times ({settings.notificationTimes?.length || 1})
                    </div>
                    <button 
                      className="btn-stitch-secondary"
                      style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                      onClick={handleAddNotificationTime}
                    >
                      + Add Time
                    </button>
                  </div>

                  {(settings.notificationTimes || [settings.notificationTime || '08:00']).map((timeVal, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1.5px solid #cbd5e1' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569' }}>
                        Alert #{idx + 1}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="time"
                          className="input-stitch"
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '13px' }}
                          value={timeVal}
                          onChange={(e) => handleNotificationTimeChange(idx, e.target.value)}
                        />
                        {(settings.notificationTimes?.length || 1) > 1 && (
                          <button
                            className="btn-stitch-secondary"
                            style={{ padding: '4px 8px', fontSize: '12px', color: '#ef4444', border: 'none', boxShadow: 'none' }}
                            onClick={() => handleDeleteNotificationTime(idx)}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* 5. HELP & GUIDE ACCORDION */}
            <div className="card-stitch" style={{ padding: '16px' }}>
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setShowHelpAccordion(!showHelpAccordion)}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontWeight: '800' }}>
                  <span style={{ fontSize: '20px' }}>❓</span> How Pantry RPG Works
                </div>
                <span style={{ fontSize: '16px', fontWeight: '900' }}>{showHelpAccordion ? '▲' : '▼'}</span>
              </div>

              {showHelpAccordion && (
                <div style={{ marginTop: '12px', fontSize: '13px', lineHeight: '1.5', color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                  <p><strong>1. Log Pantry Items:</strong> Tap <em>+ Add Item</em>. Fresh produce uses smart defaults; packaged items let you enter or adjust dates.</p>
                  <p><strong>2. Complete Quests:</strong> Check off ingredients you cook to earn +75 XP and power up Sproutling!</p>
                  <p><strong>3. Maintain Streaks:</strong> Consume or log 1 item daily to keep your flame streak burning.</p>
                  
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ cursor: 'pointer', color: '#3b82f6', fontWeight: '800' }} onClick={() => BackupService.exportBackup()}>
                      📥 Export Backup
                    </span>
                    <label style={{ cursor: 'pointer', color: '#3b82f6', fontWeight: '800' }}>
                      📤 Import Backup
                      <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
                    </label>
                    <span style={{ cursor: 'pointer', color: '#ef4444', fontWeight: '800' }} onClick={() => setShowResetConfirmModal(true)}>
                      ⚠️ Reset Data
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontWeight: '700', margin: '20px 0 10px 0' }}>
              Simmer v1.2.0 • Offline Ready 🚀 • © {new Date().getFullYear()} SIMMERS
            </div>
          </div>
        )}

      </div>

      {/* ================= STITCH STYLED BOTTOM NAVIGATION BAR ================= */}
      <div className="bottom-nav-stitch">
        <button 
          className={`nav-tab-stitch ${activeTab === 'home' ? 'active' : ''}`} 
          onClick={() => handleTabSwitch('home')}
        >
          <div className="nav-tab-icon-wrapper">🏡</div>
          <span className="nav-tab-label">Home</span>
        </button>

        <button 
          className={`nav-tab-stitch ${activeTab === 'pantry' ? 'active' : ''}`} 
          onClick={() => handleTabSwitch('pantry')}
        >
          <div className="nav-tab-icon-wrapper">🧺</div>
          <span className="nav-tab-label">Pantry</span>
        </button>

        <button 
          className={`nav-tab-stitch ${activeTab === 'quests' ? 'active' : ''}`} 
          onClick={() => handleTabSwitch('quests')}
        >
          <div className="nav-tab-icon-wrapper">📋</div>
          <span className="nav-tab-label">Quests</span>
        </button>

        <button 
          className={`nav-tab-stitch ${activeTab === 'settings' ? 'active' : ''}`} 
          onClick={() => handleTabSwitch('settings')}
        >
          <div className="nav-tab-icon-wrapper">⚙️</div>
          <span className="nav-tab-label">Settings</span>
        </button>
      </div>


      {/* --- ADD ITEM MODAL (2-STEP UN-CHAOTIC FLOW) --- */}
      {showAddModal && (
        <div className="modal-overlay-stitch" onClick={resetModal}>
          <div className="modal-content-stitch" onClick={(e) => e.stopPropagation()}>
            
            {addItemStep === 1 ? (
              /* STEP 1: SELECT OR TYPE ITEM */
              <div>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '18px', fontWeight: '900' }}>Log Pantry Item</h3>
                
                <button
                  type="button"
                  className="btn-stitch-primary"
                  style={{ width: '100%', marginBottom: '16px', backgroundColor: '#16a34a', borderColor: '#15803d', padding: '12px', fontSize: '15px' }}
                  onClick={handleDirectScanFromStep1}
                >
                  📷 Scan Packet Photo Directly with Camera
                </button>

                <div style={{ fontSize: '11px', fontWeight: '900', marginBottom: '8px', color: '#64748b' }}>
                  QUICK TAP PRESETS
                </div>
                <div className="preset-grid-stitch">
                  {PRESET_ITEMS.map((preset) => (
                    <div key={preset.name} className="preset-card-stitch" onClick={() => handleSelectPreset(preset)}>
                      <span className="preset-card-icon">{preset.icon}</span>
                      <span className="preset-card-name">{preset.name}</span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleProceedToStep2} style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '900', marginBottom: '6px', color: '#64748b' }}>
                    CUSTOM ITEM
                  </div>
                  <input
                    type="text"
                    placeholder="Type food name (e.g. Pasta, Chips, Sauce)"
                    className="input-stitch"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    required
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="btn-stitch-primary" style={{ flex: 1 }}>
                      Next: Take Photo / Set Expiry 📷 ➔
                    </button>
                    <button type="button" className="btn-stitch-secondary" onClick={resetModal}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* STEP 2: SET EXPIRY FOR SELECTED ITEM */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <button className="btn-stitch-secondary" onClick={() => setAddItemStep(1)} style={{ padding: '4px 10px', fontSize: '12px' }}>
                    ‹ Back
                  </button>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '900' }}>
                    {chosenItemName ? `Set Expiry for "${chosenItemName}"` : 'Scan Packet Expiry'}
                  </h3>
                </div>

                {/* OPTION A: SCAN PACKET PHOTO */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '900', marginBottom: '6px', color: '#64748b' }}>
                    TAKE PHOTO FOR AI EXPIRY & ITEM READ
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-stitch-primary"
                      onClick={() => setShowInAppCamera(true)}
                      style={{ flex: 1, padding: '12px', cursor: 'pointer', textAlign: 'center', backgroundColor: '#16a34a', borderColor: '#15803d', fontSize: '14px' }}
                    >
                      📷 Open Camera
                    </button>
                    <button
                      type="button"
                      className="btn-stitch-secondary"
                      onClick={handleGalleryPick}
                      style={{ flex: 1, padding: '12px', cursor: 'pointer', textAlign: 'center', fontSize: '14px' }}
                    >
                      📁 Gallery / Upload
                    </button>
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePacketPhotoUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>

                {/* Photo Preview & Laser Scanning Animation */}
                {scannedImageBase64 && (
                  <ZoomableImageModal
                    src={scannedImageBase64}
                    isScanning={isScanning}
                  />
                )}

                {/* Scan Status Feedback */}
                {scanStatus && (
                  <div className={`scanner-status-box ${scanStatus.type}`}>
                    {scanStatus.message}
                  </div>
                )}

                {/* OPTION B: MANUAL EXPIRY ADJUSTMENT */}
                <div style={{ marginBottom: '16px', marginTop: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '900', marginBottom: '6px', color: '#64748b' }}>
                    OR ADJUST EXPIRY MANUALLY
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1.5px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '800', marginBottom: '6px' }}>
                      <span>Shelf Life:</span>
                      <span style={{ color: '#3b49df' }}>{customShelfLife} Days Left</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="60"
                      value={customShelfLife}
                      onChange={(e) => setCustomShelfLife(parseInt(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                  </div>
                </div>

                {/* FINAL SUBMIT BUTTON */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn-stitch-primary" onClick={handleFinalAddItem} disabled={isSubmitting} style={{ flex: 1 }}>
                    {isSubmitting ? '⏳ Adding Item...' : `⚡ Add ${chosenItemName ? `"${chosenItemName}"` : 'Item'} to Pantry`}
                  </button>
                  <button type="button" className="btn-stitch-secondary" onClick={resetModal}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* --- ITEM DETAIL MODAL --- */}
      {selectedItem && (
        <div className="modal-overlay-stitch" onClick={() => setSelectedItem(null)}>
          <div className="modal-content-stitch" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900' }}>{selectedItem.name}</h2>
              <span className={`badge-stitch ${getItemStatusBadge(selectedItem).class}`}>
                {getItemStatusBadge(selectedItem).label}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '700', marginBottom: '16px' }}>
              Use By: {formatDisplayDate(selectedItem.dateAdded, selectedItem.shelfLifeDays)} ({getItemStatusBadge(selectedItem).days} days left)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <button 
                className="btn-stitch-primary" 
                onClick={() => handleConsume(selectedItem.id)}
                style={{ backgroundColor: '#22c55e' }}
              >
                😋 Mark Consumed (+XP)
              </button>
              
              <button 
                className="btn-stitch-primary" 
                onClick={() => handleSpoil(selectedItem.id)}
                style={{ backgroundColor: '#ef4444' }}
              >
                🤢 Spoiled / Expired (-10% Health)
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              <button className="btn-stitch-secondary" onClick={() => handleExtendShelfLife(selectedItem.id, 1)} style={{ flex: 1 }}>
                +1d
              </button>
              <button className="btn-stitch-secondary" onClick={() => handleExtendShelfLife(selectedItem.id, 3)} style={{ flex: 1 }}>
                +3d
              </button>
              <button className="btn-stitch-secondary" onClick={() => handleExtendShelfLife(selectedItem.id, 7)} style={{ flex: 1 }}>
                +7d
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn-stitch-secondary" 
                onClick={() => handleStartEditingItem(selectedItem)}
                style={{ flex: 1, backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}
              >
                ✏️ Edit Item
              </button>
              <button className="btn-stitch-secondary" onClick={() => handleDelete(selectedItem.id)} style={{ color: '#ef4444', flex: 1 }}>
                🗑️ Delete
              </button>
              <button className="btn-stitch-secondary" onClick={() => setSelectedItem(null)} style={{ flex: 1 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT ITEM MODAL --- */}
      {editingItem && (
        <div className="modal-overlay-stitch" onClick={() => setEditingItem(null)}>
          <div className="modal-content-stitch" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900' }}>✏️ Edit Pantry Item</h3>
              <button className="btn-stitch-secondary" onClick={() => setEditingItem(null)} style={{ padding: '2px 8px', fontSize: '12px' }}>✕</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', marginBottom: '6px', color: '#64748b' }}>
                Item Name
              </label>
              <input
                type="text"
                className="input-stitch"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Item name..."
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', marginBottom: '6px', color: '#64748b' }}>
                Days Until Expiry ({editShelfLife} days)
              </label>
              <input
                type="range"
                min="1"
                max="60"
                value={editShelfLife}
                onChange={(e) => setEditShelfLife(parseInt(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-stitch-primary" onClick={handleSaveItemEdit} style={{ flex: 1 }}>
                💾 Save Changes
              </button>
              <button className="btn-stitch-secondary" onClick={() => setEditingItem(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 5-STEP ONBOARDING TUTORIAL MODAL FOR FIRST-TIME USERS --- */}
      {showOnboarding && (
        <div className="modal-overlay-stitch" style={{ zIndex: 2500 }}>
          <div className="modal-content-stitch" style={{ textAlign: 'center', padding: '28px 22px' }}>
            {onboardingStep === 1 && (
              <div>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔔✨</div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                  Enable Expiry Alerts
                </h2>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.5', color: settings.darkMode ? '#cbd5e1' : '#475569' }}>
                  Never let your food spoil! Allow notification permissions so SIMMERS can send you smart expiry alerts before your groceries go bad.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  <button
                    className="btn-stitch-primary"
                    onClick={() => requestNotificationPermissionWithPrompt(() => setOnboardingStep(2))}
                    style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                  >
                    🔔 Allow Expiry Notifications
                  </button>
                  <button
                    type="button"
                    className="btn-stitch-secondary"
                    onClick={() => {
                      setShowNotifWarningModal(true);
                      setPendingNotifCallback(() => () => setOnboardingStep(2));
                    }}
                    style={{ width: '100%', padding: '10px', fontSize: '13px', color: '#64748b', border: 'none', boxShadow: 'none' }}
                  >
                    Skip for now
                  </button>
                </div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>Step 1 of 5</span>
              </div>
            )}

            {onboardingStep === 2 && (
              <div>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🐉✨</div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                  Meet Sproutling!
                </h2>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.5', color: settings.darkMode ? '#cbd5e1' : '#475569' }}>
                  Your eco-dragon kitchen companion. Log your groceries, rescue food before it spoils, and level up together!
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="btn-stitch-secondary" onClick={() => setOnboardingStep(1)} style={{ padding: '8px 14px' }}>
                    ‹ Back
                  </button>
                  <button className="btn-stitch-primary" onClick={() => setOnboardingStep(3)} style={{ width: 'auto', padding: '10px 20px' }}>
                    Next ➔
                  </button>
                </div>
              </div>
            )}

            {onboardingStep === 3 && (
              <div>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🧺⏰</div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                  Smart Pantry Tracking
                </h2>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.5', color: settings.darkMode ? '#cbd5e1' : '#475569' }}>
                  Add groceries with 1 tap or photo scan. Get color-coded urgency badges so you always know what to cook first!
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="btn-stitch-secondary" onClick={() => setOnboardingStep(2)} style={{ padding: '8px 14px' }}>
                    ‹ Back
                  </button>
                  <button className="btn-stitch-primary" onClick={() => setOnboardingStep(4)} style={{ width: 'auto', padding: '10px 20px' }}>
                    Next ➔
                  </button>
                </div>
              </div>
            )}

            {onboardingStep === 4 && (
              <div>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🍳🏆</div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                  Cook Recipe Quests
                </h2>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.5', color: settings.darkMode ? '#cbd5e1' : '#475569' }}>
                  Complete daily waste-rescue recipe quests to earn +75 XP, maintain your streak, and unlock real kitchen perks!
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="btn-stitch-secondary" onClick={() => setOnboardingStep(3)} style={{ padding: '8px 14px' }}>
                    ‹ Back
                  </button>
                  <button className="btn-stitch-primary" onClick={() => setOnboardingStep(5)} style={{ width: 'auto', padding: '10px 20px' }}>
                    Next ➔
                  </button>
                </div>
              </div>
            )}

            {onboardingStep === 5 && (
              <div>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>💱💰</div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
                  Local Currency Savings
                </h2>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.5', color: settings.darkMode ? '#cbd5e1' : '#475569' }}>
                  Track your food waste savings in your local currency (₹, $, €, £, ¥)! Auto-detected, or manually pick your preferred currency anytime in <strong>Settings</strong>! ⚙️
                </p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>Step 5 of 5</span>
                </div>
                <button className="btn-stitch-primary" onClick={handleFinishOnboarding} disabled={isOnboardingProcessing} style={{ width: '100%', padding: '14px', fontSize: '16px', opacity: isOnboardingProcessing ? 0.7 : 1 }}>
                  {isOnboardingProcessing ? '⚙️ Setting Up...' : '🚀 Start Rescuing Food!'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Convincing Permission Warning Modal */}
      {showNotifWarningModal && (
        <div className="modal-overlay-stitch" style={{ zIndex: 3000 }}>
          <div 
            className="modal-content-stitch" 
            onClick={(e) => e.stopPropagation()} 
            style={{ textAlign: 'center', padding: '26px 20px', border: '3px solid #f59e0b', maxWidth: '380px' }}
          >
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>⚠️🔔</div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '900', color: '#d97706' }}>
              Expiry Alerts Disabled
            </h2>
            <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: '#334155', fontWeight: '600', lineHeight: '1.5' }}>
              Without notification permission, <strong>SIMMERS will NOT be able to alert you when your food is about to expire</strong>.
            </p>
            <p style={{ margin: '0 0 20px 0', fontSize: '12.5px', color: '#64748b', lineHeight: '1.4' }}>
              You might miss expiry dates, lose mascot health, and waste money on spoiled groceries.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn-stitch-primary" 
                style={{ backgroundColor: '#16a34a', borderColor: '#15803d', padding: '12px', fontSize: '14px' }}
                onClick={async () => {
                  const granted = await NotificationService.requestPermissions();
                  if (granted) {
                    const updated = { ...settings, notificationEnabled: true };
                    DbService.saveSettings(updated);
                    setSettings(updated);
                    NotificationService.scheduleExpiryNotifications(items, updated, user);
                    setShowNotifWarningModal(false);
                    if (pendingNotifCallback) {
                      pendingNotifCallback(true);
                      setPendingNotifCallback(null);
                    }
                  } else {
                    alert('Notification permission was not granted. You can enable it anytime in app Settings.');
                  }
                }}
              >
                🔔 Allow Notifications
              </button>
              <button 
                className="btn-stitch-secondary" 
                style={{ padding: '10px', fontSize: '13px' }}
                onClick={() => {
                  const updated = { ...settings, notificationEnabled: false };
                  DbService.saveSettings(updated);
                  setSettings(updated);
                  NotificationService.scheduleExpiryNotifications(items, updated, user);
                  setShowNotifWarningModal(false);
                  if (pendingNotifCallback) {
                    pendingNotifCallback(false);
                    setPendingNotifCallback(null);
                  }
                }}
              >
                Continue Without Alerts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Achievement Trophy Detail Modal */}
      {selectedAchievement && (
        <div className="modal-overlay-stitch" style={{ zIndex: 3000 }} onClick={() => setSelectedAchievement(null)}>
          <div className="modal-content-stitch" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '360px' }}>
            <div style={{ fontSize: '56px', marginBottom: '8px', filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.2))' }}>{selectedAchievement.icon}</div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '900', color: settings.darkMode ? '#f8fafc' : '#0f172a' }}>
              {selectedAchievement.title}
            </h2>
            <p style={{ fontSize: '13px', color: settings.darkMode ? '#cbd5e1' : '#64748b', margin: '0 0 16px 0', lineHeight: '1.4' }}>
              {selectedAchievement.description}
            </p>

            <div style={{ backgroundColor: settings.darkMode ? '#1e293b' : '#f8fafc', border: `1.5px solid ${settings.darkMode ? '#334155' : '#e2e8f0'}`, padding: '12px', borderRadius: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Perk Benefit</div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: settings.darkMode ? '#f8fafc' : '#0f172a', marginTop: '2px' }}>{selectedAchievement.perkText}</div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }}>+{selectedAchievement.xpReward} Bonus XP Reward</div>
            </div>

            <button className="btn-stitch-primary" onClick={() => setSelectedAchievement(null)}>
              Close Trophy
            </button>
          </div>
        </div>
      )}

      {/* --- IN-APP LIVE CAMERA VIEWFINDER MODAL (ZERO RESTART) --- */}
      {showInAppCamera && (
        <InAppCameraModal
          onCapture={handleCapturedPhotoFromInAppCamera}
          onClose={() => setShowInAppCamera(false)}
        />
      )}

      {/* --- SIMULATED AD MODAL --- */}
      {showAdModal && (
        <div className="modal-overlay-stitch" style={{ zIndex: 2000 }}>
          <div className="modal-content-stitch" style={{ textAlign: 'center', padding: '30px 20px' }}>
            <span style={{ fontSize: '40px' }}>📺</span>
            <h3 style={{ margin: '10px 0' }}>Rewarded Ad Delivery</h3>
            <div 
              style={{ 
                width: '70px', 
                height: '70px', 
                borderRadius: '50%', 
                border: '3px solid #1e293b', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                fontSize: '24px',
                fontWeight: '900',
                backgroundColor: '#fde68a'
              }}
            >
              {adTimer}
            </div>
            <p style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>
              Rewarding 50 Streak Shields in {adTimer}s...
            </p>
          </div>
        </div>
      )}

      {/* Congratulatory Quests Completion Modal */}
      {showCompletionModal && (
        <div className="modal-overlay-stitch" onClick={() => setShowCompletionModal(false)}>
          <div 
            className="modal-content-stitch" 
            onClick={(e) => e.stopPropagation()} 
            style={{ textAlign: 'center', padding: '28px 20px', border: '3px solid #16a34a' }}
          >
            <div style={{ fontSize: '56px', marginBottom: '8px' }}>🎉🏆</div>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '22px', fontWeight: '900', color: '#15803d' }}>
              Congratulations!
            </h2>
            <p style={{ margin: '0 0 14px 0', fontSize: '14px', lineHeight: '1.5', color: '#334155', fontWeight: '700' }}>
              You have completed all the quests for today!
            </p>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#475569', fontWeight: '600', lineHeight: '1.4' }}>
              Tomorrow new quests will be available after the 24-hour timer resets.
            </p>

            <div className="glowing-timer-badge" style={{ marginBottom: '22px' }}>
              <span>⏱️ Resets In:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '15px' }}>{formatCountdown(timeRemainingSeconds)}</span>
            </div>

            <div>
              <button 
                className="btn-stitch-primary" 
                style={{ backgroundColor: '#22c55e', width: '100%', padding: '12px', fontSize: '15px' }}
                onClick={() => setShowCompletionModal(false)}
              >
                Awesome! 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}


      {showResetConfirmModal && (
        <div className="modal-overlay-stitch" onClick={() => setShowResetConfirmModal(false)}>
          <div 
            className="modal-content-stitch" 
            onClick={(e) => e.stopPropagation()} 
            style={{ textAlign: 'center', padding: '24px 20px', border: '3px solid #ef4444' }}
          >
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '900', color: '#ef4444' }}>
              Reset All App Data?
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#334155', fontWeight: '600', lineHeight: '1.4' }}>
              This will permanently delete all logged pantry items, streak history, mascot XP, and custom settings. This action cannot be undone!
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn-stitch-secondary" 
                style={{ flex: 1, padding: '10px' }}
                onClick={() => setShowResetConfirmModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-stitch-primary" 
                style={{ flex: 1, padding: '10px', backgroundColor: '#ef4444' }}
                onClick={handleConfirmResetAllData}
              >
                Confirm Reset
              </button>

            </div>
          </div>
        </div>
      )}


      {showRenameModal && (
        <div className="modal-overlay-stitch" onClick={() => setShowRenameModal(false)}>
          <div 
            className="modal-content-stitch" 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: '380px', width: '90%', padding: '20px', backgroundColor: '#ffffff' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>✏️</span>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>
                  Name Your Mascot
                </h2>
              </div>
              <button
                className="btn-stitch-secondary"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                onClick={() => setShowRenameModal(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#475569', lineHeight: '1.4', fontWeight: '600' }}>
              Give your kitchen companion a custom name to feel more connected on your food waste reduction journey!
            </p>

            {/* Quick Name Suggestion Pills */}
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '6px' }}>
              QUICK NAME SUGGESTIONS
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {['Bitey 🧊', 'Chilly ❄️', 'Frosty 🍦', 'Chef Hero 👨‍🍳', 'PantryPal 🤖'].map((presetName) => (
                <button
                  key={presetName}
                  type="button"
                  className="btn-stitch-secondary"
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    backgroundColor: mascotNameInput === presetName.split(' ')[0] ? '#3b49df' : '#ffffff',
                    color: mascotNameInput === presetName.split(' ')[0] ? '#ffffff' : '#0f172a'
                  }}
                  onClick={() => setMascotNameInput(presetName.split(' ')[0])}
                >
                  {presetName}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <form onSubmit={handleSaveMascotName}>
              <input
                type="text"
                className="input-stitch"
                style={{ width: '100%', padding: '10px 14px', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' }}
                placeholder="Enter custom name..."
                value={mascotNameInput}
                onChange={(e) => setMascotNameInput(e.target.value)}
                autoFocus
              />

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-stitch-secondary"
                  style={{ flex: 1, padding: '10px' }}
                  onClick={() => setShowRenameModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-stitch-primary"
                  style={{ flex: 1, padding: '10px', backgroundColor: '#16a34a', borderColor: '#14532d' }}
                >
                  Save Name ➔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}



export default App;
