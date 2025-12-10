import React, { useState, useEffect, useRef } from "react"
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, StatusBar, Alert, Animated } from "react-native"
import { Text, Card, Switch, IconButton, Button, Appbar, Avatar, ProgressBar } from "react-native-paper"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import { BlurView } from "expo-blur"
import { BarChart } from "react-native-chart-kit"
import SmartTimerModal from "../components/SmartTimerModal"
import CustomAlert from "../components/CustomAlert"
import { getOverallSafetyStatus, getSafetyStatusColor, getSafetyStatusIcon } from "../utils/safetyFeatures"
import { auth, realtimeDb } from "../config/firebase"
import { ref, onValue, set } from "firebase/database"
import {
  requestNotificationPermissions,
  sendOvervoltageAlert,
  sendUndervoltageAlert,
  sendHighPowerAlert,
  sendDeviceOfflineAlert,
  sendDeviceOnlineAlert,
} from "../utils/notifications"
import { calculateLESCOCost, formatCurrency, getTierInfo } from "../utils/lescoRates"
import { Colors, Gradients, Shadows, BorderRadius, Typography, Spacing } from "../config/theme"
import { pulse, fadeIn } from "../utils/animations"

const { width } = Dimensions.get("window")

const HomeScreen = ({ navigation }) => {
  const [mainSwitchOn, setMainSwitchOn] = useState(true)
  const [loading, setLoading] = useState(true)
  const [showSmartTimerModal, setShowSmartTimerModal] = useState(false)
  const [user, setUser] = useState(null)
  const [greeting, setGreeting] = useState("Good morning")
  const [deviceOnline, setDeviceOnline] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [dailyUsage, setDailyUsage] = useState(0)
  const [dailyCost, setDailyCost] = useState(0)
  const [currentTier, setCurrentTier] = useState(null)
  const [powerHistory, setPowerHistory] = useState([0, 0, 0, 0, 0, 0])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [alertsSent, setAlertsSent] = useState({
    overvoltage: false,
    undervoltage: false,
    highPower: false,
    deviceOffline: false,
  })
  const [deleteAlertVisible, setDeleteAlertVisible] = useState(false)
  const [timerToDelete, setTimerToDelete] = useState(null)
  const [timers, setTimers] = useState([])
  const [masterTimerEnabled, setMasterTimerEnabled] = useState(true) // MASTER SWITCH for all timers
  const [safetyStatus, setSafetyStatus] = useState({
    status: 'safe',
    message: 'All Systems Safe',
    alerts: [],
    action: 'NONE'
  })
  const [manualOverride, setManualOverride] = useState(false)
  const [powerData, setPowerData] = useState({
    voltage: 220.4,
    current: 0.02,
    power: 4,
    dailyUsage: 0.1,
  })
  const [devices, setDevices] = useState({})
  
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const spinAnim = useRef(new Animated.Value(0)).current
  const lastHistorySaveRef = useRef(0) // Track last time we saved to usageHistory
  
  // Start animations on mount
  useEffect(() => {
    fadeIn(fadeAnim, 500).start()
    if (mainSwitchOn) {
      pulse(pulseAnim, 0.95, 1.05, 2000).start()
    }
    
    // Continuous spinning animation for logo
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  useEffect(() => {
    if (mainSwitchOn) {
      pulse(pulseAnim, 0.95, 1.05, 2000).start()
    } else {
      pulseAnim.setValue(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainSwitchOn])
  const getChartData = () => {
    const now = new Date()
    const labels = powerHistory.map((_, index) => {
      const time = new Date(now.getTime() - (5 - index) * 5000)
      return time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    })

    return {
      labels: labels,
      datasets: [
        {
          data: powerHistory.map(p => p || 0),
          color: () => "#4361EE",
          strokeWidth: 2,
        },
      ],
    }
  }

  useEffect(() => {
    // Get user data from Firebase
    const currentUser = auth.currentUser
    if (currentUser) {
      setUser({
        name: currentUser.displayName || "User",
        email: currentUser.email,
      })
    }

    // Set greeting based on time
    const currentHour = new Date().getHours()
    if (currentHour >= 5 && currentHour < 12) {
      setGreeting("Good morning")
    } else if (currentHour >= 12 && currentHour < 17) {
      setGreeting("Good afternoon")
    } else if (currentHour >= 17 && currentHour < 21) {
      setGreeting("Good evening")
    } else {
      setGreeting("Good night")
    }

    // Request notification permissions
    requestNotificationPermissions()

    // Simulate loading data
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  // Reload user data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const currentUser = auth.currentUser
      if (currentUser) {
        setUser({
          name: currentUser.displayName || "User",
          email: currentUser.email,
        })
      }
    })

    return unsubscribe
  }, [navigation])

  // Load user's daily usage from Firebase
  useEffect(() => {
    if (loading) return

    const userId = auth.currentUser?.uid
    if (!userId) return

    const today = new Date().toISOString().split('T')[0]
    const usageRef = ref(realtimeDb, `users/${userId}/dailyUsage/${today}`)
    
    const listener = onValue(usageRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setDailyUsage(data.usage || 0)
        setDailyCost(data.cost || 0)
        setCurrentTier(data.tier || null)
      }
    })

    return () => listener()
  }, [loading])

  // Calculate daily energy usage (kWh) and cost with LESCO rates - SAVE TO FIREBASE
  useEffect(() => {
    if (loading) return

    let lastHistorySave = 0 // Track last time we saved to usageHistory

    const interval = setInterval(async () => {
      if (mainSwitchOn && powerData.power > 0) {
        // Calculate energy consumed in this interval (5 seconds)
        const energyInKWh = (powerData.power / 1000) * (5 / 3600)
        
        setDailyUsage((prev) => {
          const newUsage = Number((prev + energyInKWh).toFixed(6))
          
          // Calculate cost using LESCO rates
          const costData = calculateLESCOCost(newUsage)
          const newCost = costData.totalCost
          const newTier = getTierInfo(newUsage)
          
          setDailyCost(newCost)
          setCurrentTier(newTier)
          
          // Save to Firebase - USER-SPECIFIC
          const userId = auth.currentUser?.uid
          if (userId) {
            const today = new Date().toISOString().split('T')[0]
            const usageRef = ref(realtimeDb, `users/${userId}/dailyUsage/${today}`)
            
            // Sanitize tier object - Firebase doesn't allow Infinity values
            const sanitizedTier = {
              ...newTier,
              maxUnits: newTier.maxUnits === Infinity ? null : newTier.maxUnits
            }
            
            set(usageRef, {
              usage: newUsage,
              cost: newCost,
              tier: sanitizedTier,
              lastUpdated: new Date().toISOString()
            }).catch(err => console.error('Error saving daily usage:', err))

            // Save to usageHistory every 5 minutes (300 seconds) for History and Analytics screens
            const now = Date.now()
            if (now - lastHistorySave >= 300000) { // 5 minutes = 300000 ms
              // Defer Firebase write to next event loop to avoid updating other components during render
              setTimeout(() => {
                const timestamp = new Date().toISOString()
                // Sanitize timestamp for Firebase path - replace invalid characters
                const safeTimestamp = timestamp.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
                const historyRef = ref(realtimeDb, `users/${userId}/usageHistory/${safeTimestamp}`)
                
                set(historyRef, {
                  power: powerData.power,
                  energy: energyInKWh,
                  timestamp,
                  voltage: powerData.voltage,
                  current: powerData.current
                }).catch(err => console.error('Error saving usage history:', err))
                
                console.log(`💾 Usage history saved: ${powerData.power}W`)
              }, 0)
              
              lastHistorySave = now
            }
          }
          
          return newUsage
        })
      }

      // Update power history for chart every 5 seconds
      setPowerHistory((prev) => {
        const newHistory = [...prev.slice(1), powerData.power]
        return newHistory
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [loading, mainSwitchOn, powerData.power, powerData.voltage, powerData.current])

  // Monitor voltage, power, and device status for alerts
  useEffect(() => {
    if (loading) return

    // Check overvoltage (>250V)
    if (powerData.voltage > 250 && !alertsSent.overvoltage) {
      sendOvervoltageAlert(powerData.voltage)
      setAlertsSent(prev => ({ ...prev, overvoltage: true }))
    } else if (powerData.voltage <= 250 && alertsSent.overvoltage) {
      setAlertsSent(prev => ({ ...prev, overvoltage: false }))
    }

    // Check undervoltage (<180V)
    if (powerData.voltage > 0 && powerData.voltage < 180 && !alertsSent.undervoltage) {
      sendUndervoltageAlert(powerData.voltage)
      setAlertsSent(prev => ({ ...prev, undervoltage: true }))
    } else if ((powerData.voltage >= 180 || powerData.voltage === 0) && alertsSent.undervoltage) {
      setAlertsSent(prev => ({ ...prev, undervoltage: false }))
    }

    // Check high power consumption (>1500W)
    if (powerData.power > 1500 && !alertsSent.highPower) {
      sendHighPowerAlert(powerData.power)
      setAlertsSent(prev => ({ ...prev, highPower: true }))
    } else if (powerData.power <= 1500 && alertsSent.highPower) {
      setAlertsSent(prev => ({ ...prev, highPower: false }))
    }

    // Check device offline (no update for 30 seconds)
    if (lastUpdated) {
      const timeSinceUpdate = Date.now() - lastUpdated.getTime()
      if (timeSinceUpdate > 30000 && deviceOnline && !alertsSent.deviceOffline) {
        setDeviceOnline(false)
        sendDeviceOfflineAlert()
        setAlertsSent(prev => ({ ...prev, deviceOffline: true }))
      }
    }

    // Check device back online
    if (deviceOnline && alertsSent.deviceOffline) {
      sendDeviceOnlineAlert()
      setAlertsSent(prev => ({ ...prev, deviceOffline: false }))
    }
  }, [loading, powerData.voltage, powerData.power, deviceOnline, lastUpdated, alertsSent])

  // Real-time data from Firebase (ESP32)
  useEffect(() => {
    if (loading) return

    // Listen to voltage
    const voltageRef = ref(realtimeDb, 'voltage')
    const voltageListener = onValue(voltageRef, (snapshot) => {
      const voltage = snapshot.val()
      if (voltage !== null) {
        setPowerData((prev) => ({ ...prev, voltage: Number(voltage) }))
        setDeviceOnline(true)
        setLastUpdated(new Date())
      }
    })

    // Listen to current
    const currentRef = ref(realtimeDb, 'current')
    const currentListener = onValue(currentRef, (snapshot) => {
      const current = snapshot.val()
      if (current !== null) {
        setPowerData((prev) => ({ ...prev, current: Number(current) }))
      }
    })

    // Listen to power
    const powerRef = ref(realtimeDb, 'power')
    const powerListener = onValue(powerRef, (snapshot) => {
      const power = snapshot.val()
      if (power !== null) {
        setPowerData((prev) => ({ ...prev, power: Number(power) }))
      }
    })

    // Listen to relay status
    const relayRef = ref(realtimeDb, 'relay')
    const relayListener = onValue(relayRef, (snapshot) => {
      const relayStatus = snapshot.val()
      if (relayStatus !== null) {
        setMainSwitchOn(relayStatus === 'on')
      }
    })

    // Cleanup listeners
    return () => {
      voltageListener()
      currentListener()
      powerListener()
      relayListener()
    }
  }, [loading])

  // Load timers from Firebase - USER-SPECIFIC (Each user sees ONLY their own timers!)
  useEffect(() => {
    if (loading) return

    const userId = auth.currentUser?.uid
    if (!userId) {
      console.error('❌ No user ID found')
      setTimers([])
      return
    }

    console.log('📥 Loading timers for user:', userId)
    const timersRef = ref(realtimeDb, `users/${userId}/timers`)
    
    const timersListener = onValue(timersRef, (snapshot) => {
      const timersData = snapshot.val()
      if (timersData) {
        const timersArray = Object.keys(timersData).map(key => ({
          id: key,
          ...timersData[key]
        }))
        setTimers(timersArray)
        console.log(`✅ User ${userId} - Timers loaded:`, timersArray.length)
      } else {
        setTimers([])
        console.log(`📭 User ${userId} - NO timers (Fresh user!)`)
      }
    })

    return () => timersListener()
  }, [loading])

  // Load Master Timer Switch State from Firebase
  useEffect(() => {
    if (loading) return

    const userId = auth.currentUser?.uid
    if (!userId) return

    const masterTimerRef = ref(realtimeDb, `users/${userId}/masterTimerEnabled`)
    const listener = onValue(masterTimerRef, (snapshot) => {
      const value = snapshot.val()
      if (value !== null) {
        setMasterTimerEnabled(value)
        console.log(`🎛️ Master Timer: ${value ? 'ENABLED' : 'DISABLED'}`)
      }
    })

    return () => listener()
  }, [loading])

  // Load user's devices from Firebase
  useEffect(() => {
    if (loading) return

    const userId = auth.currentUser?.uid
    if (!userId) return

    console.log('📱 Loading devices for user:', userId)

    const devicesRef = ref(realtimeDb, `users/${userId}/devices`)
    const listener = onValue(devicesRef, (snapshot) => {
      const devicesData = snapshot.val()
      if (devicesData) {
        setDevices(devicesData)
        console.log(`✅ Loaded ${Object.keys(devicesData).length} devices`)
      } else {
        setDevices({})
        console.log('📭 No devices found')
      }
    })

    return () => listener()
  }, [loading])

  // Listen to unread notification count
  useEffect(() => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    const notificationsRef = ref(realtimeDb, `users/${userId}/notifications`)
    const listener = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const unreadCount = Object.values(data).filter(n => !n.read).length
        setUnreadNotificationCount(unreadCount)
      } else {
        setUnreadNotificationCount(0)
      }
    })

    return () => listener()
  }, [])

  // Update safety status when power data changes
  useEffect(() => {
    const newSafetyStatus = getOverallSafetyStatus(
      powerData.voltage,
      powerData.current,
      powerData.power,
      powerData.temperature,
      lastUpdated
    )
    setSafetyStatus(newSafetyStatus)
  }, [powerData, lastUpdated])

  // Auto Timer Checking System
  useEffect(() => {
    // 🚫 Don't check timers if Master Timer is DISABLED
    if (loading || timers.length === 0 || manualOverride || !masterTimerEnabled) {
      if (!masterTimerEnabled) {
        console.log('⏸️ Timer checking PAUSED - Master Timer is DISABLED')
      }
      return
    }

    const checkTimers = async () => {
      const now = new Date()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      const currentDay = now.getDay() // 0=Sunday, 1=Monday, etc.
      const currentTotalMinutes = currentHour * 60 + currentMinute

      let activeTimerId = null
      let shouldTurnOn = false

      // Check all timers (enabled or not)
      for (const timer of timers) {
        // Parse start and end times
        const startDate = new Date(timer.startTime)
        const endDate = new Date(timer.endTime)
        
        const startHour = startDate.getHours()
        const startMinute = startDate.getMinutes()
        const endHour = endDate.getHours()
        const endMinute = endDate.getMinutes()
        
        const startTotalMinutes = startHour * 60 + startMinute
        const endTotalMinutes = endHour * 60 + endMinute

        // Check if current time is within timer range
        let timeMatched = false
        if (endTotalMinutes > startTotalMinutes) {
          // Normal case: same day
          timeMatched = (currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes)
        } else {
          // Timer crosses midnight
          timeMatched = (currentTotalMinutes >= startTotalMinutes || currentTotalMinutes <= endTotalMinutes)
        }

        // Check if current day is in timer days
        const dayMatched = timer.days && timer.days.includes(currentDay)

        if (timeMatched && dayMatched) {
          // Auto-enable timer if not already enabled
          if (!timer.enabled) {
            const userId = auth.currentUser?.uid
            console.log(`🔄 Auto-enabling timer "${timer.name}"`)
            const timerRef = ref(realtimeDb, `users/${userId}/timers/${timer.id}/enabled`)
            await set(timerRef, true)
            setTimers(prev => prev.map(t => 
              t.id === timer.id ? { ...t, enabled: true } : t
            ))
          }
          shouldTurnOn = true
          activeTimerId = timer.id
          console.log(`✅ Timer "${timer.name}" is active!`)
          break
        } else if (timer.enabled && timeMatched === false && dayMatched) {
          // Timer was active but time has passed - auto disable
          const userId = auth.currentUser?.uid
          console.log(`🔄 Auto-disabling timer "${timer.name}" (time ended)`)
          const timerRef = ref(realtimeDb, `users/${userId}/timers/${timer.id}/enabled`)
          await set(timerRef, false)
          setTimers(prev => prev.map(t => 
            t.id === timer.id ? { ...t, enabled: false } : t
          ))
        }
      }

      // Auto-control switch based on timer
      if (shouldTurnOn && !mainSwitchOn && !manualOverride) {
        console.log('🔛 Turning relay ON (Timer activated)')
        setMainSwitchOn(true)
        await set(ref(realtimeDb, 'relay'), 'on')
        setManualOverride(false)
      } else if (!shouldTurnOn && mainSwitchOn && !manualOverride) {
        // Check if any enabled timer exists
        const hasEnabledTimer = timers.some(t => t.enabled)
        if (hasEnabledTimer) {
          console.log('🔴 Turning relay OFF (Timer ended)')
          setMainSwitchOn(false)
          await set(ref(realtimeDb, 'relay'), 'off')
          setManualOverride(false)
        }
      }
    }

    // Check timers every 10 seconds
    checkTimers() // Initial check
    const timerInterval = setInterval(checkTimers, 10000)

    return () => clearInterval(timerInterval)
  }, [loading, timers, mainSwitchOn, manualOverride, masterTimerEnabled])

  const toggleMainSwitch = async () => {
    const newStatus = !mainSwitchOn
    setMainSwitchOn(newStatus)
    
    if (!newStatus) {
      setManualOverride(true)
      console.log(' Manual OFF - Timer control paused → Relay OFF → Power Supply OFF')
      
    
      setTimeout(() => {
        setManualOverride(false)
        console.log(' Timer control resumed - Ready for next timer')
      }, 30000)
    } else {
      setManualOverride(false)
      console.log(' Manual ON - Timer control active → Relay ON → Power Supply ON')
    }

    // Update Firebase to control ESP32 relay
    // This directly controls the physical relay, which cuts/starts power supply
    try {
      // Force update relay value - ESP32 should be listening to this path
      const relayValue = newStatus ? 'on' : 'off'
      await set(ref(realtimeDb, 'relay'), relayValue)
      console.log(`✅ Relay set to "${relayValue}" in Firebase - ESP32 should read this and control physical relay`)
      console.log(`📡 Firebase path: /relay = "${relayValue}"`)
      console.log(`⚠️ If charging still continues, check ESP32 code - it should listen to /relay path`)
    } catch (error) {
      console.error('❌ Error updating relay:', error)
      setMainSwitchOn(!newStatus) // Revert on error
    }
  }

  const formatTime = (timeString) => {
    const date = new Date(timeString)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const formatDays = (days) => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    return days.map((day) => dayNames[day]).join(", ")
  }

  const handleSaveTimer = async (newTimer) => {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) {
        throw new Error('No user ID found')
      }

      // Save to Firebase - USER-SPECIFIC
      const timerRef = ref(realtimeDb, `users/${userId}/timers/${newTimer.id}`)
      await set(timerRef, {
        name: newTimer.name,
        startTime: newTimer.startTime,
        endTime: newTimer.endTime,
        days: newTimer.days,
        enabled: newTimer.enabled,
        createdAt: newTimer.createdAt,
        scheduleType: newTimer.scheduleType || 'custom',
        dayType: newTimer.dayType || 'all',
        scene: newTimer.scene || null,
        randomMode: newTimer.randomMode || false,
        sunriseTime: newTimer.sunriseTime || null,
        sunsetTime: newTimer.sunsetTime || null
      })
      
   
      console.log(`✅ User ${userId} - Timer saved:`, newTimer.id)
    } catch (error) {
      console.error('Error saving timer:', error)
      alert('Failed to save timer. Please try again.')
    }
  }

  const handleDeleteTimer = (timerId) => {
    const timer = timers.find((t) => t.id === timerId)
    setTimerToDelete(timer)
    setDeleteAlertVisible(true)
  }

  const confirmDeleteTimer = async () => {
    if (timerToDelete) {
      try {
        const userId = auth.currentUser?.uid
        if (!userId) {
          throw new Error('No user ID found')
        }

        // Delete from Firebase - USER-SPECIFIC
        const timerRef = ref(realtimeDb, `users/${userId}/timers/${timerToDelete.id}`)
        await set(timerRef, null)
        
        // Update local state
        setTimers(prev => prev.filter(timer => timer.id !== timerToDelete.id))
        console.log(`🗑️ User ${userId} - Timer deleted:`, timerToDelete.id)
      } catch (error) {
        console.error('Error deleting timer:', error)
        alert('Failed to delete timer. Please try again.')
      }
      setDeleteAlertVisible(false)
      setTimerToDelete(null)
    }
  }

  const toggleTimer = async (timerId) => {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) {
        throw new Error('No user ID found')
      }

      const timer = timers.find(t => t.id === timerId)
      if (timer) {
        const newEnabledState = !timer.enabled
        
        // Update Firebase - USER-SPECIFIC
        const timerRef = ref(realtimeDb, `users/${userId}/timers/${timerId}/enabled`)
        await set(timerRef, newEnabledState)
        
        // Update local state
        setTimers((prev) =>
          prev.map((t) =>
            t.id === timerId ? { ...t, enabled: newEnabledState } : t
          )
        )
        
        console.log('🎛️ Timer toggled manually:', timerId, 'enabled:', newEnabledState)
        
        // If enabling timer, check if it should be active now
        if (newEnabledState) {
          const now = new Date()
          const currentHour = now.getHours()
          const currentMinute = now.getMinutes()
          const currentDay = now.getDay()
          const currentTotalMinutes = currentHour * 60 + currentMinute
          
          const startDate = new Date(timer.startTime)
          const endDate = new Date(timer.endTime)
          const startHour = startDate.getHours()
          const startMinute = startDate.getMinutes()
          const endHour = endDate.getHours()
          const endMinute = endDate.getMinutes()
          const startTotalMinutes = startHour * 60 + startMinute
          const endTotalMinutes = endHour * 60 + endMinute
          
          let timeMatched = false
          if (endTotalMinutes > startTotalMinutes) {
            timeMatched = (currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes)
          } else {
            timeMatched = (currentTotalMinutes >= startTotalMinutes || currentTotalMinutes <= endTotalMinutes)
          }
          
          const dayMatched = timer.days && timer.days.includes(currentDay)
          
          // If timer is active now, turn switch ON (don't toggle, just ensure it's ON)
          if (timeMatched && dayMatched && !mainSwitchOn) {
            console.log('✅ Timer is active now - turning switch ON')
            setMainSwitchOn(true)
            await set(ref(realtimeDb, 'relay'), 'on')
          }
        }
      }
    } catch (error) {
      console.error('Error toggling timer:', error)
      alert('Failed to toggle timer. Please try again.')
    }
  }

  const getInitials = (name) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  // Toggle device - if turning ON, also turn on main switch (relay). If turning OFF, check if any device is ON
  // Main switch directly controls relay, which controls power supply
  const toggleDevice = async (deviceId) => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    const device = devices[deviceId]
    if (!device) return

    const currentStatus = device.status || 'off'
    const newStatus = currentStatus === 'on' ? 'off' : 'on'
    
    try {
      // Update device status in Firebase FIRST
      await set(ref(realtimeDb, `users/${userId}/devices/${deviceId}/status`), newStatus)
      
      // If turning device ON, also turn on main switch (relay) automatically
      // Main switch ON = Relay ON = Power Supply ON
      if (newStatus === 'on') {
        console.log('🔛 Turning main switch ON (device activated) → Relay ON → Power Supply ON')
        setMainSwitchOn(true)
        await set(ref(realtimeDb, 'relay'), 'on')
        setManualOverride(false)
        console.log('✅ Main switch & Relay turned ON automatically - Power supply active')
      } else {
        // Device turned OFF - check if any other device is still ON
        const updatedDevices = { ...devices, [deviceId]: { ...device, status: newStatus } }
        const hasAnyDeviceOn = Object.values(updatedDevices).some(d => d.status === 'on')
        
        if (!hasAnyDeviceOn) {
          // No devices are ON, turn off main switch (relay)
          // Main switch OFF = Relay OFF = Power Supply OFF (charging stops)
          console.log('🔴 Turning main switch OFF (no devices active) → Relay OFF → Power Supply OFF')
          setMainSwitchOn(false)
          await set(ref(realtimeDb, 'relay'), 'off')
          setManualOverride(true)
          // Reset manual override after 30 seconds
          setTimeout(() => {
            setManualOverride(false)
            console.log('⏰ Timer control resumed - Ready for next timer')
          }, 30000)
          console.log('✅ Main switch & Relay turned OFF automatically - Power supply cut, charging stopped')
        } else {
          console.log('ℹ️ Other devices still active, keeping main switch ON (relay ON, power supply active)')
        }
      }
      
      console.log(`✅ Device "${device.name}" turned ${newStatus.toUpperCase()}`)
    } catch (error) {
      console.error('Error toggling device:', error)
    }
  }

  // Get device icon based on type
  const getDeviceIcon = (type) => {
    const deviceIconMap = {
      'bulb': 'lightbulb',
      'fan': 'fan',
      'tv': 'television',
      'ac': 'air-conditioner',
      'heater': 'radiator',
      'charger': 'battery-charging',
      'other': 'power-plug',
    }
    return deviceIconMap[type] || 'power-plug'
  }

  // Get devices that are currently ON
  const getOnlineDevices = () => {
    return Object.keys(devices)
      .filter(deviceId => devices[deviceId].status === 'on')
      .map(deviceId => ({
        id: deviceId,
        ...devices[deviceId]
      }))
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="toggle-switch" size={48} color="#4361EE" />
        <Text style={styles.loadingText}>Loading Switchly...</Text>
        <ProgressBar indeterminate color="#4361EE" style={styles.loadingBar} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Modern Gradient Header */}
      <LinearGradient
        colors={Gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Appbar.Header style={styles.header} transparent>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Animated.View 
                style={[
                  styles.logoContainer,
                  {
                    transform: [
                      {
                        rotate: spinAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.logoCircle}>
                  <MaterialCommunityIcons name="toggle-switch" size={24} color="#FFFFFF" />
                </View>
              </Animated.View>
              <Text style={styles.headerTitle}>Switchly</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={styles.smartChargingIndicator}
                onPress={() => navigation.navigate("SmartCharging")}
              >
                <MaterialCommunityIcons 
                  name="battery-charging-80" 
                  size={24} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
              <View style={styles.notificationButton}>
                <IconButton 
                  icon="bell-outline" 
                  iconColor="#FFFFFF" 
                  onPress={() => navigation.navigate("Notifications")} 
                />
                {unreadNotificationCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
                <Avatar.Text size={36} label={getInitials(user?.name)} style={styles.avatar} />
              </TouchableOpacity>
            </View>
          </View>
        </Appbar.Header>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section with Gradient Background */}
        <Animated.View style={[styles.heroSection, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={Gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <Text style={styles.greetingText}>{greeting}, {user?.name || "User"}! 👋</Text>
              <View style={styles.heroSubtextContainer}>
                <Text style={styles.heroSubtext}>Monitor and control your smart devices</Text>
                <View style={styles.statusContainer}>
                  <Animated.View 
                    style={[
                      styles.statusDot, 
                      { 
                        backgroundColor: deviceOnline ? Colors.success : Colors.danger,
                        transform: [{ scale: pulseAnim }]
                      }
                    ]} 
                  />
                  <Text style={styles.statusText}>
                    {deviceOnline ? "Device Online" : "Device Offline"}
                  </Text>
                </View>
              </View>
              
              {/* Large Power Display */}
              <View style={styles.powerDisplay}>
                <View style={styles.powerLabelContainer}>
                  <MaterialCommunityIcons name="power-socket" size={18} color="rgba(255, 255, 255, 0.9)" />
                  <Text style={styles.powerLabel}>Current Power</Text>
                </View>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Text style={styles.powerValue}>{powerData.power.toFixed(0)}</Text>
                </Animated.View>
                <Text style={styles.powerUnit}>Watts</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.controlSection}>
          {/* Modern Glass Card for Switch Control */}
          <BlurView intensity={20} tint="light" style={styles.glassCard}>
            <View style={styles.glassCardContent}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="power" size={24} color={Colors.primary} />
                <Text style={styles.cardTitle}>Switch Control</Text>
              </View>
              <View style={styles.switchContainer}>
                <View style={styles.switchInfo}>
                  <Animated.View 
                    style={[
                      styles.switchIndicator, 
                      { 
                        backgroundColor: mainSwitchOn ? Colors.success : Colors.textLight,
                        transform: [{ scale: pulseAnim }]
                      }
                    ]}
                  >
                    <MaterialCommunityIcons name="power" size={28} color="#FFFFFF" />
                  </Animated.View>
                  <View>
                    <Text style={styles.switchTitle}>Main Switch</Text>
                    <Text style={styles.switchSubtitle}>Living Room</Text>
                  </View>
                </View>
                <Switch 
                  value={mainSwitchOn} 
                  onValueChange={toggleMainSwitch} 
                  color={Colors.primary}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                />
              </View>

              <View style={styles.deviceInfo}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <Text style={[styles.infoValue, { color: deviceOnline ? Colors.success : Colors.danger }]}>
                    {deviceOnline ? "Online" : "Offline"}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Last Updated</Text>
                  <Text style={styles.infoValue}>
                    {lastUpdated ? lastUpdated.toLocaleTimeString() : "--"}
                  </Text>
                </View>
              </View>
            </View>
          </BlurView>

          {/* Modern Glass Card for Active Devices - Only show if devices exist and have ON devices */}
          {Object.keys(devices).length > 0 && getOnlineDevices().length > 0 && (
            <BlurView intensity={20} tint="light" style={styles.glassCard}>
              <View style={styles.glassCardContent}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="devices" size={24} color={Colors.primary} />
                  <Text style={styles.cardTitle}>Active Devices</Text>
                  <View style={styles.deviceCountBadge}>
                    <Text style={styles.deviceCount}>{getOnlineDevices().length}</Text>
                  </View>
                </View>

                {getOnlineDevices().map((device) => (
                  <View key={device.id} style={styles.deviceItem}>
                    <View style={styles.deviceInfo}>
                      <View style={[styles.deviceIconContainer, { backgroundColor: Colors.success + '20' }]}>
                        <MaterialCommunityIcons 
                          name={getDeviceIcon(device.type)} 
                          size={24} 
                          color={Colors.success} 
                        />
                      </View>
                      <View style={styles.deviceDetails}>
                        <Text style={styles.deviceName}>{device.name}</Text>
                        <Text style={styles.deviceType}>{device.type}</Text>
                        <View style={styles.deviceStatusContainer}>
                          <View style={[styles.deviceStatusDot, { backgroundColor: Colors.success }]} />
                          <Text style={[styles.deviceStatusText, { color: Colors.success }]}>ON</Text>
                        </View>
                      </View>
                    </View>
                    <Switch
                      value={true}
                      onValueChange={() => toggleDevice(device.id)}
                      color={Colors.primary}
                      trackColor={{ false: Colors.border, true: Colors.success }}
                    />
                  </View>
                ))}

                <TouchableOpacity 
                  style={styles.viewAllDevicesButton}
                  onPress={() => navigation.navigate('Devices')}
                >
                  <Text style={styles.viewAllDevicesText}>View All Devices</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </BlurView>
          )}

          {/* Modern Glass Card for Timer Scheduling */}
          <BlurView intensity={20} tint="light" style={styles.glassCard}>
            <View style={styles.glassCardContent}>
              
              {/* MASTER TIMER SWITCH - Controls all timers */}
              <View style={[styles.masterTimerContainer, !masterTimerEnabled && styles.masterTimerDisabled]}>
                <View style={styles.masterTimerLeft}>
                  <MaterialCommunityIcons 
                    name={masterTimerEnabled ? "clock-check" : "clock-alert-outline"} 
                    size={28} 
                    color={masterTimerEnabled ? Colors.primary : Colors.textLight} 
                  />
                  <View style={styles.masterTimerText}>
                    <Text style={[styles.masterTimerTitle, !masterTimerEnabled && styles.masterTimerTitleDisabled]}>
                      Timer System
                    </Text>
                    <Text style={styles.masterTimerSubtitle}>
                      {masterTimerEnabled ? 'All timers active' : 'All timers paused'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={masterTimerEnabled}
                  onValueChange={async (value) => {
                    setMasterTimerEnabled(value)
                    const userId = auth.currentUser?.uid
                    if (userId) {
                      await set(ref(realtimeDb, `users/${userId}/masterTimerEnabled`), value)
                      console.log(`🎛️ Master Timer: ${value ? 'ENABLED' : 'DISABLED'}`)
                    }
                  }}
                  color={Colors.primary}
                />
              </View>

              <View style={styles.timerDivider} />

              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="timer-outline" size={24} color={Colors.primary} />
                <Text style={styles.cardTitle}>Individual Timers</Text>
                <View style={styles.timerCountBadge}>
                  <Text style={styles.timerCount}>{timers.length}</Text>
                </View>
              </View>

              {timers.length > 0 ? (
                timers.map((timer) => (
                  <View key={timer.id} style={[styles.scheduleItem, !masterTimerEnabled && styles.scheduleItemDisabled]}>
                    <View style={styles.scheduleHeader}>
                      <View style={styles.scheduleInfo}>
                        <Text style={[styles.scheduleName, !masterTimerEnabled && styles.textDisabled]}>{timer.name}</Text>
                        <View style={styles.scheduleTime}>
                          <MaterialCommunityIcons 
                            name="clock-outline" 
                            size={16} 
                            color={masterTimerEnabled ? "#4361EE" : "#CCCCCC"} 
                          />
                          <Text style={[styles.scheduleTimeText, !masterTimerEnabled && styles.textDisabled]}>
                            {formatTime(timer.startTime)} - {formatTime(timer.endTime)}
                          </Text>
                        </View>
                        <Text style={[styles.scheduleDays, !masterTimerEnabled && styles.textDisabled]}>
                          {formatDays(timer.days)}
                        </Text>
                      </View>
                      <View style={styles.scheduleActions}>
                        <Switch
                          value={masterTimerEnabled ? timer.enabled : false}
                          onValueChange={() => {
                            if (masterTimerEnabled) {
                              toggleTimer(timer.id)
                            }
                          }}
                          disabled={!masterTimerEnabled}
                          color="#4361EE"
                          size="small"
                        />
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteTimer(timer.id)}
                        >
                          <MaterialCommunityIcons name="delete-outline" size={18} color="#CF6679" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyTimers}>
                  <MaterialCommunityIcons name="timer-outline" size={32} color="#CCCCCC" />
                  <Text style={styles.emptyTimersText}>No timers set up yet</Text>
                  <Text style={styles.emptyTimersSubtext}>Add your first timer to get started</Text>
                </View>
              )}

              <Button 
                mode="contained" 
                icon="brain" 
                onPress={() => setShowSmartTimerModal(true)}
                style={styles.addTimerButton}
                buttonColor={Colors.primary}
                contentStyle={styles.addTimerButtonContent}
                labelStyle={styles.addTimerButtonLabel}
              >
                Add Smart Timer
              </Button>
            </View>
          </BlurView>
        </View>

        <View style={styles.metricsSection}>
          <View style={styles.metricsRow}>
            <Card style={[styles.metricCard, styles.voltageCard]}>
              <Card.Content style={styles.metricContent}>
                <MaterialCommunityIcons name="flash" size={24} color="#FB8C00" />
                <Text style={styles.metricValue}>{powerData.voltage.toFixed(1)} V</Text>
                <Text style={styles.metricLabel}>Voltage</Text>
                <Text style={styles.metricRange}>Normal range: 210-230V</Text>
              </Card.Content>
            </Card>

            <Card style={[styles.metricCard, styles.currentCard]}>
              <Card.Content style={styles.metricContent}>
                <MaterialCommunityIcons name="current-ac" size={24} color="#4361EE" />
                <Text style={styles.metricValue}>{powerData.current.toFixed(2)} A</Text>
                <Text style={styles.metricLabel}>Current</Text>
                <Text style={styles.metricRange}>Normal range: 0-10A</Text>
              </Card.Content>
            </Card>
          </View>

          <Card style={styles.powerCard}>
            <Card.Content style={styles.metricContent}>
              <MaterialCommunityIcons name="power-socket" size={24} color="#4CAF50" />
              <Text style={styles.metricValue}>{powerData.power.toFixed(2)} W</Text>
              <Text style={styles.metricLabel}>Power</Text>
              <Text style={styles.metricRange}>Today: {dailyUsage.toFixed(3)} kWh</Text>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.costSection}>
          <Card style={styles.costCard}>
            <Card.Content>
              <View style={styles.costHeader}>
                <MaterialCommunityIcons name="cash-multiple" size={32} color="#4361EE" />
                <View style={styles.costInfo}>
                  <Text style={styles.costLabel}>Today's Cost</Text>
                  <Text style={styles.costValue}>{formatCurrency(dailyCost)}</Text>
                </View>
              </View>
              <View style={styles.costDetails}>
                <View style={styles.costDetailItem}>
                  <Text style={styles.costDetailLabel}>Rate</Text>
                  <Text style={styles.costDetailValue}>PKR {currentTier?.rate || 0}/kWh</Text>
                </View>
                <View style={styles.costDetailItem}>
                  <Text style={styles.costDetailLabel}>Est. Monthly</Text>
                  <Text style={styles.costDetailValue}>{formatCurrency(dailyCost * 30)}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.costTrackingButton}
                onPress={() => navigation.navigate("CostTracking")}
              >
                <MaterialCommunityIcons name="chart-line" size={16} color="#4361EE" />
                <Text style={styles.costTrackingText}>View Detailed Cost Analysis</Text>
              </TouchableOpacity>
            </Card.Content>
          </Card>
        </View>

        <Card style={styles.chartCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>Real-time Power Consumption</Text>
            <View style={styles.chartContainer}>
              <BarChart
                data={getChartData()}
                width={width - 60}
                height={220}
                chartConfig={{
                  backgroundColor: Colors.surface,
                  backgroundGradientFrom: '#FFFFFF',
                  backgroundGradientTo: '#F8F9FA',
                  decimalPlaces: 1,
                  color: (opacity = 1) => Colors.primary,
                  labelColor: (opacity = 1) => Colors.textSecondary,
                  style: {
                    borderRadius: BorderRadius.lg,
                  },
                  barPercentage: 0.7,
                  fillShadowGradient: Colors.primary,
                  fillShadowGradientOpacity: 0.9,
                  propsForBackgroundLines: {
                    strokeDasharray: "2,2",
                    stroke: Colors.border,
                    strokeWidth: 1,
                  },
                  propsForLabels: {
                    fontSize: 11,
                    fontWeight: '500',
                  },
                }}
                showValuesOnTopOfBars
                withInnerLines={true}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                style={styles.chart}
              />
            </View>
          </Card.Content>
        </Card>

      </ScrollView>

      <SmartTimerModal
        visible={showSmartTimerModal}
        onClose={() => setShowSmartTimerModal(false)}
        onSave={handleSaveTimer}
        existingTimers={timers}
      />

      {/* Custom Delete Alert */}
      <CustomAlert
        visible={deleteAlertVisible}
        onDismiss={() => setDeleteAlertVisible(false)}
        title="Switchly"
        message={`Are you sure you want to delete "${timerToDelete?.name || 'this timer'}"?`}
        type="info"
        showCancel={true}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteTimer}
        onCancel={() => setDeleteAlertVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    color: Colors.primary,
  },
  loadingBar: {
    width: "70%",
    height: 6,
    borderRadius: 3,
  },
  headerGradient: {
    paddingTop: StatusBar.currentHeight || 0,
  },
  header: {
    backgroundColor: 'transparent',
    elevation: 0,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoContainer: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: Typography.h3.fontSize,
    fontWeight: Typography.h3.fontWeight,
    marginLeft: Spacing.sm,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  safetyIndicator: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginRight: Spacing.sm,
  },
  smartChargingIndicator: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginRight: Spacing.sm,
  },
  avatar: {
    backgroundColor: Colors.primaryDark,
  },
  scrollView: {
    flex: 1,
  },
  // Hero Section Styles
  heroSection: {
    marginBottom: Spacing.lg,
  },
  heroGradient: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  heroContent: {
    alignItems: 'center',
  },
  greetingText: {
    fontSize: Typography.h2.fontSize,
    fontWeight: Typography.h2.fontWeight,
    color: "#FFFFFF",
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  heroSubtextContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heroSubtext: {
    fontSize: Typography.body1.fontSize,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.xs,
  },
  statusText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: Typography.caption.fontWeight,
    color: "#FFFFFF",
  },
  // Power Display Styles
  powerDisplay: {
    alignItems: 'center',
    marginTop: Spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    width: '100%',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  powerLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  powerLabel: {
    fontSize: Typography.body2.fontSize,
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: Spacing.xs,
  },
  powerValue: {
    fontSize: 64,
    fontWeight: 'bold',
    color: "#FFFFFF",
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  powerUnit: {
    fontSize: Typography.body1.fontSize,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: Spacing.xs,
  },
  // Glass Card Styles
  glassCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    shadowColor: Shadows.md.shadowColor,
    shadowOffset: Shadows.md.shadowOffset,
    shadowOpacity: Shadows.md.shadowOpacity,
    shadowRadius: Shadows.md.shadowRadius,
    elevation: Shadows.md.elevation,
  },
  glassCardContent: {
    backgroundColor: Colors.glassBackground,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  controlSection: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  controlCard: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: Shadows.md.shadowColor,
    shadowOffset: Shadows.md.shadowOffset,
    shadowOpacity: Shadows.md.shadowOpacity,
    shadowRadius: Shadows.md.shadowRadius,
    elevation: Shadows.md.elevation,
  },
  cardTitle: {
    fontSize: Typography.h4.fontSize,
    fontWeight: Typography.h4.fontWeight,
    marginLeft: Spacing.sm,
    color: Colors.text,
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  switchInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  switchIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212121",
  },
  switchSubtitle: {
    fontSize: 14,
    color: "#757575",
  },
  deviceInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.1)",
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#757575",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#212121",
  },
  timerCard: {
    borderRadius: 12,
    elevation: 2,
  },
  masterTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  masterTimerDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  masterTimerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  masterTimerText: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  masterTimerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  masterTimerTitleDisabled: {
    color: Colors.textLight,
  },
  masterTimerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  timerDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: Spacing.md,
  },
  timerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  timerCountBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.round,
    minWidth: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  timerCount: {
    fontSize: Typography.body2.fontSize,
    fontWeight: 'bold',
    color: "#FFFFFF",
  },
  scheduleItem: {
    backgroundColor: "rgba(67, 97, 238, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  scheduleItemDisabled: {
    backgroundColor: "rgba(0, 0, 0, 0.03)",
    opacity: 0.85,
  },
  textDisabled: {
    color: "#999999",
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212121",
    marginBottom: 4,
  },
  scheduleTime: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  scheduleTimeText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
    color: "#4361EE",
  },
  scheduleDays: {
    fontSize: 12,
    color: "#757575",
    marginLeft: 22,
  },
  scheduleActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(207, 102, 121, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  emptyTimers: {
    alignItems: "center",
    padding: 20,
    marginBottom: 16,
  },
  emptyTimersText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#757575",
    marginTop: 8,
  },
  emptyTimersSubtext: {
    fontSize: 14,
    color: "#9E9E9E",
    marginTop: 4,
    textAlign: "center",
  },
  addTimerButton: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    shadowColor: Shadows.sm.shadowColor,
    shadowOffset: Shadows.sm.shadowOffset,
    shadowOpacity: Shadows.sm.shadowOpacity,
    shadowRadius: Shadows.sm.shadowRadius,
    elevation: Shadows.sm.elevation,
  },
  addTimerButtonContent: {
    paddingVertical: Spacing.sm,
  },
  addTimerButtonLabel: {
    fontSize: Typography.body1.fontSize,
    fontWeight: '600',
  },
  metricsSection: {
    padding: 16,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    elevation: 2,
  },
  voltageCard: {
    marginRight: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#FB8C00",
  },
  currentCard: {
    marginLeft: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#4361EE",
  },
  powerCard: {
    borderRadius: 12,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  metricContent: {
    alignItems: "flex-start",
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 8,
    color: "#212121",
  },
  metricLabel: {
    fontSize: 14,
    color: "#757575",
    marginBottom: 4,
  },
  metricRange: {
    fontSize: 12,
    color: "#9E9E9E",
  },
  costSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  costCard: {
    borderRadius: 12,
    elevation: 2,
    backgroundColor: "#FFFFFF",
  },
  costHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  costInfo: {
    marginLeft: 16,
    flex: 1,
  },
  costLabel: {
    fontSize: 14,
    color: "#757575",
    marginBottom: 4,
  },
  costValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#4361EE",
  },
  costDetails: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.1)",
  },
  costDetailItem: {
    alignItems: "center",
  },
  costDetailLabel: {
    fontSize: 12,
    color: "#757575",
    marginBottom: 4,
  },
  costDetailValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212121",
  },
  costTrackingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(67, 97, 238, 0.1)",
    borderRadius: 8,
  },
  costTrackingText: {
    fontSize: 14,
    color: "#4361EE",
    fontWeight: "600",
    marginLeft: 6,
  },
  chartCard: {
    margin: 16,
    borderRadius: 12,
    elevation: 2,
  },
  chartContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  chart: {
    borderRadius: 16,
  },
  // Device Card Styles
  deviceCountBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.round,
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  deviceCount: {
    fontSize: Typography.body2.fontSize,
    fontWeight: 'bold',
    color: "#FFFFFF",
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: Typography.body1.fontSize,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  deviceType: {
    fontSize: Typography.caption.fontSize,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  deviceStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  deviceStatusText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
  },
  viewAllDevicesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(67, 97, 238, 0.1)',
    borderRadius: BorderRadius.md,
  },
  viewAllDevicesText: {
    fontSize: Typography.body2.fontSize,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: Spacing.xs,
  },
})

export default HomeScreen
