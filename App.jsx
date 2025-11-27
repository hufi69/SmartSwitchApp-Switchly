import React, { useState, useEffect, useRef } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context"
import { StatusBar, ActivityIndicator, View } from "react-native"
import { MD3LightTheme as DefaultTheme, Provider as PaperProvider } from "react-native-paper"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth, realtimeDb } from "./src/config/firebase"
import { getSavedCredentials } from "./src/utils/storage"
import { ref, get } from "firebase/database"
import { Colors, BorderRadius } from "./src/config/theme"
import * as Notifications from 'expo-notifications'

// Screens
import LoginScreen from "./src/screens/LoginScreen"
import SignupScreen from "./src/screens/SignupScreen"
import DeviceOnboardingScreen from "./src/screens/DeviceOnboardingScreen"
import HomeScreen from "./src/screens/HomeScreen"
import DevicesScreen from "./src/screens/DevicesScreen"
import AnalyticsScreen from "./src/screens/AnalyticsScreen"
import HistoryScreen from "./src/screens/HistoryScreen"
import ProfileScreen from "./src/screens/ProfileScreen"
import CostTrackingScreen from "./src/screens/CostTrackingScreen"
import SafetyScreen from "./src/screens/SafetyScreen"
import NotificationsScreen from "./src/screens/NotificationsScreen"
import SettingsScreen from "./src/screens/SettingsScreen"
import SmartChargingScreen from "./src/screens/SmartChargingScreen"

const Stack = createStackNavigator()
const Tab = createBottomTabNavigator()

// Bottom Tab Navigator Component with Safe Area
const MainTabNavigator = () => {
  const insets = useSafeAreaInsets()
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 70 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 10,
          elevation: 8,
          shadowColor: Colors.shadowColor,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
          marginBottom: 0,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Devices"
        component={DevicesScreen}
        options={{
          tabBarLabel: "Devices",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "devices" : "devices"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: "History",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "history" : "history"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Safety"
        component={SafetyScreen}
        options={{
          tabBarLabel: "Safety",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "shield-check" : "shield-check-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: "Analytics",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "chart-line" : "chart-line-variant"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  )
}

// Enhanced custom theme with modern design tokens
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    secondary: Colors.primaryDark,
    accent: Colors.accent,
    background: Colors.background,
    surface: Colors.surface,
    text: Colors.text,
    error: Colors.danger,
    success: Colors.success,
    warning: Colors.warning,
    info: Colors.info,
    onSurface: Colors.text,
    onSurfaceVariant: Colors.textSecondary,
    outline: Colors.border,
  },
  roundness: BorderRadius.md,
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [hasDevice, setHasDevice] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const notificationListener = useRef()
  const responseListener = useRef()

  // Check for saved credentials on app launch
  useEffect(() => {
    checkSavedCredentials()
  }, [])


  useEffect(() => {
    if (isAuthenticated && auth.currentUser) {
      checkUserHasDevice()
    } else {
    
      setHasDevice(false)
    }
  }, [isAuthenticated])

  const checkUserHasDevice = async () => {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) {
        setHasDevice(false)
        return
      }

   
      const devicesRef = ref(realtimeDb, `users/${userId}/devices`)
      const snapshot = await get(devicesRef)
      
      if (snapshot.exists() && snapshot.val()) {
        const devices = snapshot.val()
        const deviceCount = Object.keys(devices).length
        console.log(` User has ${deviceCount} device(s) - onboarding completed`)
        setHasDevice(true)
      } else {
        console.log(" User has no devices - showing onboarding screen")
        setHasDevice(false)
      }
    } catch (error) {
      console.error("Error checking user devices:", error)
      
      setHasDevice(false)
    }
  }

  // Setup notification listeners (only in production build)
  useEffect(() => {
    try {
      // Listener for notifications received while app is in foreground
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('📬 Notification received:', notification.request.content.title)
      })

      // Listener for when user taps on notification
      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('👆 User tapped notification:', response.notification.request.content.data)
      })

      return () => {
      
        try {
          if (notificationListener.current && Notifications.removeNotificationSubscription) {
            Notifications.removeNotificationSubscription(notificationListener.current)
          }
          if (responseListener.current && Notifications.removeNotificationSubscription) {
            Notifications.removeNotificationSubscription(responseListener.current)
          }
        } catch (e) {
         
          console.log(' Expo Go mode - notification cleanup skipped')
        }
      }
    } catch (error) {
      console.log(' Notification listeners not available in Expo Go')
      return () => {}
    }
  }, [])

  const checkSavedCredentials = async () => {
    try {
      const savedCredentials = await getSavedCredentials()

      if (savedCredentials) {
        // Auto-login with saved credentials
        console.log("Found saved credentials, attempting auto-login...")
        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            savedCredentials.email,
            savedCredentials.password
          )
          console.log("Auto-login successful:", userCredential.user.email)
          setIsAuthenticated(true)
       
        } catch (error) {
          console.log("Auto-login failed:", error.message)
         
        }
      }
    } catch (error) {
      console.error("Error checking saved credentials:", error)
    } finally {
      setIsCheckingAuth(false)
    }
  }

  // Show loading screen while checking auth
  if (isCheckingAuth) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8F9FA" }}>
            <ActivityIndicator size="large" color="#4361EE" />
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: theme.colors.background },
            }}
          >
            {!isAuthenticated ? (
              // Auth screens
              <>
                <Stack.Screen name="Login">
                  {(props) => <LoginScreen {...props} setIsAuthenticated={setIsAuthenticated} />}
                </Stack.Screen>
                <Stack.Screen name="Signup">
                  {(props) => <SignupScreen {...props} setIsAuthenticated={setIsAuthenticated} />}
                </Stack.Screen>
              </>
            ) : !hasDevice ? (
              // Device onboarding
              <Stack.Screen name="DeviceOnboarding">
                {(props) => <DeviceOnboardingScreen {...props} setHasDevice={setHasDevice} />}
              </Stack.Screen>
            ) : (
              // Main app with bottom tabs
                  <>
                    <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
                    {/* Additional screens accessible via navigation */}
                    <Stack.Screen name="CostTracking" component={CostTrackingScreen} />
                    <Stack.Screen name="Notifications" component={NotificationsScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen name="SmartCharging" component={SmartChargingScreen} />
                    <Stack.Screen name="Profile">
                      {(props) => <ProfileScreen {...props} setIsAuthenticated={setIsAuthenticated} />}
                    </Stack.Screen>
                  </>
                )}
              </Stack.Navigator>
            </NavigationContainer>
          </PaperProvider>
        </SafeAreaProvider>
      )
    }
