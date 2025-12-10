// Pakistani holidays for 2024-2025
const PAKISTANI_HOLIDAYS = [
  // 2024
  { date: '2024-01-01', name: 'New Year Day', type: 'national' },
  { date: '2024-02-05', name: 'Kashmir Day', type: 'national' },
  { date: '2024-03-23', name: 'Pakistan Day', type: 'national' },
  { date: '2024-04-10', name: 'Eid-ul-Fitr', type: 'religious' },
  { date: '2024-04-11', name: 'Eid-ul-Fitr Holiday', type: 'religious' },
  { date: '2024-05-01', name: 'Labour Day', type: 'national' },
  { date: '2024-06-16', name: 'Eid-ul-Adha', type: 'religious' },
  { date: '2024-07-17', name: 'Eid-ul-Adha Holiday', type: 'religious' },
  { date: '2024-08-14', name: 'Independence Day', type: 'national' },
  { date: '2024-09-15', name: 'Ashura', type: 'religious' },
  { date: '2024-12-25', name: 'Quaid-e-Azam Day', type: 'national' },
  
  // 2025
  { date: '2025-01-01', name: 'New Year Day', type: 'national' },
  { date: '2025-02-05', name: 'Kashmir Day', type: 'national' },
  { date: '2025-03-23', name: 'Pakistan Day', type: 'national' },
  { date: '2025-03-30', name: 'Eid-ul-Fitr', type: 'religious' },
  { date: '2025-03-31', name: 'Eid-ul-Fitr Holiday', type: 'religious' },
  { date: '2025-05-01', name: 'Labour Day', type: 'national' },
  { date: '2025-06-06', name: 'Eid-ul-Adha', type: 'religious' },
  { date: '2025-06-07', name: 'Eid-ul-Adha Holiday', type: 'religious' },
  { date: '2025-08-14', name: 'Independence Day', type: 'national' },
  { date: '2025-09-05', name: 'Ashura', type: 'religious' },
  { date: '2025-12-25', name: 'Quaid-e-Azam Day', type: 'national' },
]

// Smart scenes configuration
export const SMART_SCENES = {
  'movie_night': {
    name: 'Movie Night',
    icon: 'movie',
    description: 'Dim lights, turn off unnecessary devices',
    devices: {
      'device1': 'off', // Laptop charger off
      'device2': 'on',  // Phone charger on
      'device3': 'off', // Main lights off
      'device4': 'on'   // Fan on for comfort
    },
    duration: 180 // 3 hours
  },
  'sleep_mode': {
    name: 'Sleep Mode',
    icon: 'sleep',
    description: 'Turn off all devices for peaceful sleep',
    devices: {
      'device1': 'off', // Laptop charger off
      'device2': 'off', // Phone charger off
      'device3': 'off', // Lights off
      'device4': 'off'  // Fan off
    },
    duration: 480 // 8 hours
  },
  'work_mode': {
    name: 'Work Mode',
    icon: 'laptop',
    description: 'Optimal setup for work from home',
    devices: {
      'device1': 'on',  // Laptop charger on
      'device2': 'on',  // Phone charger on
      'device3': 'on',  // Lights on
      'device4': 'on'   // Fan on
    },
    duration: 480 // 8 hours
  },
  'vacation_mode': {
    name: 'Vacation Mode',
    icon: 'airplane',
    description: 'Minimal power usage while away',
    devices: {
      'device1': 'off', // Laptop charger off
      'device2': 'off', // Phone charger off
      'device3': 'off', // Lights off
      'device4': 'off'  // Fan off
    },
    duration: 1440 // 24 hours
  },
  'security_mode': {
    name: 'Security Mode',
    icon: 'shield',
    description: 'Random device patterns for security',
    devices: 'random', // Random on/off patterns
    duration: 480 // 8 hours
  }
}

// Check if a date is a holiday
export const isHoliday = (date = new Date()) => {
  const dateString = date.toISOString().split('T')[0]
  return PAKISTANI_HOLIDAYS.some(holiday => holiday.date === dateString)
}

