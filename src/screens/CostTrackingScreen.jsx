import React, { useState, useEffect, useCallback } from "react"
import { View, StyleSheet, ScrollView, Dimensions, StatusBar, TouchableOpacity, Alert } from "react-native"
import { Text, Card, Button, Appbar, SegmentedButtons, IconButton, Chip, Divider } from "react-native-paper"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { LineChart, BarChart } from "react-native-chart-kit"
import { realtimeDb, auth } from "../config/firebase"
import { ref, onValue, set } from "firebase/database"
import { calculateLESCOCost, getTierInfo, formatCurrency, getCostSavingsTips } from "../utils/lescoRates"
import CustomAlert from "../components/CustomAlert"
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system'
import * as Clipboard from 'expo-clipboard'

const { width } = Dimensions.get("window")

const CostTrackingScreen = ({ navigation }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('daily')
  const [usageData, setUsageData] = useState([])
  const [currentUsage, setCurrentUsage] = useState(0)
  const [currentCost, setCurrentCost] = useState(0)
  const [tierInfo, setTierInfo] = useState(null)
  const [savingsTips, setSavingsTips] = useState([])
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isGeneratingCSV, setIsGeneratingCSV] = useState(false)
  const [alertVisible, setAlertVisible] = useState(false)
  const [alertConfig, setAlertConfig] = useState({})

  // Load user's cost tracking data from Firebase
  useEffect(() => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    console.log('💰 Loading cost tracking for user:', userId)

    const costRef = ref(realtimeDb, `users/${userId}/costTracking`)
    const listener = onValue(costRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        setCurrentUsage(data.currentUsage || 0)
        setCurrentCost(data.currentCost || 0)
        setTierInfo(data.tierInfo || null)
        console.log('✅ Cost tracking data loaded')
      }
    })

    return () => listener()
  }, [])

  // Load usage history from Firebase
  useEffect(() => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    const historyRef = ref(realtimeDb, `users/${userId}/usageHistory`)
    const listener = onValue(historyRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const historyArray = Object.keys(data).map(key => ({
          time: new Date(key),
          ...data[key]
        }))
        setUsageData(historyArray)
      }
    })

    return () => listener()
  }, [])

  // Calculate and save current usage and cost to Firebase
  useEffect(() => {
    if (usageData.length > 0) {
      const now = new Date()
      let filteredData = []

      if (selectedPeriod === 'daily') {
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        filteredData = usageData.filter(item => item.time > oneDayAgo)
      } else if (selectedPeriod === 'weekly') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        filteredData = usageData.filter(item => item.time > oneWeekAgo)
      } else if (selectedPeriod === 'monthly') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        filteredData = usageData.filter(item => item.time > oneMonthAgo)
      }

      const totalUsage = filteredData.reduce((sum, item) => sum + item.energy, 0)
      const costData = calculateLESCOCost(totalUsage)
      const tier = getTierInfo(totalUsage)
      const tips = getCostSavingsTips(totalUsage, costData.totalCost)
      
      setCurrentUsage(totalUsage)
      setCurrentCost(costData.totalCost)
      setTierInfo(tier)
      setSavingsTips(tips)
      
      // Save to Firebase - USER-SPECIFIC
      const userId = auth.currentUser?.uid
      if (userId && totalUsage > 0) {
        const costRef = ref(realtimeDb, `users/${userId}/costTracking`)
        
        // Sanitize tier object - Firebase doesn't allow Infinity values
        const sanitizedTier = {
          ...tier,
          maxUnits: tier.maxUnits === Infinity ? null : tier.maxUnits
        }
        
        set(costRef, {
          currentUsage: totalUsage,
          currentCost: costData.totalCost,
          tierInfo: sanitizedTier,
          period: selectedPeriod,
          lastUpdated: new Date().toISOString()
        }).catch(err => console.error('Error saving cost data:', err))
      }
    }
  }, [usageData, selectedPeriod])

  const getChartData = () => {
    const now = new Date()
    let filteredData = []
    let labels = []

    if (selectedPeriod === 'daily') {
      // Last 24 hours, grouped by hour
      for (let i = 23; i >= 0; i--) {
        const hourAgo = new Date(now.getTime() - i * 60 * 60 * 1000)
        const hourData = usageData.filter(item => {
          const itemHour = item.time.getHours()
          return itemHour === hourAgo.getHours()
        })
        const totalEnergy = hourData.reduce((sum, item) => sum + item.energy, 0)
        const costData = calculateLESCOCost(totalEnergy)
        filteredData.push(costData.totalCost)
        labels.push(hourAgo.getHours() + 'h')
      }
    } else if (selectedPeriod === 'weekly') {
      // Last 7 days
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      for (let i = 6; i >= 0; i--) {
        const dayAgo = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dayData = usageData.filter(item =>
          item.time.toDateString() === dayAgo.toDateString()
        )
        const totalEnergy = dayData.reduce((sum, item) => sum + item.energy, 0)
        const costData = calculateLESCOCost(totalEnergy)
        filteredData.push(costData.totalCost)
        labels.push(days[dayAgo.getDay()])
      }
    } else {
      // Monthly (last 30 days)
      for (let i = 29; i >= 0; i--) {
        const dayAgo = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dayData = usageData.filter(item =>
          item.time.toDateString() === dayAgo.toDateString()
        )
        const totalEnergy = dayData.reduce((sum, item) => sum + item.energy, 0)
        const costData = calculateLESCOCost(totalEnergy)
        filteredData.push(costData.totalCost)
        labels.push((dayAgo.getDate()).toString())
      }
    }

    return {
      labels: selectedPeriod === 'daily' ? labels.filter((_, i) => i % 4 === 0) : labels,
      datasets: [{
        data: selectedPeriod === 'daily'
          ? filteredData.filter((_, i) => i % 4 === 0).map(v => v || 0.1)
          : filteredData.map(v => v || 0.1),
        color: () => "#4361EE",
        strokeWidth: 2,
      }]
    }
  }

  const showAlert = (message, type = 'info', onConfirm) => {
    setAlertConfig({
      message,
      type,
      onConfirm: onConfirm || (() => setAlertVisible(false))
    })
    setAlertVisible(true)
  }

  const generatePDFReport = async () => {
    if (isGeneratingPDF) {
      showAlert('A PDF is already being generated. Please wait for it to complete.', 'info')
      return
    }

    setIsGeneratingPDF(true)
    try {
      const now = new Date()
      const reportData = {
        period: selectedPeriod,
        usage: currentUsage,
        cost: currentCost,
        tier: tierInfo,
        generatedAt: now.toLocaleString(),
        breakdown: calculateLESCOCost(currentUsage).breakdown
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Switchly Cost Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .breakdown { margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4361EE; color: white; }
            .total { font-weight: bold; background-color: #e8f4fd; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Switchly Cost Report</h1>
            <p>Generated: ${reportData.generatedAt}</p>
            <p>Period: ${reportData.period.toUpperCase()}</p>
          </div>
          
          <div class="summary">
            <h2>Summary</h2>
            <p><strong>Total Usage:</strong> ${reportData.usage.toFixed(3)} kWh</p>
            <p><strong>Total Cost:</strong> ${formatCurrency(reportData.cost)}</p>
            <p><strong>Current Tier:</strong> ${reportData.tier.tier} (${reportData.tier.minUnits}-${reportData.tier.maxUnits === Infinity ? 'Above' : reportData.tier.maxUnits} units)</p>
            <p><strong>Current Rate:</strong> PKR ${reportData.tier.rate}/kWh</p>
          </div>
          
          <div class="breakdown">
            <h3>Cost Breakdown by Tier</h3>
            <table>
              <tr>
                <th>Tier</th>
                <th>Units Range</th>
                <th>Units Used</th>
                <th>Rate (PKR/kWh)</th>
                <th>Cost (PKR)</th>
              </tr>
              ${reportData.breakdown.map(tier => `
                <tr>
                  <td>${tier.tier}</td>
                  <td>${tier.minUnits}-${tier.maxUnits === Infinity ? 'Above' : tier.maxUnits}</td>
                  <td>${tier.units.toFixed(3)}</td>
                  <td>${tier.rate}</td>
                  <td>${tier.cost.toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total">
                <td colspan="4">Total</td>
                <td>${reportData.cost.toFixed(2)}</td>
              </tr>
            </table>
          </div>
        </body>
        </html>
      `

      const { uri } = await Print.printToFileAsync({ html })
      // Small delay to prevent rapid successive calls
      await new Promise(resolve => setTimeout(resolve, 500))
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' })
    } catch (error) {
      console.error('Error generating PDF:', error)
      showAlert('Failed to generate PDF report', 'error')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const generateCSVReport = async () => {
    if (isGeneratingCSV) {
      showAlert('A CSV is already being generated. Please wait for it to complete.', 'info')
      return
    }

    setIsGeneratingCSV(true)
    try {
      const now = new Date()
      const breakdown = calculateLESCOCost(currentUsage).breakdown
      
      const csv = `Switchly Cost Report
Period: ${selectedPeriod.toUpperCase()}
Generated: ${now.toLocaleString()}

Summary
Total Usage,${currentUsage.toFixed(3)} kWh
Total Cost,${formatCurrency(currentCost)}
Current Tier,${tierInfo.tier}
Current Rate,PKR ${tierInfo.rate}/kWh

Cost Breakdown by Tier
Tier,Units Range,Units Used,Rate (PKR/kWh),Cost (PKR)
${breakdown.map(tier => `${tier.tier},${tier.minUnits}-${tier.maxUnits === Infinity ? 'Above' : tier.maxUnits},${tier.units.toFixed(3)},${tier.rate},${tier.cost.toFixed(2)}`).join('\n')}
Total,,,${formatCurrency(currentCost)}
`

      await Clipboard.setStringAsync(csv)
      showAlert('Report copied to clipboard! You can paste it in any app.', 'success')
    } catch (error) {
      console.error('Error generating CSV:', error)
      showAlert('Failed to generate CSV report', 'error')
    } finally {
      setIsGeneratingCSV(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4361EE" />

      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#FFFFFF" />
        <Appbar.Content title="Cost Tracking" titleStyle={styles.headerTitle} />
        <IconButton icon="file-download" iconColor="#FFFFFF" onPress={generatePDFReport} />
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

        {/* Cost Summary Card */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryHeader}>
              <MaterialCommunityIcons name="cash-multiple" size={32} color="#4361EE" />
              <Text style={styles.summaryTitle}>{selectedPeriod.toUpperCase()} COST SUMMARY</Text>
            </View>

            <View style={styles.costDisplay}>
              <Text style={styles.costValue}>{formatCurrency(currentCost)}</Text>
              <Text style={styles.usageValue}>{currentUsage.toFixed(3)} kWh</Text>
            </View>

            <View style={styles.tierInfo}>
              <Chip 
                icon="power-socket" 
                style={styles.tierChip}
                textStyle={styles.tierChipText}
              >
                Tier {tierInfo?.tier} - PKR {tierInfo?.rate}/kWh
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* Cost Chart */}
        <Card style={styles.chartCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>Cost Trend</Text>
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

        {/* Cost Breakdown */}
        <Card style={styles.breakdownCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>Cost Breakdown</Text>
            {calculateLESCOCost(currentUsage).breakdown.map((tier, index) => (
              <View key={index} style={styles.breakdownItem}>
                <View style={styles.breakdownInfo}>
                  <Text style={styles.breakdownTier}>Tier {tier.tier}</Text>
                  <Text style={styles.breakdownRange}>
                    {tier.minUnits}-{tier.maxUnits === Infinity ? 'Above' : tier.maxUnits} units
                  </Text>
                </View>
                <View style={styles.breakdownCost}>
                  <Text style={styles.breakdownUnits}>{tier.units.toFixed(3)} kWh</Text>
                  <Text style={styles.breakdownAmount}>{formatCurrency(tier.cost)}</Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Savings Tips */}
        {savingsTips.length > 0 && (
          <Card style={styles.tipsCard}>
            <Card.Content>
              <Text style={styles.cardTitle}>💡 Cost Savings Tips</Text>
              {savingsTips.map((tip, index) => (
                <View key={index} style={styles.tipItem}>
                  <MaterialCommunityIcons 
                    name={tip.icon} 
                    size={20} 
                    color={tip.priority === 'high' ? '#F44336' : tip.priority === 'medium' ? '#FF9800' : '#4CAF50'} 
                  />
                  <View style={styles.tipContent}>
                    <Text style={styles.tipTitle}>{tip.title}</Text>
                    <Text style={styles.tipMessage}>{tip.message}</Text>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Export Options */}
        <View style={styles.exportSection}>
          <Text style={styles.exportTitle}>Export Reports</Text>
          <View style={styles.exportButtons}>
            <Button
              mode="contained"
              icon="file-pdf-box"
              onPress={generatePDFReport}
              style={styles.exportButton}
              buttonColor="#F44336"
              loading={isGeneratingPDF}
              disabled={isGeneratingPDF || isGeneratingCSV}
            >
              {isGeneratingPDF ? 'Generating...' : 'PDF Report'}
            </Button>
            <Button
              mode="contained"
              icon="file-excel"
              onPress={generateCSVReport}
              style={styles.exportButton}
              buttonColor="#4CAF50"
              loading={isGeneratingCSV}
              disabled={isGeneratingPDF || isGeneratingCSV}
            >
              {isGeneratingCSV ? 'Generating...' : 'CSV Data'}
            </Button>
          </View>
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
  summaryCard: {
    margin: 16,
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
  costDisplay: {
    alignItems: "center",
    marginBottom: 16,
  },
  costValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#4361EE",
    marginBottom: 8,
  },
  usageValue: {
    fontSize: 18,
    color: "#757575",
  },
  tierInfo: {
    alignItems: "center",
  },
  tierChip: {
    backgroundColor: "rgba(67, 97, 238, 0.1)",
  },
  tierChipText: {
    color: "#4361EE",
    fontWeight: "600",
  },
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 16,
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
  breakdownCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  breakdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  breakdownInfo: {
    flex: 1,
  },
  breakdownTier: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212121",
  },
  breakdownRange: {
    fontSize: 14,
    color: "#757575",
  },
  breakdownCost: {
    alignItems: "flex-end",
  },
  breakdownUnits: {
    fontSize: 14,
    color: "#757575",
  },
  breakdownAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4361EE",
  },
  tipsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    padding: 8,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#212121",
    marginBottom: 4,
  },
  tipMessage: {
    fontSize: 12,
    color: "#757575",
    lineHeight: 16,
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
  exportButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  exportButton: {
    flex: 1,
    marginHorizontal: 4,
  },
})

export default CostTrackingScreen
