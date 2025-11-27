import React, { useState, useEffect } from "react"
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Dimensions, Alert, Modal } from "react-native"
import { Text, Card, Button, Appbar, IconButton, Chip, ProgressBar, FAB, TextInput } from "react-native-paper"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { realtimeDb, auth } from "../config/firebase"
import { ref, onValue, set } from "firebase/database"
import CustomAlert from "../components/CustomAlert"
import {
  getOverallSafetyStatus,
  getSafetyStatusColor,
  getSafetyStatusIcon,
  getSafetyRecommendations,
  getEmergencyShutdownCommand,
  SAFETY_THRESHOLDS
} from "../utils/safetyFeatures"

const { width } = Dimensions.get("window")

const SafetyScreen = ({ navigation }) => {
  const [safetyStatus, setSafetyStatus] = useState({
    status: 'safe',
    message: 'All Systems Safe',
    alerts: [],
    action: 'NONE'
  })
  const [powerData, setPowerData] = useState({
    voltage: 0,
    current: 0,
    power: 0,
    temperature: null
  })
  const [lastUpdate, setLastUpdate] = useState(null)
  const [isEmergencyMode, setIsEmergencyMode] = useState(false)
  const [alertVisible, setAlertVisible] = useState(false)
  const [alertConfig, setAlertConfig] = useState({})
  const [showBudgetConfig, setShowBudgetConfig] = useState(false)
  const [energyBudget, setEnergyBudget] = useState({
    dailyLimit: 10,
    warningThreshold: 80,
    currentUsage: 0,
  })
  const [budgetLimit, setBudgetLimit] = useState("10")
  const [budgetThreshold, setBudgetThreshold] = useState("80")
  const [savingBudget, setSavingBudget] = useState(false)

  useEffect(() => {
    // Listen to power data
    const voltageRef = ref(realtimeDb, 'voltage')
    const currentRef = ref(realtimeDb, 'current')
    const powerRef = ref(realtimeDb, 'power')
    const temperatureRef = ref(realtimeDb, 'temperature')

    const voltageListener = onValue(voltageRef, (snapshot) => {
      const voltage = snapshot.val()
      if (voltage !== null) {
        setPowerData(prev => ({ ...prev, voltage: Number(voltage) }))
        setLastUpdate(new Date())
      }
    })

    const currentListener = onValue(currentRef, (snapshot) => {
      const current = snapshot.val()
      if (current !== null) {
        setPowerData(prev => ({ ...prev, current: Number(current) }))
      }
    })

    const powerListener = onValue(powerRef, (snapshot) => {
      const power = snapshot.val()
      if (power !== null) {
        setPowerData(prev => ({ ...prev, power: Number(power) }))
      }
    })

    const temperatureListener = onValue(temperatureRef, (snapshot) => {
      const temperature = snapshot.val()
      if (temperature !== null) {
        setPowerData(prev => ({ ...prev, temperature: Number(temperature) }))
      }
    })

    return () => {
      voltageListener()
      currentListener()
      powerListener()
      temperatureListener()
    }
  }, [])

  // Update safety status when data changes
  useEffect(() => {
    const newSafetyStatus = getOverallSafetyStatus(
      powerData.voltage,
      powerData.current,
      powerData.power,
      powerData.temperature,
      lastUpdate
    )
    setSafetyStatus(newSafetyStatus)

    // Handle emergency shutdown
    if (newSafetyStatus.action === 'EMERGENCY_SHUTDOWN' && !isEmergencyMode) {
      handleEmergencyShutdown()
    }
  }, [powerData, lastUpdate, isEmergencyMode])

  // Load energy budget from Firebase
  useEffect(() => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    const budgetRef = ref(realtimeDb, `users/${userId}/energySettings`)
    const listener = onValue(budgetRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setEnergyBudget({
          dailyLimit: data.dailyLimit || 10,
          warningThreshold: data.warningThreshold || 80,
          currentUsage: data.currentUsage || 0,
        })
        setBudgetLimit(String(data.dailyLimit || 10))
        setBudgetThreshold(String(data.warningThreshold || 80))
      }
    })

    return () => listener()
  }, [])

  const showAlert = (message, type = 'info', onConfirm) => {
    setAlertConfig({
      message,
      type,
      onConfirm: onConfirm || (() => setAlertVisible(false))
    })
    setAlertVisible(true)
  }

  const handleSaveBudget = async () => {
    const limit = parseFloat(budgetLimit)
    const threshold = parseFloat(budgetThreshold)

    if (isNaN(limit) || limit <= 0) {
      showAlert('Please enter a valid daily limit', 'error')
      return
    }

    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      showAlert('Threshold must be between 0-100%', 'error')
      return
    }

    setSavingBudget(true)
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('No user ID')

      const budgetData = {
        dailyLimit: limit,
        warningThreshold: threshold,
        currentUsage: energyBudget.currentUsage,
        lastUpdated: new Date().toISOString(),
      }

      await set(ref(realtimeDb, `users/${userId}/energySettings`), budgetData)
      
      setShowBudgetConfig(false)
      showAlert('Energy budget saved successfully!', 'success')
      console.log(`✅ Energy budget saved for user ${userId}`)
    } catch (error) {
      console.error('Error saving budget:', error)
      showAlert('Failed to save budget settings', 'error')
    } finally {
      setSavingBudget(false)
    }
  }

  const handleEmergencyShutdown = async () => {
    setIsEmergencyMode(true)
    showAlert(
      'CRITICAL SAFETY ALERT!\nEmergency shutdown activated for your safety.',
      'error',
      () => {
        setAlertVisible(false)
        executeEmergencyShutdown()
      }
    )
  }

  const executeEmergencyShutdown = async () => {
    try {
      // Turn off relay only - this will cut power supply
      await set(ref(realtimeDb, 'relay'), 'off')
      console.log('✅ Emergency shutdown: Relay turned OFF - Power supply cut')
      
      showAlert('Emergency shutdown completed. Power supply cut for safety.', 'success')
    } catch (error) {
      console.error('Emergency shutdown error:', error)
      showAlert('Emergency shutdown failed. Please manually turn off the switch.', 'error')
    }
  }

  const handleManualEmergencyShutdown = () => {
    showAlert(
      'Are you sure you want to perform emergency shutdown? This will turn off ALL devices.',
      'warning',
      () => {
        setAlertVisible(false)
        executeEmergencyShutdown()
      }
    )
  }

  const resetEmergencyMode = () => {
    setIsEmergencyMode(false)
    showAlert('Emergency mode reset. You can now control devices normally.', 'success')
  }

  const getStatusColor = () => getSafetyStatusColor(safetyStatus.status)
  const getStatusIcon = () => getSafetyStatusIcon(safetyStatus.status)
  const recommendations = getSafetyRecommendations(safetyStatus)

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4361EE" />
      
      <Appbar.Header style={styles.header}>
        <Appbar.Content title="Safety Dashboard" titleStyle={styles.headerTitle} />
        <IconButton 
          icon="refresh" 
          iconColor="#FFFFFF" 
          onPress={() => setLastUpdate(new Date())} 
        />
      </Appbar.Header>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Emergency Status Card */}
        <Card style={[styles.statusCard, { borderColor: getStatusColor() }]}>
          <Card.Content style={styles.statusContent}>
            <View style={styles.statusHeader}>
              <MaterialCommunityIcons 
                name={getStatusIcon()} 
                size={32} 
                color={getStatusColor()} 
              />
              <View style={styles.statusInfo}>
                <Text style={[styles.statusTitle, { color: getStatusColor() }]}>
                  {safetyStatus.message}
                </Text>
                <Text style={styles.statusSubtitle}>
                  Last Update: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
                </Text>
              </View>
            </View>
            
            {safetyStatus.alerts.length > 0 && (
              <View style={styles.alertsContainer}>
                {safetyStatus.alerts.map((alert, index) => (
                  <Chip
                    key={index}
                    icon="alert"
                    style={[styles.alertChip, { backgroundColor: getStatusColor() + '20' }]}
                    textStyle={{ color: getStatusColor() }}
                  >
                    {alert.message}
                  </Chip>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Real-time Monitoring */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Real-time Monitoring</Text>
            
            <View style={styles.metricsGrid}>
              {/* Voltage */}
              <View style={styles.metricItem}>
                <View style={styles.metricHeader}>
                  <MaterialCommunityIcons name="flash" size={20} color="#4361EE" />
                  <Text style={styles.metricLabel}>Voltage</Text>
                </View>
                <Text style={styles.metricValue}>{powerData.voltage.toFixed(1)}V</Text>
                <ProgressBar 
                  progress={powerData.voltage / SAFETY_THRESHOLDS.MAX_VOLTAGE} 
                  color={powerData.voltage > SAFETY_THRESHOLDS.MAX_VOLTAGE ? '#F44336' : '#4CAF50'}
                  style={styles.progressBar}
                />
                <Text style={styles.metricRange}>
                  Safe: {SAFETY_THRESHOLDS.MIN_VOLTAGE}V - {SAFETY_THRESHOLDS.MAX_VOLTAGE}V
                </Text>
              </View>

              {/* Current */}
              <View style={styles.metricItem}>
                <View style={styles.metricHeader}>
                  <MaterialCommunityIcons name="flash" size={20} color="#FF9800" />
                  <Text style={styles.metricLabel}>Current</Text>
                </View>
                <Text style={styles.metricValue}>{powerData.current.toFixed(2)}A</Text>
                <ProgressBar 
                  progress={powerData.current / SAFETY_THRESHOLDS.MAX_CURRENT} 
                  color={powerData.current > SAFETY_THRESHOLDS.MAX_CURRENT ? '#F44336' : '#4CAF50'}
                  style={styles.progressBar}
                />
                <Text style={styles.metricRange}>
                  Max: {SAFETY_THRESHOLDS.MAX_CURRENT}A
                </Text>
              </View>

              {/* Power */}
              <View style={styles.metricItem}>
                <View style={styles.metricHeader}>
                  <MaterialCommunityIcons name="power" size={20} color="#4CAF50" />
                  <Text style={styles.metricLabel}>Power</Text>
                </View>
                <Text style={styles.metricValue}>{powerData.power.toFixed(0)}W</Text>
                <ProgressBar 
                  progress={powerData.power / SAFETY_THRESHOLDS.MAX_POWER} 
                  color={powerData.power > SAFETY_THRESHOLDS.MAX_POWER ? '#F44336' : '#4CAF50'}
                  style={styles.progressBar}
                />
                <Text style={styles.metricRange}>
                  Max: {SAFETY_THRESHOLDS.MAX_POWER}W
                </Text>
              </View>

              {/* Temperature */}
              {powerData.temperature && (
                <View style={styles.metricItem}>
                  <View style={styles.metricHeader}>
                    <MaterialCommunityIcons name="thermometer" size={20} color="#F44336" />
                    <Text style={styles.metricLabel}>Temperature</Text>
                  </View>
                  <Text style={styles.metricValue}>{powerData.temperature.toFixed(1)}°C</Text>
                  <ProgressBar 
                    progress={powerData.temperature / SAFETY_THRESHOLDS.MAX_TEMPERATURE} 
                    color={powerData.temperature > SAFETY_THRESHOLDS.MAX_TEMPERATURE ? '#F44336' : '#4CAF50'}
                    style={styles.progressBar}
                  />
                  <Text style={styles.metricRange}>
                    Max: {SAFETY_THRESHOLDS.MAX_TEMPERATURE}°C
                  </Text>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>


        {/* Energy Budget (FR09) */}
        <Card style={styles.energyBudgetCard}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="chart-donut" size={24} color="#4361EE" />
              <Text style={styles.cardTitle}>Energy Budget</Text>
            </View>
            
            <View style={styles.budgetContainer}>
              <Text style={styles.budgetLabel}>Daily Limit: {energyBudget.dailyLimit} kWh</Text>
              <Text style={styles.budgetSubLabel}>Warning at {energyBudget.warningThreshold}%</Text>
              
              <ProgressBar 
                progress={energyBudget.currentUsage / energyBudget.dailyLimit} 
                color={
                  (energyBudget.currentUsage / energyBudget.dailyLimit) >= (energyBudget.warningThreshold / 100)
                    ? '#F44336'
                    : '#4361EE'
                }
                style={styles.progressBar}
              />
              
              <View style={styles.usageStats}>
                <Text style={styles.usageText}>
                  {energyBudget.currentUsage.toFixed(2)} kWh used
                </Text>
                <Text style={styles.usageText}>
                  {(energyBudget.dailyLimit - energyBudget.currentUsage).toFixed(2)} kWh remaining
                </Text>
              </View>
              
              <Button
                mode="contained"
                icon="cog"
                onPress={() => setShowBudgetConfig(true)}
                style={styles.configButton}
                buttonColor="#4361EE"
              >
                Configure Budget
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Emergency Controls - No Card */}
        <View style={styles.emergencySection}>
          <Text style={styles.emergencySectionTitle}>Emergency Controls</Text>
          
          {isEmergencyMode ? (
            <View style={styles.emergencyModeContainer}>
              <MaterialCommunityIcons name="alert-octagon" size={48} color="#F44336" />
              <Text style={styles.emergencyModeText}>EMERGENCY MODE ACTIVE</Text>
              <Text style={styles.emergencyModeSubtext}>
                All devices are shut down for safety. Reset when safe to continue.
              </Text>
              <Button
                mode="contained"
                onPress={resetEmergencyMode}
                style={styles.resetButton}
                buttonColor="#4CAF50"
              >
                Reset Emergency Mode
              </Button>
            </View>
          ) : (
            <View style={styles.emergencyControlsContainer}>
              <Button
                mode="contained"
                icon="power-off"
                onPress={handleManualEmergencyShutdown}
                style={styles.emergencyButton}
                buttonColor="#F44336"
              >
                Emergency Shutdown
              </Button>
              <Text style={styles.emergencyWarning}>
                Use only in case of electrical emergency
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Emergency FAB */}
      {!isEmergencyMode && (
        <FAB
          icon="alert-octagon"
          style={[styles.emergencyFAB, { backgroundColor: '#F44336' }]}
          onPress={handleManualEmergencyShutdown}
          label="Emergency"
        />
      )}

      {/* Configure Budget Modal */}
      <Modal
        visible={showBudgetConfig}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBudgetConfig(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configure Energy Budget</Text>
              <TouchableOpacity onPress={() => setShowBudgetConfig(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#212121" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                label="Daily Limit (kWh)"
                value={budgetLimit}
                onChangeText={setBudgetLimit}
                keyboardType="numeric"
                mode="outlined"
                placeholder="10"
                style={styles.budgetInput}
                activeOutlineColor="#4361EE"
                left={<TextInput.Icon icon="flash" />}
              />
              
              <Text style={styles.inputHint}>
                Set maximum energy consumption per day in kilowatt-hours
              </Text>

              <TextInput
                label="Warning Threshold (%)"
                value={budgetThreshold}
                onChangeText={setBudgetThreshold}
                keyboardType="numeric"
                mode="outlined"
                placeholder="80"
                style={styles.budgetInput}
                activeOutlineColor="#4361EE"
                left={<TextInput.Icon icon="percent" />}
              />
              
              <Text style={styles.inputHint}>
                Get notified when you reach this percentage of your daily limit
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <Button
                mode="outlined"
                onPress={() => setShowBudgetConfig(false)}
                style={styles.modalCancelButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveBudget}
                style={styles.modalSaveButton}
                buttonColor="#4361EE"
                loading={savingBudget}
                disabled={savingBudget}
              >
                Save Budget
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        onDismiss={() => setAlertVisible(false)}
        {...alertConfig}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    backgroundColor: "#4361EE",
    elevation: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  statusCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    elevation: 4,
    borderWidth: 2,
  },
  statusContent: {
    padding: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusInfo: {
    marginLeft: 16,
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusSubtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  alertsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  alertChip: {
    marginTop: 8,
  },
  monitoringCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#1A1A1A",
    marginBottom: 16,
  },
  metricsGrid: {
    gap: 20,
    marginTop: 8,
  },
  metricItem: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginLeft: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  metricRange: {
    fontSize: 12,
    color: '#666666',
  },
  recommendationsCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    elevation: 2,
  },
  recommendationItem: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4361EE',
  },
  recommendationHeader: {
    marginBottom: 8,
  },
  priorityChip: {
    alignSelf: 'flex-start',
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  recommendationMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  recommendationAction: {
    fontSize: 12,
    color: '#666666',
  },
  energyBudgetCard: {
    marginHorizontal: 16,
    marginTop: 32,
    marginBottom: 24,
    elevation: 2,
  },
  emergencySection: {
    marginHorizontal: 16,
    marginTop: 72,
    marginBottom: 40,
  },
  emergencySectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  emergencyModeContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F44336',
  },
  emergencyModeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
    marginTop: 12,
    textAlign: 'center',
  },
  emergencyModeSubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 20,
  },
  resetButton: {
    borderRadius: 8,
  },
  emergencyControlsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emergencyButton: {
    borderRadius: 12,
    marginBottom: 12,
    paddingVertical: 4,
  },
  emergencyWarning: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  emergencyFAB: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  modalBody: {
    padding: 20,
  },
  budgetInput: {
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
  },
  modalSaveButton: {
    flex: 1,
  },
})

export default SafetyScreen
