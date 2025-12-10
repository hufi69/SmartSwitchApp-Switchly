import React, { useState, useEffect, useCallback } from "react"
import { View, StyleSheet, ScrollView, Dimensions, StatusBar, TouchableOpacity, Alert } from "react-native"
import { Text, Card, Button, Appbar, SegmentedButtons, IconButton, Chip, List } from "react-native-paper"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { BarChart, LineChart } from "react-native-chart-kit"
import { realtimeDb, auth } from "../config/firebase"
import { ref, onValue, set } from "firebase/database"
import { calculateLESCOCost, formatCurrency, getTierInfo } from "../utils/lescoRates"
import CustomAlert from "../components/CustomAlert"
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as Clipboard from 'expo-clipboard'

const { width } = Dimensions.get("window")

const HistoryScreen = ({ navigation }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('daily')
  const [usageData, setUsageData] = useState([])
  const [historyData, setHistoryData] = useState({
    daily: [],
    weekly: [],
    monthly: []
  })
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isGeneratingCSV, setIsGeneratingCSV] = useState(false)
  const [alertVisible, setAlertVisible] = useState(false)
  const [alertConfig, setAlertConfig] = useState({})

  // Load user's historical data from Firebase - Real-time updates
  useEffect(() => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    console.log('📜 Loading usage history for user:', userId)

    const historyRef = ref(realtimeDb, `users/${userId}/usageHistory`)
    const listener = onValue(historyRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        // Convert Firebase data to array and sort by time (newest first)
        const historyArray = Object.keys(data)
          .map(key => {
            const item = data[key]
            // Parse timestamp - item.timestamp is always stored as ISO string
            let time
            if (item.timestamp) {
              time = new Date(item.timestamp)
            } else {
              // Fallback: try to parse the key (for old data or edge cases)
              time = new Date()
            }
            
            return {
              time,
              power: item.power || 0,
              energy: item.energy || 0,
              voltage: item.voltage || 0,
              current: item.current || 0,
              timestamp: item.timestamp || key
            }
          })
          .sort((a, b) => b.time - a.time) // Sort newest first
        
        setUsageData(historyArray)
        console.log(`✅ Loaded ${historyArray.length} usage records`)
      } else {
        setUsageData([])
        console.log('📭 No usage history found')
      }
    })

    return () => listener()
  }, [])



  useEffect(() => {
    if (usageData.length > 0) {
      processHistoryData()
    } else {
      // Clear history if no data
      setHistoryData({
        daily: [],
        weekly: [],
        monthly: []
      })
    }
  }, [usageData, processHistoryData])

  const processHistoryData = useCallback(() => {
    const now = new Date()
    const dailyData = []
    const weeklyData = []
    const monthlyData = []

    if (usageData.length === 0) {
      setHistoryData({ daily: [], weekly: [], monthly: [] })
      return
    }

    // Process daily data - Group by date and sum energy
    const dailyMap = new Map()
    usageData.forEach(item => {
      const dateKey = item.time.toDateString()
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { energy: 0, power: [] })
      }
      const dayData = dailyMap.get(dateKey)
      dayData.energy += item.energy || 0
      if (item.power) dayData.power.push(item.power)
    })

    // Convert daily map to array
    dailyMap.forEach((data, dateString) => {
      if (data.energy > 0) {
        const costData = calculateLESCOCost(data.energy)
        const sanitizedTier = {
          ...getTierInfo(data.energy),
          maxUnits: getTierInfo(data.energy).maxUnits === Infinity ? null : getTierInfo(data.energy).maxUnits
        }
        dailyData.push({
          date: new Date(dateString),
          usage: data.energy,
          cost: costData.totalCost,
          tier: sanitizedTier
        })
      }
    })

    // Sort daily data by date (newest first)
    dailyData.sort((a, b) => b.date - a.date)

    // Process weekly data - Group by week
    const weeklyMap = new Map()
    usageData.forEach(item => {
      const weekStart = new Date(item.time)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0)
      const weekKey = weekStart.toISOString()
      
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, { energy: 0, startDate: weekStart })
      }
      const weekData = weeklyMap.get(weekKey)
      weekData.energy += item.energy || 0
    })

    // Convert weekly map to array
    let weekIndex = 0
    weeklyMap.forEach((data, weekKey) => {
      if (data.energy > 0) {
        const costData = calculateLESCOCost(data.energy)
        const sanitizedTier = {
          ...getTierInfo(data.energy),
          maxUnits: getTierInfo(data.energy).maxUnits === Infinity ? null : getTierInfo(data.energy).maxUnits
        }
        weeklyData.push({
          week: `Week ${++weekIndex}`,
          startDate: data.startDate,
          usage: data.energy,
          cost: costData.totalCost,
          tier: sanitizedTier
        })
      }
    })

    // Sort weekly data by start date (newest first)
    weeklyData.sort((a, b) => b.startDate - a.startDate)

    // Process monthly data - Group by month
    const monthlyMap = new Map()
    usageData.forEach(item => {
      const monthStart = new Date(item.time.getFullYear(), item.time.getMonth(), 1)
      const monthKey = monthStart.toISOString()
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { energy: 0, startDate: monthStart })
      }
      const monthData = monthlyMap.get(monthKey)
      monthData.energy += item.energy || 0
    })

    // Convert monthly map to array
    monthlyMap.forEach((data, monthKey) => {
      if (data.energy > 0) {
        const costData = calculateLESCOCost(data.energy)
        const sanitizedTier = {
          ...getTierInfo(data.energy),
          maxUnits: getTierInfo(data.energy).maxUnits === Infinity ? null : getTierInfo(data.energy).maxUnits
        }
        monthlyData.push({
          month: data.startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          startDate: data.startDate,
          usage: data.energy,
          cost: costData.totalCost,
          tier: sanitizedTier
        })
      }
    })

    // Sort monthly data by start date (newest first)
    monthlyData.sort((a, b) => b.startDate - a.startDate)

    setHistoryData({ daily: dailyData, weekly: weeklyData, monthly: monthlyData })
  }, [usageData])

  const getCurrentData = () => {
    return historyData[selectedPeriod] || []
  }

  const getChartData = () => {
    const data = getCurrentData()
    
    if (data.length === 0) {
     
      return {
        labels: ['No Data'],
        datasets: [{
          data: [0],
          color: () => "#CCCCCC",
          strokeWidth: 2,
        }]
      }
    }
    
    if (selectedPeriod === 'daily') {
      // Show last 10 days or all if less than 10
      const displayData = data.slice(0, Math.min(10, data.length))
      return {
        labels: displayData.map(item => {
          const day = item.date.getDate()
          const month = item.date.getMonth() + 1
          return `${day}/${month}`
        }),
        datasets: [{
          data: displayData.map(item => parseFloat((item.cost || 0).toFixed(2))),
          color: () => "#4361EE",
          strokeWidth: 2,
        }]
      }
    } else if (selectedPeriod === 'weekly') {
      // Show last 8 weeks or all if less
      const displayData = data.slice(0, Math.min(8, data.length))
      return {
        labels: displayData.map((item, index) => {
          
          if (item.week) {
            return item.week.replace('Week ', 'W')
          }
          return `W${index + 1}`
        }),
        datasets: [{
          data: displayData.map(item => parseFloat((item.cost || 0).toFixed(2))),
          color: () => "#4361EE",
          strokeWidth: 2,
        }]
      }
    } else {
      // Show last 6 months or all if less
      const displayData = data.slice(0, Math.min(6, data.length))
      return {
        labels: displayData.map(item => {
          if (item.month) {
            return item.month.split(' ')[0]
          }
          return 'Month'
        }),
        datasets: [{
          data: displayData.map(item => parseFloat((item.cost || 0).toFixed(2))),
          color: () => "#4361EE",
          strokeWidth: 2,
        }]
      }
    }
  }

  const getTotalStats = () => {
    const data = getCurrentData()
    const totalUsage = data.reduce((sum, item) => sum + (item.usage || 0), 0)
    const totalCost = data.reduce((sum, item) => sum + (item.cost || 0), 0)
    const avgDailyCost = data.length > 0 
      ? (selectedPeriod === 'daily' ? totalCost / data.length : totalCost / (data.length * 7))
      : 0
    
    return { 
      totalUsage: totalUsage || 0, 
      totalCost: totalCost || 0, 
      avgDailyCost: isNaN(avgDailyCost) ? 0 : avgDailyCost 
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

  const generateDetailedReport = async () => {
    if (isGeneratingPDF) {
      showAlert('A PDF is already being generated. Please wait for it to complete.', 'info')
      return
    }

    setIsGeneratingPDF(true)
    try {
      const data = getCurrentData()
      const stats = getTotalStats()
      const now = new Date()

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Switchly History Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .data-table { margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4361EE; color: white; }
            .total { font-weight: bold; background-color: #e8f4fd; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Switchly History Report</h1>
            <p>Generated: ${now.toLocaleString()}</p>
            <p>Period: ${selectedPeriod.toUpperCase()}</p>
          </div>
          
          <div class="summary">
            <h2>Summary</h2>
            <p><strong>Total Usage:</strong> ${stats.totalUsage.toFixed(3)} kWh</p>
            <p><strong>Total Cost:</strong> ${formatCurrency(stats.totalCost)}</p>
            <p><strong>Average Daily Cost:</strong> ${formatCurrency(stats.avgDailyCost)}</p>
          </div>
          
          <div class="data-table">
            <h3>Detailed ${selectedPeriod.toUpperCase()} Data</h3>
            <table>
              <tr>
                <th>Date</th>
                <th>Usage (kWh)</th>
                <th>Cost (PKR)</th>
                <th>Tier</th>
                <th>Rate (PKR/kWh)</th>
              </tr>
              ${data.map(item => `
                <tr>
                  <td>${selectedPeriod === 'daily' ? item.date.toLocaleDateString() : item.week || item.month}</td>
                  <td>${item.usage.toFixed(3)}</td>
                  <td>${formatCurrency(item.cost)}</td>
                  <td>${item.tier.tier}</td>
                  <td>${item.tier.rate}</td>
                </tr>
              `).join('')}
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
      console.error('Error generating report:', error)
      showAlert('Failed to generate detailed report', 'error')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const exportCSVData = async () => {
    if (isGeneratingCSV) {
      showAlert('A CSV is already being generated. Please wait for it to complete.', 'info')
      return
    }

    setIsGeneratingCSV(true)
    try {
      const data = getCurrentData()
      const stats = getTotalStats()
      const now = new Date()
      
      const csv = `Switchly History Report
Period: ${selectedPeriod.toUpperCase()}
Generated: ${now.toLocaleString()}

Summary
Total Usage,${stats.totalUsage.toFixed(3)} kWh
Total Cost,${formatCurrency(stats.totalCost)}
Average Daily Cost,${formatCurrency(stats.avgDailyCost)}

${selectedPeriod.toUpperCase()} Data
Date,Usage (kWh),Cost (PKR),Tier,Rate (PKR/kWh)
${data.map(item => `${selectedPeriod === 'daily' ? item.date.toLocaleDateString() : item.week || item.month},${item.usage.toFixed(3)},${formatCurrency(item.cost)},${item.tier.tier},${item.tier.rate}`).join('\n')}
`

      await Clipboard.setStringAsync(csv)
      showAlert('History data copied to clipboard! You can paste it in any app.', 'success')
    } catch (error) {
      console.error('Error exporting CSV:', error)
      showAlert('Failed to export CSV data', 'error')
    } finally {
      setIsGeneratingCSV(false)
    }
  }

  const stats = getTotalStats()
  const data = getCurrentData()

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4361EE" />

      <Appbar.Header style={styles.header}>
        <Appbar.Content title="Usage History" titleStyle={styles.headerTitle} />
        <IconButton icon="file-download" iconColor="#FFFFFF" onPress={generateDetailedReport} />
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

        {/* Summary Stats */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryHeader}>
              <MaterialCommunityIcons name="chart-histogram" size={32} color="#4361EE" />
              <Text style={styles.summaryTitle}>{selectedPeriod.toUpperCase()} SUMMARY</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Usage</Text>
                <Text style={styles.statValue}>{stats.totalUsage.toFixed(3)} kWh</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Cost</Text>
                <Text style={styles.statValue}>{formatCurrency(stats.totalCost)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Avg Daily Cost</Text>
                <Text style={styles.statValue}>{formatCurrency(stats.avgDailyCost)}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Chart */}
        <Card style={styles.chartCard}>
          <Card.Content>
            <View style={styles.chartHeader}>
              <MaterialCommunityIcons name="chart-line-variant" size={24} color="#4361EE" />
              <Text style={styles.cardTitle}>Cost Trend</Text>
            </View>
            {data.length > 0 ? (
              <View style={styles.chartContainer}>
                <BarChart
                  data={getChartData()}
                  width={width - 80}
                  height={240}
                  fromZero={true}
                  chartConfig={{
                    backgroundColor: "#FFFFFF",
                    backgroundGradientFrom: "#FFFFFF",
                    backgroundGradientTo: "#F8F9FA",
                    decimalPlaces: 2,
                    color: (opacity = 1) => `rgba(67, 97, 238, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(117, 117, 117, ${opacity})`,
                    style: { 
                      borderRadius: 16,
                    },
                    barPercentage: 0.6,
                    fillShadowGradient: "#4361EE",
                    fillShadowGradientOpacity: 0.8,
                    propsForBackgroundLines: {
                      strokeDasharray: "3,3",
                      stroke: "#E0E0E0",
                      strokeWidth: 1,
                    },
                    propsForLabels: {
                      fontSize: 10,
                      fontWeight: '600',
                    },
                    formatYLabel: (value) => {
                      const num = parseFloat(value)
                      if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
                      if (num >= 1) return num.toFixed(1)
                      return num.toFixed(2)
                    },
                  }}
                  showValuesOnTopOfBars={true}
                  withInnerLines={true}
                  withVerticalLabels={true}
                  withHorizontalLabels={true}
                  segments={4}
                  style={styles.chart}
                  yAxisLabel="PKR "
                  yAxisSuffix=""
                />
              </View>
            ) : (
              <View style={styles.chartEmptyState}>
                <MaterialCommunityIcons name="chart-line" size={48} color="#CCCCCC" />
                <Text style={styles.chartEmptyText}>No cost data available</Text>
                <Text style={styles.chartEmptySubtext}>Start using Switchly to see cost trends</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Data List */}
        <Card style={styles.dataCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>Detailed Records</Text>
            {data.length > 0 ? (
              data.slice(0, 10).map((item, index) => (
                <List.Item
                  key={index}
                  title={selectedPeriod === 'daily' ? item.date.toLocaleDateString() : item.week || item.month}
                  description={`${item.usage.toFixed(3)} kWh • Tier ${item.tier.tier}`}
                  right={() => (
                    <View style={styles.listRight}>
                      <Text style={styles.costText}>{formatCurrency(item.cost)}</Text>
                      <Text style={styles.rateText}>PKR {item.tier.rate}/kWh</Text>
                    </View>
                  )}
                  left={() => (
                    <MaterialCommunityIcons 
                      name="chart-line" 
                      size={24} 
                      color="#4361EE" 
                    />
                  )}
                  style={styles.listItem}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="chart-line" size={48} color="#CCCCCC" />
                <Text style={styles.emptyText}>No data available</Text>
                <Text style={styles.emptySubtext}>Start using Switchly to see history</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Export Options */}
        <View style={styles.exportSection}>
          <Text style={styles.exportTitle}>Export Reports</Text>
          <View style={styles.exportButtons}>
            <Button
              mode="contained"
              icon="file-pdf-box"
              onPress={generateDetailedReport}
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
              onPress={exportCSVData}
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
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#757575",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212121",
  },
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
    color: "#4361EE",
  },
  chartContainer: {
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  chart: {
    borderRadius: 12,
    marginVertical: 8,
  },
  chartEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  chartEmptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#757575",
    marginTop: 16,
  },
  chartEmptySubtext: {
    fontSize: 14,
    color: "#9E9E9E",
    marginTop: 8,
    textAlign: "center",
  },
  dataCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  listItem: {
    backgroundColor: "#FFFFFF",
  },
  listRight: {
    alignItems: "flex-end",
  },
  costText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4361EE",
  },
  rateText: {
    fontSize: 12,
    color: "#757575",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#757575",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9E9E9E",
    marginTop: 8,
    textAlign: "center",
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

export default HistoryScreen
