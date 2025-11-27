import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, StatusBar, Alert } from 'react-native'
import { Text, Card, Switch, Appbar, List, Divider, Button } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { auth, realtimeDb } from '../config/firebase'
import { ref, onValue, set } from 'firebase/database'
import { sendPasswordResetEmail } from 'firebase/auth'
import { Colors, Spacing, BorderRadius, Typography } from '../config/theme'

const SettingsScreen = ({ navigation }) => {
  const [settings, setSettings] = useState({
    smartChargingEnabled: true,
    pushNotificationsEnabled: true,
    notificationSound: true,
    notificationVibration: true,
    energyBudgetEnabled: false,
  })

  // Load settings from Firebase
  useEffect(() => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    const settingsRef = ref(realtimeDb, `users/${userId}/settings`)
    const listener = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setSettings(data)
      }
    })

    return () => listener()
  }, [])

  const updateSetting = async (key, value) => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    try {
      const newSettings = { ...settings, [key]: value }
      setSettings(newSettings)
      
      await set(ref(realtimeDb, `users/${userId}/settings`), newSettings)
      console.log(`✅ Setting updated: ${key} = ${value}`)
    } catch (error) {
      console.error('Error updating setting:', error)
      Alert.alert('Error', 'Failed to update setting')
    }
  }

  const handlePasswordReset = async () => {
    const email = auth.currentUser?.email
    if (!email) {
      Alert.alert('Error', 'No email found')
      return
    }

    Alert.alert(
      'Reset Password',
      `Send password reset email to ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Email',
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, email)
              Alert.alert('Success', 'Password reset email sent! Check your inbox.')
            } catch (error) {
              console.error('Error sending reset email:', error)
              Alert.alert('Error', 'Failed to send reset email')
            }
          }
        }
      ]
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#FFFFFF" />
        <Appbar.Content title="Settings" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        {/* Features Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Features</Text>
            
            <List.Item
              title="Smart Charging"
              description="Enable battery-based charging optimization"
              left={props => <MaterialCommunityIcons name="battery-charging" size={24} color={Colors.primary} {...props} />}
              right={() => (
                <Switch
                  value={settings.smartChargingEnabled}
                  onValueChange={(value) => updateSetting('smartChargingEnabled', value)}
                  color={Colors.primary}
                />
              )}
              style={styles.listItem}
            />
            
            <Divider />
            
            <List.Item
              title="Energy Budget Alerts"
              description="Get notified when daily limit is reached"
              left={props => <MaterialCommunityIcons name="chart-donut" size={24} color={Colors.primary} {...props} />}
              right={() => (
                <Switch
                  value={settings.energyBudgetEnabled}
                  onValueChange={(value) => updateSetting('energyBudgetEnabled', value)}
                  color={Colors.primary}
                />
              )}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* Notification Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Notifications</Text>
            
            <List.Item
              title="Push Notifications"
              description="Receive alerts and updates"
              left={props => <MaterialCommunityIcons name="bell-ring" size={24} color={Colors.primary} {...props} />}
              right={() => (
                <Switch
                  value={settings.pushNotificationsEnabled}
                  onValueChange={(value) => updateSetting('pushNotificationsEnabled', value)}
                  color={Colors.primary}
                />
              )}
              style={styles.listItem}
            />
            
            <Divider />
            
            <List.Item
              title="Notification Sound"
              description="Play sound for notifications"
              left={props => <MaterialCommunityIcons name="volume-high" size={24} color={Colors.primary} {...props} />}
              right={() => (
                <Switch
                  value={settings.notificationSound}
                  onValueChange={(value) => updateSetting('notificationSound', value)}
                  color={Colors.primary}
                  disabled={!settings.pushNotificationsEnabled}
                />
              )}
              style={styles.listItem}
            />
            
            <Divider />
            
            <List.Item
              title="Notification Vibration"
              description="Vibrate for notifications"
              left={props => <MaterialCommunityIcons name="vibrate" size={24} color={Colors.primary} {...props} />}
              right={() => (
                <Switch
                  value={settings.notificationVibration}
                  onValueChange={(value) => updateSetting('notificationVibration', value)}
                  color={Colors.primary}
                  disabled={!settings.pushNotificationsEnabled}
                />
              )}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>


        {/* About */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>About</Text>
            
            <List.Item
              title="App Version"
              description="1.0.0"
              left={props => <MaterialCommunityIcons name="information" size={24} color={Colors.primary} {...props} />}
              style={styles.listItem}
            />
            
            <Divider />
            
            {/* <List.Item
              title="FYP Project"
              description="IoT based Smart Switch with Custom App"
              left={props => <MaterialCommunityIcons name="school" size={24} color={Colors.primary} {...props} />}
              style={styles.listItem}
            />
            
            <Divider /> */}
            
            <List.Item
              title="Developers"
              description="Muhammad Huzaifa"
              left={props => <MaterialCommunityIcons name="account-group" size={24} color={Colors.primary} {...props} />}
              style={styles.listItem}
            />
          </Card.Content>
        </Card>

        {/* Energy Budget Settings */}
        {settings.energyBudgetEnabled && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Energy Budget</Text>
              <Text style={styles.sectionDescription}>
                Configure daily energy limits and alerts
              </Text>
              <Button
                mode="outlined"
                icon="cog"
                onPress={() => {
                  navigation.goBack()
                  setTimeout(() => {
                    navigation.navigate('MainTabs', { screen: 'Safety' })
                  }, 100)
                }}
                style={styles.configButton}
              >
                Configure Budget
              </Button>
            </Card.Content>
          </Card>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    elevation: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: Spacing.md,
    marginBottom: 0,
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  listItem: {
    paddingVertical: Spacing.xs,
  },
  configButton: {
    marginTop: Spacing.sm,
  },
})

export default SettingsScreen

