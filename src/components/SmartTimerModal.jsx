import React, { useState, useEffect } from "react"
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
  Switch,
  Chip,
  Divider,
  SegmentedButtons,
  List,
  RadioButton,
} from "react-native-paper"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import CustomAlert from "./CustomAlert"
import { getSunriseTime, getSunsetTime, formatTime } from "../utils/sunriseSunset"
import { 
  isHoliday, 
  isWeekend, 
  getDayType, 
  SMART_SCENES,
  generateRandomSchedule 
} from "../utils/smartScheduling"

const SmartTimerModal = ({ visible, onClose, onSave, existingTimers = [] }) => {
  const [timerName, setTimerName] = useState("")
  const [startTime, setStartTime] = useState(() => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    return now
  })
  const [endTime, setEndTime] = useState(() => {
    const now = new Date()
    now.setHours(17, 0, 0, 0)
    return now
  })
  const [selectedDays, setSelectedDays] = useState([])
  const [isEnabled, setIsEnabled] = useState(false)
  const [startTimeText, setStartTimeText] = useState("8:00")
  const [endTimeText, setEndTimeText] = useState("5:00")
  const [startTimePeriod, setStartTimePeriod] = useState("AM")
  const [endTimePeriod, setEndTimePeriod] = useState("PM")
  const [alertVisible, setAlertVisible] = useState(false)
  const [alertConfig, setAlertConfig] = useState({})
  
 
  const [scheduleType, setScheduleType] = useState('custom') 
  const [selectedScene, setSelectedScene] = useState('work_mode')
  const [dayType, setDayType] = useState(null) 
  const [enableRandom, setEnableRandom] = useState(false)
  const [sunriseTime, setSunriseTime] = useState(null)
  const [sunsetTime, setSunsetTime] = useState(null)

  const days = [
    { id: 1, label: "Mon", fullName: "Monday" },
    { id: 2, label: "Tue", fullName: "Tuesday" },
    { id: 3, label: "Wed", fullName: "Wednesday" },
    { id: 4, label: "Thu", fullName: "Thursday" },
    { id: 5, label: "Fri", fullName: "Friday" },
    { id: 6, label: "Sat", fullName: "Saturday" },
    { id: 0, label: "Sun", fullName: "Sunday" },
  ]

  useEffect(() => {
    // Get sunrise/sunset times
    const sunrise = getSunriseTime()
    const sunset = getSunsetTime()
    setSunriseTime(sunrise)
    setSunsetTime(sunset)
  }, [])

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
    
      setTimerName("")
      setScheduleType('custom')
      setSelectedScene('work_mode')
      setDayType(null) 
      setEnableRandom(false)
      setSelectedDays([]) 
      setIsEnabled(false)
      setStartTimeText("8:00")
      setEndTimeText("5:00")
      setStartTimePeriod("AM")
      setEndTimePeriod("PM")
      const defaultStart = new Date()
      defaultStart.setHours(8, 0, 0, 0)
      const defaultEnd = new Date()
      defaultEnd.setHours(17, 0, 0, 0)
      setStartTime(defaultStart)
      setEndTime(defaultEnd)
    }
  }, [visible])

 
  useEffect(() => {
    if (scheduleType === 'custom' && dayType) {
      let daysToSelect = []
      
      switch (dayType) {
        case 'weekday':
          // Monday to Friday (1-5)
          daysToSelect = [1, 2, 3, 4, 5]
          break
        case 'weekend':
          // Saturday and Sunday (6, 0)
          daysToSelect = [6, 0]
          break
        case 'holiday':
          // Sunday only (0)
          daysToSelect = [0]
          break
        case 'all':
          // All days (0-6)
          daysToSelect = [0, 1, 2, 3, 4, 5, 6]
          break
        default:
          daysToSelect = []
      }
      
      setSelectedDays(daysToSelect)
    }
  }, [dayType, scheduleType])

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const toggleDay = (dayId) => {
    setSelectedDays((prev) =>
      prev.includes(dayId)
        ? prev.filter((id) => id !== dayId)
        : [...prev, dayId]
    )
  }

  // Parse time from text input (e.g., "8:30" -> {hours: 8, minutes: 30})
  const parseTimeText = (timeText) => {
    const [hours, minutes] = timeText.split(':').map(Number)
    return { hours: hours || 0, minutes: minutes || 0 }
  }

  // Convert text time to Date object
  const textToDate = (timeText, period) => {
    const { hours, minutes } = parseTimeText(timeText)
    let hour24 = hours
    
    if (period === 'PM' && hours !== 12) {
      hour24 = hours + 12
    } else if (period === 'AM' && hours === 12) {
      hour24 = 0
    }
    
    const date = new Date()
    date.setHours(hour24, minutes, 0, 0)
    return date
  }

  // Update time objects when text changes
  const updateStartTime = (text = startTimeText, period = startTimePeriod) => {
    if (validateTimeFormat(text)) {
      setStartTime(textToDate(text, period))
    }
  }

  const updateEndTime = (text = endTimeText, period = endTimePeriod) => {
    if (validateTimeFormat(text)) {
      setEndTime(textToDate(text, period))
    }
  }

  // Validate time format
  const validateTimeFormat = (timeText) => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/
    return timeRegex.test(timeText)
  }

  const showAlert = (message, type = 'error', onConfirm) => {
    setAlertConfig({
      message,
      type,
      onConfirm: onConfirm || (() => setAlertVisible(false))
    })
    setAlertVisible(true)
  }

  const handleSunriseSunsetSelection = (type) => {
    if (type === 'sunrise' && sunriseTime) {
      setStartTime(sunriseTime)
      setEndTime(new Date(sunriseTime.getTime() + 2 * 60 * 60 * 1000)) 
    } else if (type === 'sunset' && sunsetTime) {
      setStartTime(new Date(sunsetTime.getTime() - 2 * 60 * 60 * 1000)) 
      setEndTime(sunsetTime)
    }
  }

  const handleSmartSceneSelection = (sceneKey) => {
    const scene = SMART_SCENES[sceneKey]
    if (scene) {
      setSelectedScene(sceneKey)
      setTimerName(scene.name)
     
      const duration = scene.duration || 480 
      const start = new Date()
      const end = new Date(start.getTime() + duration * 60 * 1000)
      setStartTime(start)
      setEndTime(end)
    }
  }

  const handleSave = () => {
    if (!timerName.trim()) {
      showAlert("Please enter a timer name", 'info')
      return
    }

    if (scheduleType === 'custom' && selectedDays.length === 0) {
      showAlert("Please select at least one day", 'info')
      return
    }

    if (startTime >= endTime) {
      showAlert("End time must be after start time", 'info')
      return
    }

    const newTimer = {
      id: Date.now().toString(),
      name: timerName.trim(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      days: selectedDays.sort(),
      enabled: isEnabled,
      createdAt: new Date().toISOString(),
      
      scheduleType,
      dayType: scheduleType === 'custom' ? dayType : 'all',
      scene: scheduleType === 'smart_scene' ? selectedScene : null,
      randomMode: enableRandom,
      sunriseTime: sunriseTime?.toISOString(),
      sunsetTime: sunsetTime?.toISOString(),
    }

    onSave(newTimer)
    showAlert("Smart timer created successfully!", 'success', () => {
      setAlertVisible(false)
      handleClose()
    })
  }

  const handleClose = () => {
    setTimerName("")
    setScheduleType('custom')
    setSelectedScene('work_mode')
    setDayType(null) 
    setEnableRandom(false)
    setSelectedDays([])
    setIsEnabled(false)
    setStartTimeText("8:00")
    setEndTimeText("5:00")
    setStartTimePeriod("AM")
    setEndTimePeriod("PM")
    onClose()
  }

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <IconButton icon="close" onPress={handleClose} />
            <Text style={styles.headerTitle}>Smart Timer</Text>
            <View style={{ width: 48 }} />
          </View>

          <ScrollView style={styles.content}>
            {/* Timer Name */}
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Timer Name</Text>
                <TextInput
                  label="Enter timer name"
                  value={timerName}
                  onChangeText={setTimerName}
                  style={styles.input}
                  mode="outlined"
                />
              </Card.Content>
            </Card>

            {/* Schedule Type Selection */}
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Schedule Type</Text>
                <SegmentedButtons
                  value={scheduleType}
                  onValueChange={setScheduleType}
                  buttons={[
                    { value: 'custom', label: 'Custom' },
                    { value: 'sunrise', label: 'Sunrise' },
                    { value: 'sunset', label: 'Sunset' },
                    { value: 'smart_scene', label: 'Scene' },
                  ]}
                  style={styles.segmentedButtons}
                />
              </Card.Content>
            </Card>

            {/* Smart Scene Selection */}
            {scheduleType === 'smart_scene' && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.sectionTitle}>Smart Scenes</Text>
                  {Object.entries(SMART_SCENES).map(([key, scene]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.sceneItem,
                        selectedScene === key && styles.selectedScene
                      ]}
                      onPress={() => handleSmartSceneSelection(key)}
                    >
                      <MaterialCommunityIcons 
                        name={scene.icon} 
                        size={24} 
                        color={selectedScene === key ? "#4361EE" : "#666666"} 
                      />
                      <View style={styles.sceneInfo}>
                        <Text style={[
                          styles.sceneName,
                          selectedScene === key && styles.selectedSceneText
                        ]}>
                          {scene.name}
                        </Text>
                        <Text style={styles.sceneDescription}>
                          {scene.description}
                        </Text>
                      </View>
                      <RadioButton
                        value={key}
                        status={selectedScene === key ? 'checked' : 'unchecked'}
                        onPress={() => handleSmartSceneSelection(key)}
                      />
                    </TouchableOpacity>
                  ))}
                </Card.Content>
              </Card>
            )}

    
            {scheduleType === 'custom' && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.sectionTitle}>Day Type</Text>
                  <View style={styles.dayTypeContainer}>
                    {/* First Row */}
                    <View style={styles.dayTypeRow}>
                      <TouchableOpacity
                        style={[styles.dayTypeButton, dayType === 'weekday' && styles.dayTypeButtonActive]}
                        onPress={() => setDayType('weekday')}
                      >
                        <Text style={[styles.dayTypeButtonText, dayType === 'weekday' && styles.dayTypeButtonTextActive]}>
                          Weekdays
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dayTypeButton, dayType === 'weekend' && styles.dayTypeButtonActive]}
                        onPress={() => setDayType('weekend')}
                      >
                        <Text style={[styles.dayTypeButtonText, dayType === 'weekend' && styles.dayTypeButtonTextActive]}>
                          Weekends
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {/* Second Row */}
                    <View style={styles.dayTypeRow}>
                      <TouchableOpacity
                        style={[styles.dayTypeButton, dayType === 'holiday' && styles.dayTypeButtonActive]}
                        onPress={() => setDayType('holiday')}
                      >
                        <Text style={[styles.dayTypeButtonText, dayType === 'holiday' && styles.dayTypeButtonTextActive]}>
                          Holiday
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dayTypeButton, dayType === 'all' && styles.dayTypeButtonActive]}
                        onPress={() => setDayType('all')}
                      >
                        <Text style={[styles.dayTypeButtonText, dayType === 'all' && styles.dayTypeButtonTextActive]}>
                          All Days
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            )}

            {/* Day Selection */}
            {scheduleType === 'custom' && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.sectionTitle}>Days of Week</Text>
                  <View style={styles.daysContainer}>
                    {days.map((day) => (
                      <Chip
                        key={day.id}
                        selected={selectedDays.includes(day.id)}
                        onPress={() => toggleDay(day.id)}
                        style={[
                          styles.dayChip,
                          selectedDays.includes(day.id) && styles.selectedDayChip
                        ]}
                        textStyle={[
                          styles.dayChipText,
                          selectedDays.includes(day.id) && styles.selectedDayChipText
                        ]}
                      >
                        {day.label}
                      </Chip>
                    ))}
                  </View>
                </Card.Content>
              </Card>
            )}

            {/* Time Selection */}
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Time Schedule</Text>
                
                {/* Sunrise/Sunset Quick Selection */}
                {(scheduleType === 'sunrise' || scheduleType === 'sunset') && (
                  <View style={styles.quickTimeContainer}>
                    <Button
                      mode="outlined"
                      icon="weather-sunny"
                      onPress={() => handleSunriseSunsetSelection('sunrise')}
                      style={styles.quickTimeButton}
                    >
                      Sunrise ({sunriseTime ? formatTime(sunriseTime) : '--'})
                    </Button>
                    <Button
                      mode="outlined"
                      icon="weather-night"
                      onPress={() => handleSunriseSunsetSelection('sunset')}
                      style={styles.quickTimeButton}
                    >
                      Sunset ({sunsetTime ? formatTime(sunsetTime) : '--'})
                    </Button>
                  </View>
                )}
                
                {/* Start Time - Full Row */}
                <View style={styles.timeInputFullRow}>
                  <Text style={styles.timeLabel}>Start Time</Text>
                  <View style={styles.timeInputContainer}>
                    <TextInput
                      style={styles.timeTextInput}
                      value={startTimeText}
                      onChangeText={(text) => {
                        setStartTimeText(text)
                        updateStartTime(text, startTimePeriod)
                      }}
                      placeholder="8:00"
                      keyboardType="default"
                      maxLength={5}
                    />
                    <View style={styles.periodContainer}>
                      <TouchableOpacity
                        style={[
                          styles.periodButton,
                          startTimePeriod === 'AM' && styles.periodButtonActive
                        ]}
                        onPress={() => {
                          setStartTimePeriod('AM')
                          updateStartTime(startTimeText, 'AM')
                        }}
                      >
                        <Text style={[
                          styles.periodText,
                          startTimePeriod === 'AM' && styles.periodTextActive
                        ]}>AM</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.periodButton,
                          startTimePeriod === 'PM' && styles.periodButtonActive
                        ]}
                        onPress={() => {
                          setStartTimePeriod('PM')
                          updateStartTime(startTimeText, 'PM')
                        }}
                      >
                        <Text style={[
                          styles.periodText,
                          startTimePeriod === 'PM' && styles.periodTextActive
                        ]}>PM</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* End Time - Full Row */}
                <View style={styles.timeInputFullRow}>
                  <Text style={styles.timeLabel}>End Time</Text>
                  <View style={styles.timeInputContainer}>
                    <TextInput
                      style={styles.timeTextInput}
                      value={endTimeText}
                      onChangeText={(text) => {
                        setEndTimeText(text)
                        updateEndTime(text, endTimePeriod)
                      }}
                      placeholder="5:00"
                      keyboardType="default"
                      maxLength={5}
                    />
                    <View style={styles.periodContainer}>
                      <TouchableOpacity
                        style={[
                          styles.periodButton,
                          endTimePeriod === 'AM' && styles.periodButtonActive
                        ]}
                        onPress={() => {
                          setEndTimePeriod('AM')
                          updateEndTime(endTimeText, 'AM')
                        }}
                      >
                        <Text style={[
                          styles.periodText,
                          endTimePeriod === 'AM' && styles.periodTextActive
                        ]}>AM</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.periodButton,
                          endTimePeriod === 'PM' && styles.periodButtonActive
                        ]}
                        onPress={() => {
                          setEndTimePeriod('PM')
                          updateEndTime(endTimeText, 'PM')
                        }}
                      >
                        <Text style={[
                          styles.periodText,
                          endTimePeriod === 'PM' && styles.periodTextActive
                        ]}>PM</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Advanced Options */}
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Advanced Options</Text>
                
                <View style={styles.optionRow}>
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionLabel}>Random Mode</Text>
                    <Text style={styles.optionDescription}>
                      Add random variations for security
                    </Text>
                  </View>
                  <Switch
                    value={enableRandom}
                    onValueChange={setEnableRandom}
                    color="#4361EE"
                  />
                </View>

                <View style={styles.optionRow}>
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionLabel}>Enable Timer</Text>
                    <Text style={styles.optionDescription}>
                      Turn this timer on/off
                    </Text>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={setIsEnabled}
                    color="#4361EE"
                  />
                </View>
              </Card.Content>
            </Card>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              mode="outlined"
              onPress={handleClose}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.saveButton}
              buttonColor="#4361EE"
            >
              Save Smart Timer
            </Button>
          </View>
        </View>
      </Modal>

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        onDismiss={() => setAlertVisible(false)}
        {...alertConfig}
      />
    </>
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
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  input: {
    marginBottom: 8,
  },
  segmentedButtons: {
    marginBottom: 8,
  },
  dayTypeContainer: {
    marginTop: 8,
    gap: 8,
  },
  dayTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayTypeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTypeButtonActive: {
    backgroundColor: '#4361EE',
    borderColor: '#4361EE',
  },
  dayTypeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  dayTypeButtonTextActive: {
    color: '#FFFFFF',
  },
  sceneItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#F8F9FA",
  },
  selectedScene: {
    backgroundColor: "#E3F2FD",
    borderWidth: 1,
    borderColor: "#4361EE",
  },
  sceneInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sceneName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1A1A1A",
  },
  selectedSceneText: {
    color: "#4361EE",
  },
  sceneDescription: {
    fontSize: 12,
    color: "#666666",
    marginTop: 2,
  },
  quickTimeContainer: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  quickTimeButton: {
    flex: 1,
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  timeInputFullRow: {
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    height: 48,
  },
  timeTextInput: {
    flex: 1,
    fontSize: 18,
    color: '#212121',
    paddingHorizontal: 8,
    paddingVertical: 0,
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: 'transparent',
  },
  periodContainer: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  periodButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 2,
    backgroundColor: '#E0E0E0',
  },
  periodButtonActive: {
    backgroundColor: '#4361EE',
  },
  periodText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  periodTextActive: {
    color: '#FFFFFF',
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayChip: {
    backgroundColor: "#F0F0F0",
  },
  selectedDayChip: {
    backgroundColor: "#4361EE",
  },
  dayChipText: {
    color: "#666666",
  },
  selectedDayChipText: {
    color: "#FFFFFF",
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1A1A1A",
  },
  optionDescription: {
    fontSize: 12,
    color: "#666666",
    marginTop: 2,
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

export default SmartTimerModal
