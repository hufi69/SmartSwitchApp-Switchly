import React, { useState } from "react"
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from "react-native"
import {
  Text,
  Card,
  Button,
  TextInput,
  IconButton,
} from "react-native-paper"
import { MaterialCommunityIcons } from "@expo/vector-icons"

const AddDeviceModal = ({ visible, onClose, onAddDevice }) => {
  const [deviceName, setDeviceName] = useState("")
  const [deviceLocation, setDeviceLocation] = useState("")
  const [deviceType, setDeviceType] = useState("Switch")
  const [deviceIcon, setDeviceIcon] = useState("power-socket")

  const deviceTypes = [
    { id: "Switch", label: "Switch", icon: "power-socket" },
    { id: "Smart Light", label: "Smart Light", icon: "lightbulb" },
    { id: "Smart Fan", label: "Smart Fan", icon: "fan" },
    { id: "Smart Outlet", label: "Smart Outlet", icon: "power-plug" },
    { id: "Smart Thermostat", label: "Smart Thermostat", icon: "thermometer" },
  ]

  const locations = [
    "Living Room",
    "Kitchen",
    "Bedroom",
    "Bathroom",
    "Office",
    "Garage",
    "Garden",
    "Hallway",
  ]

  const handleSave = () => {
    if (!deviceName.trim()) {
      alert("Please enter a device name")
      return
    }

    if (!deviceLocation.trim()) {
      alert("Please select a location")
      return
    }

    const newDevice = {
      id: Date.now().toString(),
      name: deviceName.trim(),
      location: deviceLocation.trim(),
      type: deviceType,
      status: "Connected",
      isOn: false,
      lastActive: "Just now",
      icon: deviceIcon,
    }

    onAddDevice(newDevice)
    handleClose()
  }

  const handleClose = () => {
    setDeviceName("")
    setDeviceLocation("")
    setDeviceType("Switch")
    setDeviceIcon("power-socket")
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="close" onPress={handleClose} />
          <Text style={styles.headerTitle}>Add New Device</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Device Information</Text>
              
              <TextInput
                label="Device Name"
                value={deviceName}
                onChangeText={setDeviceName}
                style={styles.input}
                mode="outlined"
                placeholder="e.g., Living Room Light, Kitchen Fan"
                left={<TextInput.Icon icon="devices" />}
              />

              <TextInput
                label="Location"
                value={deviceLocation}
                onChangeText={setDeviceLocation}
                style={styles.input}
                mode="outlined"
                placeholder="e.g., Living Room, Kitchen"
                left={<TextInput.Icon icon="map-marker" />}
              />
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Device Type</Text>
              <Text style={styles.sectionSubtitle}>Select the type of device you're adding</Text>
              
              <View style={styles.deviceTypesContainer}>
                {deviceTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.deviceTypeItem,
                      deviceType === type.id && styles.selectedDeviceType,
                    ]}
                    onPress={() => {
                      setDeviceType(type.id)
                      setDeviceIcon(type.icon)
                    }}
                  >
                    <View style={[
                      styles.deviceTypeIcon,
                      deviceType === type.id && styles.selectedDeviceTypeIcon,
                    ]}>
                      <MaterialCommunityIcons 
                        name={type.icon} 
                        size={24} 
                        color={deviceType === type.id ? "#FFFFFF" : "#4361EE"} 
                      />
                    </View>
                    <Text style={[
                      styles.deviceTypeText,
                      deviceType === type.id && styles.selectedDeviceTypeText,
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Quick Location Selection</Text>
              <Text style={styles.sectionSubtitle}>Tap to quickly select a common location</Text>
              
              <View style={styles.locationsContainer}>
                {locations.map((location) => (
                  <TouchableOpacity
                    key={location}
                    style={[
                      styles.locationChip,
                      deviceLocation === location && styles.selectedLocationChip,
                    ]}
                    onPress={() => setDeviceLocation(location)}
                  >
                    <Text style={[
                      styles.locationChipText,
                      deviceLocation === location && styles.selectedLocationChipText,
                    ]}>
                      {location}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Device Preview</Text>
              <View style={styles.previewContainer}>
                <View style={styles.previewDevice}>
                  <View style={[styles.previewIcon, { backgroundColor: "#4361EE" }]}>
                    <MaterialCommunityIcons name={deviceIcon} size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewName}>
                      {deviceName || "Device Name"}
                    </Text>
                    <Text style={styles.previewLocation}>
                      {deviceLocation || "Location"}
                    </Text>
                    <Text style={styles.previewType}>{deviceType}</Text>
                  </View>
                  <View style={styles.previewSwitch}>
                    <MaterialCommunityIcons name="toggle-switch-off" size={24} color="#757575" />
                  </View>
                </View>
              </View>
            </Card.Content>
          </Card>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            mode="outlined"
            onPress={handleClose}
            style={styles.cancelButton}
            textColor="#757575"
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.saveButton}
            buttonColor="#4361EE"
          >
            Add Device
          </Button>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#212121",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212121",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#757575",
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  deviceTypesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  deviceTypeItem: {
    width: "30%",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
  },
  selectedDeviceType: {
    borderColor: "#4361EE",
    backgroundColor: "rgba(67, 97, 238, 0.1)",
  },
  deviceTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(67, 97, 238, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  selectedDeviceTypeIcon: {
    backgroundColor: "#4361EE",
  },
  deviceTypeText: {
    fontSize: 12,
    color: "#757575",
    textAlign: "center",
  },
  selectedDeviceTypeText: {
    color: "#4361EE",
    fontWeight: "600",
  },
  locationsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  locationChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
  },
  selectedLocationChip: {
    borderColor: "#4361EE",
    backgroundColor: "#4361EE",
  },
  locationChipText: {
    fontSize: 14,
    color: "#757575",
  },
  selectedLocationChipText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  previewContainer: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: 12,
  },
  previewDevice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212121",
  },
  previewLocation: {
    fontSize: 14,
    color: "#757575",
  },
  previewType: {
    fontSize: 12,
    color: "#9E9E9E",
  },
  previewSwitch: {
    marginLeft: 12,
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
    borderColor: "#E0E0E0",
  },
  saveButton: {
    flex: 1,
    marginLeft: 8,
  },
})

export default AddDeviceModal
