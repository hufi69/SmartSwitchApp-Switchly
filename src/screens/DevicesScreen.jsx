import React, { useState, useEffect } from "react"
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity, Dimensions, Modal, Alert } from "react-native"
import { Text, Card, Switch, Appbar, IconButton, Chip, Button, FAB, TextInput, RadioButton } from "react-native-paper"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { realtimeDb, auth } from "../config/firebase"
import { ref, onValue, set, remove } from "firebase/database"
import CustomAlert from "../components/CustomAlert"

const { width } = Dimensions.get("window")

const DevicesScreen = ({ navigation }) => {
  const [devices, setDevices] = useState({})
  const [loading, setLoading] = useState(true)
  const [alertVisible, setAlertVisible] = useState(false)
  const [alertConfig, setAlertConfig] = useState({})
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false)
  const [newDeviceName, setNewDeviceName] = useState("")
  const [newDeviceType, setNewDeviceType] = useState("bulb")
  const [addingDevice, setAddingDevice] = useState(false)

  useEffect(() => {
    const userId = auth.currentUser?.uid
    if (!userId) {
      console.error('No user ID found for DevicesScreen')
      setLoading(false)
      return
    }

    console.log(' Loading devices for user:', userId)

    // Listen to user-specific devices
    const devicesRef = ref(realtimeDb, `users/${userId}/devices`)
    const listener = onValue(devicesRef, (snapshot) => {
      const devicesData = snapshot.val()
      if (devicesData) {
        setDevices(devicesData)
        console.log(`Loaded ${Object.keys(devicesData).length} devices`)
      } else {
        setDevices({})
        console.log(' No devices found for user')
      }
      setLoading(false)
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

  const toggleDevice = async (deviceId) => {
    const userId = auth.currentUser?.uid
    if (!userId) {
      showAlert('No user ID found', 'error')
      return
    }

    const device = devices[deviceId]
    const newStatus = device.status === 'on' ? 'off' : 'on'
    
    try {
      await set(ref(realtimeDb, `users/${userId}/devices/${deviceId}/status`), newStatus)
      
      // If turning device ON, also turn on main switch automatically
      if (newStatus === 'on') {
        console.log('🔛 Turning main switch ON (device activated from DevicesScreen)')
        await set(ref(realtimeDb, 'relay'), 'on')
      } else {
        // Device turned OFF - check if any other device is still ON
        const updatedDevices = { ...devices, [deviceId]: { ...device, status: newStatus } }
        const hasAnyDeviceOn = Object.values(updatedDevices).some(d => d.status === 'on')
        
        if (!hasAnyDeviceOn) {
          // No devices are ON, turn off main switch
          console.log('🔴 Turning main switch OFF (no devices active)')
          await set(ref(realtimeDb, 'relay'), 'off')
          console.log('✅ Main switch turned OFF automatically')
        } else {
          console.log('ℹ️ Other devices still active, keeping main switch ON')
        }
      }
      
      showAlert(
        `${device.name} turned ${newStatus.toUpperCase()}`,
        'success'
      )
    } catch (error) {
      console.error('Error toggling device:', error)
      showAlert('Failed to control device', 'error')
    }
  }

  const toggleAllDevices = async (turnOn) => {
    const userId = auth.currentUser?.uid
    if (!userId) {
      showAlert('No user ID found', 'error')
      return
    }

    const promises = Object.keys(devices).map(deviceId => 
      set(ref(realtimeDb, `users/${userId}/devices/${deviceId}/status`), turnOn ? 'on' : 'off')
    )
    
    try {
      await Promise.all(promises)
      
      // Update relay based on all devices status
      if (turnOn) {
        console.log('🔛 Turning main switch ON (all devices activated)')
        await set(ref(realtimeDb, 'relay'), 'on')
      } else {
        console.log('🔴 Turning main switch OFF (all devices deactivated)')
        await set(ref(realtimeDb, 'relay'), 'off')
      }
      
      showAlert(
        `All devices turned ${turnOn ? 'ON' : 'OFF'}`,
        'success'
      )
    } catch (error) {
      console.error('Error toggling all devices:', error)
      showAlert('Failed to control devices', 'error')
    }
  }

  const handleAddDevice = async () => {
    if (!newDeviceName.trim()) {
      Alert.alert('Error', 'Please enter device name')
      return
    }

    const userId = auth.currentUser?.uid
    if (!userId) {
      Alert.alert('Error', 'No user found')
      return
    }

    setAddingDevice(true)
    try {
      const deviceId = `device_${Date.now()}`
      const deviceData = {
        name: newDeviceName.trim(),
        type: newDeviceType,
        status: 'off',
        createdAt: new Date().toISOString(),
      }

      await set(ref(realtimeDb, `users/${userId}/devices/${deviceId}`), deviceData)
      
      setNewDeviceName("")
      setNewDeviceType("bulb")
      setShowAddDeviceModal(false)
      
      showAlert(`Device "${newDeviceName}" added successfully!`, 'success')
      console.log(` Device added for user ${userId}:`, deviceId)
    } catch (error) {
      console.error('Error adding device:', error)
      Alert.alert('Error', 'Failed to add device')
    } finally {
      setAddingDevice(false)
    }
  }

  const handleDeleteDevice = async (deviceId, deviceName) => {
    Alert.alert(
      'Delete Device',
      `Are you sure you want to delete "${deviceName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const userId = auth.currentUser?.uid
            if (!userId) return

            try {
              await remove(ref(realtimeDb, `users/${userId}/devices/${deviceId}`))
              showAlert(`Device "${deviceName}" deleted`, 'success')
            } catch (error) {
              console.error('Error deleting device:', error)
              Alert.alert('Error', 'Failed to delete device')
            }
          }
        }
      ]
    )
  }

  const getTotalDevices = () => Object.keys(devices).length
  const getOnlineDevices = () => Object.values(devices).filter(device => device.status === 'on').length
  
  const deviceTypes = [
    { value: 'bulb', label: 'Light Bulb', icon: 'lightbulb' },
    { value: 'fan', label: 'Fan', icon: 'fan' },
    { value: 'tv', label: 'Television', icon: 'television' },
    { value: 'ac', label: 'Air Conditioner', icon: 'air-conditioner' },
    { value: 'heater', label: 'Heater', icon: 'radiator' },
    { value: 'charger', label: 'Charger', icon: 'battery-charging' },
    { value: 'other', label: 'Other', icon: 'power-plug' },
  ]

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="devices" size={48} color="#4361EE" />
        <Text style={styles.loadingText}>Loading devices...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4361EE" />
      
      <Appbar.Header style={styles.header}>
        <Appbar.Content title="Device Control" titleStyle={styles.headerTitle} />
        <IconButton icon="refresh" iconColor="#FFFFFF" onPress={() => setLoading(true)} />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <Card style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <MaterialCommunityIcons name="devices" size={24} color="#4361EE" />
              <View style={styles.summaryText}>
                <Text style={styles.summaryValue}>{getTotalDevices()}</Text>
                <Text style={styles.summaryLabel}>Total Devices</Text>
              </View>
            </Card.Content>
          </Card>

          <Card style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <MaterialCommunityIcons name="power" size={24} color="#4CAF50" />
              <View style={styles.summaryText}>
                <Text style={styles.summaryValue}>{getOnlineDevices()}</Text>
                <Text style={styles.summaryLabel}>Online</Text>
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* Bulk Controls */}
        <Card style={styles.bulkCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>Bulk Control</Text>
            <View style={styles.bulkButtons}>
              <Button
                mode="contained"
                icon="power-on"
                onPress={() => toggleAllDevices(true)}
                style={styles.bulkButton}
                buttonColor="#4CAF50"
              >
                Turn All ON
              </Button>
              <Button
                mode="contained"
                icon="power-off"
                onPress={() => toggleAllDevices(false)}
                style={styles.bulkButton}
                buttonColor="#F44336"
              >
                Turn All OFF
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* User's Devices List */}
        {getTotalDevices() > 0 ? (
          <Card style={styles.devicesListCard}>
            <Card.Content>
              <Text style={styles.cardTitle}>My Devices</Text>

              {Object.keys(devices).map((deviceId) => {
                const device = devices[deviceId]
                return (
                  <View key={deviceId} style={styles.deviceItem}>
                    <View style={styles.deviceInfo}>
                      <View style={styles.deviceIcon}>
                        <MaterialCommunityIcons 
                          name={getDeviceIcon(device.type || device.name)} 
                          size={28} 
                          color={device.status === 'on' ? "#4CAF50" : "#757575"} 
                        />
                      </View>
                      <View style={styles.deviceDetails}>
                        <Text style={styles.deviceName}>{device.name}</Text>
                        <Text style={styles.deviceType}>{device.type}</Text>
                        <Text style={[styles.deviceStatus, device.status === 'on' && styles.deviceStatusOn]}>
                          {device.status === 'on' ? '● Online' : '○ Offline'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.deviceControls}>
                      <Switch
                        value={device.status === 'on'}
                        onValueChange={() => toggleDevice(deviceId)}
                        color="#4361EE"
                      />
                      <IconButton
                        icon="delete-outline"
                        size={20}
                        iconColor="#F44336"
                        onPress={() => handleDeleteDevice(deviceId, device.name)}
                      />
                    </View>
                  </View>
                )
              })}
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <MaterialCommunityIcons name="devices" size={64} color="#CCCCCC" />
              <Text style={styles.emptyTitle}>No Devices Yet</Text>
              <Text style={styles.emptySubtext}>
                Add your first device to get started
              </Text>
            </Card.Content>
          </Card>
        )}

      </ScrollView>

      {/* Add Device FAB */}
      <FAB
        icon="plus"
        label="Add Device"
        style={styles.fab}
        onPress={() => setShowAddDeviceModal(true)}
        color="#FFFFFF"
      />

      {/* Add Device Modal */}
      <Modal
        visible={showAddDeviceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddDeviceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Device</Text>
              <TouchableOpacity onPress={() => setShowAddDeviceModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#212121" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TextInput
                label="Device Name"
                value={newDeviceName}
                onChangeText={setNewDeviceName}
                mode="outlined"
                placeholder="e.g., Living Room Bulb"
                style={styles.input}
                activeOutlineColor="#4361EE"
                left={<TextInput.Icon icon="label" />}
              />

              <Text style={styles.sectionLabel}>Device Type</Text>
              <RadioButton.Group onValueChange={setNewDeviceType} value={newDeviceType}>
                {deviceTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.deviceTypeOption,
                      newDeviceType === type.value && styles.deviceTypeOptionSelected
                    ]}
                    onPress={() => setNewDeviceType(type.value)}
                  >
                    <MaterialCommunityIcons 
                      name={type.icon} 
                      size={24} 
                      color={newDeviceType === type.value ? "#4361EE" : "#757575"} 
                    />
                    <Text style={[
                      styles.deviceTypeLabel,
                      newDeviceType === type.value && styles.deviceTypeLabelSelected
                    ]}>
                      {type.label}
                    </Text>
                    <RadioButton value={type.value} color="#4361EE" />
                  </TouchableOpacity>
                ))}
              </RadioButton.Group>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                mode="outlined"
                onPress={() => {
                  setNewDeviceName("")
                  setNewDeviceType("bulb")
                  setShowAddDeviceModal(false)
                }}
                style={styles.modalCancelButton}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleAddDevice}
                style={styles.modalSaveButton}
                buttonColor="#4361EE"
                loading={addingDevice}
                disabled={addingDevice}
              >
                Add Device
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

const getDeviceIcon = (typeOrName) => {
  const deviceIconMap = {
    'bulb': 'lightbulb',
    'fan': 'fan',
    'tv': 'television',
    'ac': 'air-conditioner',
    'heater': 'radiator',
    'charger': 'battery-charging',
    'other': 'power-plug',
  }
  
  return deviceIconMap[typeOrName] || 'power-plug'
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: "#F8F9FA",
  },
  loadingText: {
    fontSize: 16,
    color: "#666666",
    marginTop: 16,
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
    padding: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    elevation: 2,
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  summaryText: {
    marginLeft: 12,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: "#1A1A1A",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#666666",
  },
  bulkCard: {
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#1A1A1A",
    marginBottom: 16,
  },
  bulkButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkButton: {
    flex: 1,
  },
  roomCard: {
    marginBottom: 16,
    elevation: 2,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: "#1A1A1A",
  },
  roomChip: {
    backgroundColor: "#E3F2FD",
  },
  roomChipText: {
    color: "#4361EE",
    fontSize: 12,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceIcon: {
    marginRight: 12,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: "#1A1A1A",
  },
  deviceStatus: {
    fontSize: 12,
    color: "#666666",
    marginTop: 2,
  },
  addDeviceCard: {
    marginBottom: 16,
    elevation: 2,
  },
  addDeviceContent: {
    alignItems: 'center',
    padding: 24,
  },
  addDeviceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#1A1A1A",
    marginTop: 12,
  },
  addDeviceSubtext: {
    fontSize: 14,
    color: "#666666",
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  addDeviceButton: {
    borderColor: "#4361EE",
  },
  devicesListCard: {
    marginBottom: 16,
    elevation: 2,
  },
  deviceControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceType: {
    fontSize: 12,
    color: "#4361EE",
    textTransform: 'capitalize',
  },
  deviceStatusOn: {
    color: "#4CAF50",
  },
  emptyCard: {
    marginBottom: 16,
    elevation: 2,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: "#666666",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999999",
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#4361EE',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
  input: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  deviceTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 8,
  },
  deviceTypeOptionSelected: {
    borderColor: '#4361EE',
    backgroundColor: '#F0F4FF',
  },
  deviceTypeLabel: {
    flex: 1,
    fontSize: 16,
    color: '#666666',
    marginLeft: 12,
  },
  deviceTypeLabelSelected: {
    color: '#4361EE',
    fontWeight: '600',
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

export default DevicesScreen