// Get holiday information for a date
export const getHolidayInfo = (date = new Date()) => {
  const dateString = date.toISOString().split('T')[0]
  return PAKISTANI_HOLIDAYS.find(holiday => holiday.date === dateString)
}

// Check if it's a weekend
export const isWeekend = (date = new Date()) => {
  const day = date.getDay()
  return day === 0 || day === 6 // Sunday or Saturday
}

// Check if it's a weekday
export const isWeekday = (date = new Date()) => {
  return !isWeekend(date)
}

// Get day type (weekday, weekend, holiday)
export const getDayType = (date = new Date()) => {
  if (isHoliday(date)) return 'holiday'
  if (isWeekend(date)) return 'weekend'
  return 'weekday'
}

// Generate random schedule for security
export const generateRandomSchedule = (deviceCount = 4, duration = 480) => {
  const schedule = []
  const interval = 30 // 30 minutes intervals
  
  for (let i = 0; i < duration; i += interval) {
    const timeSlot = {
      time: i,
      devices: {}
    }
    
    // Random on/off for each device
    for (let j = 1; j <= deviceCount; j++) {
      timeSlot.devices[`device${j}`] = Math.random() > 0.5 ? 'on' : 'off'
    }
    
    schedule.push(timeSlot)
  }
  
  return schedule
}

// Get optimal schedule based on day type
export const getOptimalSchedule = (dayType, sunriseTime, sunsetTime) => {
  const schedules = {
    weekday: {
      morning: { start: sunriseTime, devices: { 'device3': 'on', 'device4': 'on' } },
      work: { start: 9, devices: { 'device1': 'on', 'device2': 'on', 'device3': 'on', 'device4': 'on' } },
      evening: { start: 18, devices: { 'device3': 'on', 'device4': 'on' } },
      night: { start: sunsetTime, devices: { 'device3': 'off', 'device4': 'off' } }
    },
    weekend: {
      morning: { start: sunriseTime + 1, devices: { 'device3': 'on' } },
      day: { start: 10, devices: { 'device1': 'on', 'device2': 'on', 'device3': 'on', 'device4': 'on' } },
      evening: { start: 19, devices: { 'device3': 'on', 'device4': 'on' } },
      night: { start: sunsetTime + 1, devices: { 'device3': 'off', 'device4': 'off' } }
    },
    holiday: {
      morning: { start: sunriseTime + 2, devices: { 'device3': 'on' } },
      day: { start: 11, devices: { 'device1': 'on', 'device2': 'on', 'device3': 'on' } },
      evening: { start: 20, devices: { 'device3': 'on', 'device4': 'on' } },
      night: { start: sunsetTime + 2, devices: { 'device3': 'off', 'device4': 'off' } }
    }
  }
  
  return schedules[dayType] || schedules.weekday
}

// Calculate energy savings from smart scheduling
export const calculateEnergySavings = (normalUsage, smartUsage) => {
  const savings = normalUsage - smartUsage
  const percentage = (savings / normalUsage) * 100
  return {
    savings,
    percentage: Math.round(percentage * 100) / 100
  }
}

// Get smart recommendations based on usage patterns
export const getSmartRecommendations = (usageData) => {
  const recommendations = []
  
  // Analyze peak usage times
  const peakHours = usageData.filter(data => data.power > 1000)
  if (peakHours.length > 0) {
    recommendations.push({
      type: 'peak_usage',
      message: 'Consider shifting high-power devices to off-peak hours',
      impact: 'High',
      savings: '15-25%'
    })
  }
  
  // Check for overnight usage
  const overnightUsage = usageData.filter(data => {
    const hour = new Date(data.time).getHours()
    return hour >= 22 || hour <= 6
  })
  
  if (overnightUsage.length > 0) {
    recommendations.push({
      type: 'overnight_usage',
      message: 'Turn off unnecessary devices at night',
      impact: 'Medium',
      savings: '10-15%'
    })
  }
  
  return recommendations
}
