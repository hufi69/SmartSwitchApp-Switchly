import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, StatusBar, Alert } from 'react-native'
import { Text, Card, Button, Appbar, TextInput, RadioButton, ProgressBar } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { auth, realtimeDb } from '../config/firebase'
import { ref, set } from 'firebase/database'
import { Colors, Spacing, BorderRadius, Typography } from '../config/theme'

const SmartChargingScreen = ({ navigation }) => {
  const [selectedDevice, setSelectedDevice] = useState('phone')
  const [startBattery, setStartBattery] = useState('20')
  const [endBattery, setEndBattery] = useState('80')
  const [calculatedRuntime, setCalculatedRuntime] = useState(0)

  const deviceTypes = {
    phone: { name: 'Phone Charger', capacity: 4000, rate: 2000 }, 
    laptop: { name: 'Laptop', capacity: 50000, rate: 3000 },
    tablet: { name: 'Tablet', capacity: 8000, rate: 2500 },
    powerbank: { name: 'Power Bank', capacity: 20000, rate: 2000 },
  }

  useEffect(() => {
    calculateRuntime()
  }, [startBattery, endBattery, selectedDevice])

  const calculateRuntime = () => {
    const start = parseInt(startBattery) || 0
    const end = parseInt(endBattery) || 0
    
    if (start >= end || end > 100) {
      setCalculatedRuntime(0)
      return
    }

    const device = deviceTypes[selectedDevice]
    const percentageDiff = end - start
    const energyNeeded = (device.capacity * percentageDiff) / 100
    const timeInMinutes = (energyNeeded / device.rate) * 60
    
    setCalculatedRuntime(timeInMinutes)
  }

  const formatRuntime = (minutes) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const handleCreateTimer = async () => {
    if (calculatedRuntime <= 0) {
      Alert.alert('Error', 'Invalid battery range')
      return
    }

    const userId = auth.currentUser?.uid
    if (!userId) {
      Alert.alert('Error', 'No user found')
      return
    }

    try {
      // Create timer based on calculated runtime
      const now = new Date()
      const endTime = new Date(now.getTime() + calculatedRuntime * 60 * 1000)
      
      const timerId = Date.now().toString()
      const timerData = {
        name: `${deviceTypes[selectedDevice].name} (${startBattery}%-${endBattery}%)`,
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
        days: [now.getDay()],
        enabled: true,
        createdAt: new Date().toISOString(),
        scheduleType: 'smart_charging',
        deviceType: selectedDevice,
        startBattery: parseInt(startBattery),
        endBattery: parseInt(endBattery),
        estimatedRuntime: calculatedRuntime,
      }

      await set(ref(realtimeDb, `users/${userId}/timers/${timerId}`), timerData)
      
      Alert.alert(
        'Success!',
        `Smart charging timer created!\nEstimated time: ${formatRuntime(calculatedRuntime)}`,
        [
          {
            text: 'View Timers',
            onPress: () => navigation.navigate('Home')
          },
          { text: 'OK' }
        ]
      )
    } catch (error) {
      console.error('Error creating timer:', error)
      Alert.alert('Error', 'Failed to create timer')
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#FFFFFF" />
        <Appbar.Content title="Smart Charging" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        {/* Device Type Selection */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Select Device Type</Text>
            <RadioButton.Group onValueChange={setSelectedDevice} value={selectedDevice}>
              {Object.entries(deviceTypes).map(([key, device]) => (
                <RadioButton.Item
                  key={key}
                  label={device.name}
                  value={key}
                  color={Colors.primary}
                  style={styles.radioItem}
                />
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>

        {/* Battery Range */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Battery Range</Text>
            
            <TextInput
              label="Start Battery %"
              value={startBattery}
              onChangeText={(text) => {
                const num = text.replace(/[^0-9]/g, '')
                if (num === '' || (parseInt(num) >= 0 && parseInt(num) <= 100)) {
                  setStartBattery(num)
                }
              }}
              keyboardType="numeric"
              mode="outlined"
              left={<TextInput.Icon icon="battery-low" />}
              style={styles.input}
            />
            
            <TextInput
              label="End Battery %"
              value={endBattery}
              onChangeText={(text) => {
                const num = text.replace(/[^0-9]/g, '')
                if (num === '' || (parseInt(num) >= 0 && parseInt(num) <= 100)) {
                  setEndBattery(num)
                }
              }}
              keyboardType="numeric"
              mode="outlined"
              left={<TextInput.Icon icon="battery-high" />}
              style={styles.input}
            />
          </Card.Content>
        </Card>

        {/* Calculation Result */}
        <Card style={styles.resultCard}>
          <Card.Content>
            <View style={styles.resultHeader}>
              <MaterialCommunityIcons name="calculator" size={28} color={Colors.primary} />
              <Text style={styles.resultTitle}>Estimated Charging Time</Text>
            </View>
            
            <View style={styles.runtimeDisplay}>
              <Text style={styles.runtimeValue}>{formatRuntime(calculatedRuntime)}</Text>
              <Text style={styles.runtimeLabel}>
                {startBattery}% → {endBattery}%
              </Text>
            </View>
            
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceInfoText}>
                Device: {deviceTypes[selectedDevice].name}
              </Text>
              <Text style={styles.deviceInfoText}>
                Capacity: {deviceTypes[selectedDevice].capacity} mAh
              </Text>
              <Text style={styles.deviceInfoText}>
                Charge Rate: {deviceTypes[selectedDevice].rate} mA
              </Text>
            </View>

            <Button
              mode="contained"
              icon="timer-plus"
              onPress={handleCreateTimer}
              style={styles.createButton}
              buttonColor={Colors.primary}
              disabled={calculatedRuntime <= 0}
            >
              Create Smart Charging Timer
            </Button>
          </Card.Content>
        </Card>

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
  resultCard: {
    margin: Spacing.md,
    marginTop: Spacing.md,
    backgroundColor: '#F0F4FF',
    borderRadius: BorderRadius.lg,
    elevation: 2,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  radioItem: {
    paddingVertical: 0,
  },
  input: {
    marginBottom: Spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },
  runtimeDisplay: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  runtimeValue: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.primary,
  },
  runtimeLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  deviceInfo: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  deviceInfoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  createButton: {
    marginTop: Spacing.sm,
  },
})

export default SmartChargingScreen

