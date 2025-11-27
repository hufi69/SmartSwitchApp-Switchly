import React, { useState, useEffect, useCallback } from "react"
import { View, StyleSheet, ScrollView, Dimensions, StatusBar, TouchableOpacity, Alert } from "react-native"
import { Text, Card, Button, Appbar, SegmentedButtons, IconButton } from "react-native-paper"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { LineChart, BarChart } from "react-native-chart-kit"
import { realtimeDb, auth } from "../config/firebase"
import { ref, onValue, set } from "firebase/database"
import { calculateLESCOCost, getTierInfo, formatCurrency } from "../utils/lescoRates"
import CustomAlert from "../components/CustomAlert"
import * as Clipboard from 'expo-clipboard'

const { width } = Dimensions.get("window")

const AnalyticsScreen = ({ navigation }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('daily')
  const [analyticsData, setAnalyticsData] = useState({
    daily: { usage: 0, cost: 0, peak: { time: '--', value: 0 } },
    weekly: { usage: 0, cost: 0, peak: { time: '--', value: 0 } },
    monthly: { usage: 0, cost: 0, peak: { time: '--', value: 0 } },
  })
  const [usageHistory, setUsageHistory] = useState([])
  const [alertVisible, setAlertVisible] = useState(false)
  const [alertConfig, setAlertConfig] = useState({})

  // Load user's analytics data from Firebase
  useEffect(() => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    console.log('📊 Loading analytics for user:', userId)

    const analyticsRef = ref(realtimeDb, `users/${userId}/analytics`)
    const listener = onValue(analyticsRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setAnalyticsData(data)
        console.log('✅ Analytics data loaded')
      }
    })

    return () => listener()
  }, [])

  // Load usage history from Firebase - Real-time updates
  useEffect(() => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    console.log('📊 Loading usage history for analytics:', userId)

    const historyRef = ref(realtimeDb, `users/${userId}/usageHistory`)
    const listener = onValue(historyRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        // Convert Firebase data to array and sort by time
        const historyArray = Object.keys(data)
          .map(key => {
            const item = data[key]
            // Parse timestamp - item.timestamp is always stored as ISO string
            let time
            if (item.timestamp) {
              time = new Date(item.timestamp)
            } else {
              // Fallback: use current time
              time = new Date()
            }
            
            return {
              time,
              power: item.power || 0,
              energy: item.energy || 0,
              voltage: item.voltage || 0,
              current: item.current || 0
            }
          })
          .sort((a, b) => a.time - b.time) // Sort oldest first for calculations
        
        setUsageHistory(historyArray)
        console.log(`✅ Analytics: Loaded ${historyArray.length} usage records`)
      } else {
        setUsageHistory([])
        console.log('📭 Analytics: No usage history found')
      }
    })

    return () => listener()
  }, [])

  // Calculate analytics when usage history changes
  useEffect(() => {
    if (usageHistory.length > 0) {
      calculateAnalytics()
    }
  }, [usageHistory, calculateAnalytics])

  const calculateAnalytics = useCallback(() => {
    const now = new Date()

    // Daily (last 24 hours)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const dailyData = usageHistory.filter(item => item.time > oneDayAgo)
    const dailyUsage = dailyData.reduce((sum, item) => sum + item.energy, 0)
    const dailyCostData = calculateLESCOCost(dailyUsage)
    const dailyCost = dailyCostData.totalCost
    const dailyPeak = findPeakUsage(dailyData)

    // Weekly (last 7 days)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weeklyData = usageHistory.filter(item => item.time > oneWeekAgo)
    const weeklyUsage = weeklyData.reduce((sum, item) => sum + item.energy, 0)
    const weeklyCostData = calculateLESCOCost(weeklyUsage)
    const weeklyCost = weeklyCostData.totalCost
    const weeklyPeak = findPeakUsage(weeklyData)

    // Monthly (last 30 days estimate)
    const monthlyUsage = dailyUsage * 30
    const monthlyCostData = calculateLESCOCost(monthlyUsage)
    const monthlyCost = monthlyCostData.totalCost
    const monthlyPeak = dailyPeak

    const newAnalyticsData = {
      daily: { usage: dailyUsage, cost: dailyCost, peak: dailyPeak },
      weekly: { usage: weeklyUsage, cost: weeklyCost, peak: weeklyPeak },
      monthly: { usage: monthlyUsage, cost: monthlyCost, peak: monthlyPeak },
    }
    
    setAnalyticsData(newAnalyticsData)
    
    // Save analytics to Firebase - USER-SPECIFIC
    const userId = auth.currentUser?.uid
    if (userId) {
      const analyticsRef = ref(realtimeDb, `users/${userId}/analytics`)
      set(analyticsRef, newAnalyticsData).catch(err => 
        console.error('Error saving analytics:', err)
      )
    }
  }, [usageHistory])

  const findPeakUsage = (data) => {
    if (data.length === 0) return { time: '--', value: 0 }

    const peak = data.reduce((max, item) => {
      const itemPower = item.power || 0
      const maxPower = max.power || 0
      return itemPower > maxPower ? item : max
    }, data[0])
    
    return {
      time: peak.time && peak.time instanceof Date 
        ? peak.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '--',
      value: peak.power || 0
    }
  }

  const getChartData = () => {
    const now = new Date()
    let filteredData = []
    let labels = []

    if (selectedPeriod === 'daily') {
      // Last 24 hours, grouped by hour
      for (let i = 23; i >= 0; i--) {
        const hourAgo = new Date(now.getTime() - i * 60 * 60 * 1000)
        const hourData = usageHistory.filter(item => {
          if (!item.time || !(item.time instanceof Date)) return false
          const itemHour = item.time.getHours()
          const itemDate = item.time.getDate()
          return itemHour === hourAgo.getHours() && itemDate === hourAgo.getDate()
        })
        const avgPower = hourData.length > 0
          ? hourData.reduce((sum, item) => sum + (item.power || 0), 0) / hourData.length
          : 0
        filteredData.push(avgPower)
        labels.push(hourAgo.getHours() + 'h')
      }
    } else if (selectedPeriod === 'weekly') {
      // Last 7 days
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      for (let i = 6; i >= 0; i--) {
        const dayAgo = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dayData = usageHistory.filter(item => {
          if (!item.time || !(item.time instanceof Date)) return false
          return item.time.toDateString() === dayAgo.toDateString()
        })
        const totalEnergy = dayData.reduce((sum, item) => sum + (item.energy || 0), 0)
        const costData = calculateLESCOCost(totalEnergy)
        filteredData.push(costData.totalCost)
        labels.push(days[dayAgo.getDay()])
      }
    } else {
      // Monthly - Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
        const weekData = usageHistory.filter(item => {
          if (!item.time || !(item.time instanceof Date)) return false
          return item.time >= weekStart && item.time < weekEnd
        })
        const totalEnergy = weekData.reduce((sum, item) => sum + (item.energy || 0), 0)
        const costData = calculateLESCOCost(totalEnergy)
        filteredData.push(costData.totalCost)
        labels.push(`W${4-i}`)
      }
    }

    return {
      labels: selectedPeriod === 'daily' ? labels.filter((_, i) => i % 4 === 0) : labels,
      datasets: [{
        data: selectedPeriod === 'daily'
          ? filteredData.filter((_, i) => i % 4 === 0).map(v => Math.max(v || 0, 0.1))
          : filteredData.map(v => Math.max(v || 0, 0.1)),
        color: () => "#4361EE",
        strokeWidth: 2,
      }]
    }
  }

  const getCostPrediction = () => {
    const current = analyticsData[selectedPeriod]
    let nextPeriodCost = 0

    if (selectedPeriod === 'daily') {
      nextPeriodCost = current.cost * 7 // Weekly prediction
    } else if (selectedPeriod === 'weekly') {
      nextPeriodCost = current.cost * 4 // Monthly prediction
    } else {
      nextPeriodCost = current.cost * 12 // Yearly prediction
    }

    return nextPeriodCost
  }

  const showAlert = (message, type = 'info', onConfirm) => {
    setAlertConfig({
      message,
      type,
      onConfirm: onConfirm || (() => setAlertVisible(false))
    })
    setAlertVisible(true)
  }

  const exportAsCSV = async () => {
    const current = analyticsData[selectedPeriod]
    const csv = `Switchly Analytics Report
Period: ${selectedPeriod.toUpperCase()}
Generated: ${new Date().toLocaleString()}

Metric,Value
Total Usage,${current.usage.toFixed(3)} kWh
Total Cost,${formatCurrency(current.cost)}
Peak Usage Time,${current.peak.time}
Peak Power,${current.peak.value.toFixed(2)} W
Current Tier,${getTierInfo(current.usage).tier}
Current Rate,PKR ${getTierInfo(current.usage).rate}/kWh
Cost Prediction (Next Period),${formatCurrency(getCostPrediction())}
`

    try {
      await Clipboard.setStringAsync(csv)
      showAlert('Report copied to clipboard! You can paste it in any app.', 'success')
    } catch (error) {
      showAlert('Failed to copy report', 'error')
      console.error(error)
    }
  }

  const exportAsPDF = async () => {
    Alert.alert(
      'Export Report',
      'Report data has been copied to clipboard. You can paste it in Notes, Email, or any text app.',
      [
        { text: 'OK', onPress: exportAsCSV }
      ]
    )
  }

  const currentData = analyticsData[selectedPeriod]

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4361EE" />

      <Appbar.Header style={styles.header}>
        <Appbar.Content title="Analytics" titleStyle={styles.headerTitle} />
        <IconButton icon="content-copy" iconColor="#FFFFFF" onPress={exportAsCSV} />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
          <View style={styles.periodSelector}>
            <SegmentedButtons
              value={selectedPeriod}
              onValueChange={setSelectedPeriod}
              buttons={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
              style={styles.segmentedButtons}
            />
          </View>

          <View style={styles.summarySection}>
            <Card style={styles.summaryCard}>
              <Card.Content>
                <View style={styles.summaryHeader}>
                  <MaterialCommunityIcons name="chart-line" size={32} color="#4361EE" />
                  <Text style={styles.summaryTitle}>{selectedPeriod.toUpperCase()} SUMMARY</Text>
                </View>

                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Usage</Text>
                    <Text style={styles.summaryValue}>{currentData.usage.toFixed(3)} kWh</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Cost</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(currentData.cost)}</Text>
                  </View>
                </View>

                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Peak Time</Text>
                    <Text style={styles.summaryValue}>{currentData.peak.time}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Peak Power</Text>
                    <Text style={styles.summaryValue}>{currentData.peak.value.toFixed(0)} W</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </View>

          <Card style={styles.chartCard}>
            <Card.Content>
              <Text style={styles.cardTitle}>
                {selectedPeriod === 'daily' ? 'Hourly' : selectedPeriod === 'weekly' ? 'Daily' : 'Weekly'} Usage
              </Text>
              <View style={styles.chartContainer}>
                <BarChart
                  data={getChartData()}
                  width={width - 60}
                  height={220}
                  chartConfig={{
                    backgroundColor: "#FFFFFF",
                    backgroundGradientFrom: "#FFFFFF",
                    backgroundGradientTo: "#F8F9FA",
                    decimalPlaces: 2,
                    color: (opacity = 1) => "#4361EE",
                    labelColor: (opacity = 1) => "#757575",
                    style: { borderRadius: 16 },
                    barPercentage: 0.7,
                    fillShadowGradient: "#4361EE",
                    fillShadowGradientOpacity: 0.9,
                    propsForBackgroundLines: {
                      strokeDasharray: "2,2",
                      stroke: "#E0E0E0",
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

          <Card style={styles.predictionCard}>
            <Card.Content>
              <View style={styles.predictionHeader}>
                <MaterialCommunityIcons name="crystal-ball" size={28} color="#FB8C00" />
                <Text style={styles.cardTitle}>Cost Prediction</Text>
              </View>
              <Text style={styles.predictionText}>
                Based on current usage, your estimated cost for the next period will be:
              </Text>
              <Text style={styles.predictionValue}>{formatCurrency(getCostPrediction())}</Text>
              <Text style={styles.predictionNote}>
                {selectedPeriod === 'daily' && 'This week'}
                {selectedPeriod === 'weekly' && 'This month'}
                {selectedPeriod === 'monthly' && 'This year'}
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.insightsCard}>
            <Card.Content>
              <Text style={styles.cardTitle}>💡 Insights & Recommendations</Text>

              <View style={styles.insightItem}>
                <MaterialCommunityIcons name="lightbulb-on" size={20} color="#4CAF50" />
                <Text style={styles.insightText}>
                  Peak usage occurs at {currentData.peak.time}. Consider shifting heavy loads to off-peak hours.
                </Text>
              </View>

              <View style={styles.insightItem}>
                <MaterialCommunityIcons name="cash-multiple" size={20} color="#4361EE" />
                <Text style={styles.insightText}>
                  Current rate: PKR {getTierInfo(currentData.usage).rate}/kWh (Tier {getTierInfo(currentData.usage).tier}). You can save more by reducing usage during peak times.
                </Text>
              </View>

              <View style={styles.insightItem}>
                <MaterialCommunityIcons name="timer-outline" size={20} color="#FB8C00" />
                <Text style={styles.insightText}>
                  Use timers to automate your switch and optimize energy consumption.
                </Text>
              </View>
            </Card.Content>
          </Card>

          <View style={styles.exportSection}>
            <Text style={styles.exportTitle}>Export Options</Text>
            <Button
              mode="contained"
              icon="content-copy"
              onPress={exportAsCSV}
              style={styles.exportButtonFull}
              buttonColor="#4361EE"
            >
              Copy Report to Clipboard
            </Button>
        </View>
      </ScrollView>

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
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  periodSelector: {
    padding: 16,
  },
  segmentedButtons: {
    backgroundColor: "#FFFFFF",
  },
  summarySection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    borderRadius: 12,
    elevation: 2,
    backgroundColor: "#FFFFFF",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4361EE",
    marginLeft: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#757575",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#212121",
  },
  chartCard: {
    margin: 16,
    borderRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#212121",
  },
  chartContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  chart: {
    borderRadius: 16,
  },
  predictionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    backgroundColor: "#FFF8E1",
  },
  predictionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  predictionText: {
    fontSize: 14,
    color: "#757575",
    marginBottom: 12,
  },
  predictionValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FB8C00",
    marginBottom: 4,
  },
  predictionNote: {
    fontSize: 12,
    color: "#9E9E9E",
    fontStyle: "italic",
  },
  insightsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    padding: 8,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: "#424242",
    marginLeft: 12,
  },
  exportSection: {
    padding: 16,
    marginBottom: 24,
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212121",
    marginBottom: 12,
  },
  exportButtonFull: {
    width: '100%',
  },
})

export default AnalyticsScreen
