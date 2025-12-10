export const SAFETY_THRESHOLDS = {
  MAX_VOLTAGE: 250,        
  MIN_VOLTAGE: 180,        
  MAX_CURRENT: 10,         
  MAX_POWER: 2000,         
  MAX_TEMPERATURE: 60,     
  OFFLINE_TIMEOUT: 30000,  
}

// Safety status types
export const SAFETY_STATUS = {
  SAFE: 'safe',
  WARNING: 'warning',
  DANGER: 'danger',
  CRITICAL: 'critical',
  OFFLINE: 'offline'
}

// Safety alert types
export const SAFETY_ALERTS = {
  OVERVOLTAGE: 'overvoltage',
  UNDERVOLTAGE: 'undervoltage',
  OVERLOAD: 'overload',
  HIGH_TEMPERATURE: 'high_temperature',
  DEVICE_OFFLINE: 'device_offline',
  EMERGENCY_SHUTDOWN: 'emergency_shutdown'
}


export const checkVoltageSafety = (voltage) => {
  if (voltage === 0) return { status: SAFETY_STATUS.OFFLINE, message: 'Device Offline' }
  if (voltage > SAFETY_THRESHOLDS.MAX_VOLTAGE) {
    return { 
      status: SAFETY_STATUS.CRITICAL, 
      message: `Overvoltage: ${voltage.toFixed(1)}V (Max: ${SAFETY_THRESHOLDS.MAX_VOLTAGE}V)`,
      action: 'EMERGENCY_SHUTDOWN'
    }
  }
  if (voltage < SAFETY_THRESHOLDS.MIN_VOLTAGE) {
    return { 
      status: SAFETY_STATUS.WARNING, 
      message: `Undervoltage: ${voltage.toFixed(1)}V (Min: ${SAFETY_THRESHOLDS.MIN_VOLTAGE}V)`,
      action: 'WARNING'
    }
  }
  return { status: SAFETY_STATUS.SAFE, message: 'Voltage Normal' }
}

// Check current safety
export const checkCurrentSafety = (current) => {
  if (current > SAFETY_THRESHOLDS.MAX_CURRENT) {
    return { 
      status: SAFETY_STATUS.CRITICAL, 
      message: `Overload: ${current.toFixed(2)}A (Max: ${SAFETY_THRESHOLDS.MAX_CURRENT}A)`,
      action: 'EMERGENCY_SHUTDOWN'
    }
  }
  if (current > SAFETY_THRESHOLDS.MAX_CURRENT * 0.8) {
    return { 
      status: SAFETY_STATUS.WARNING, 
      message: `High Current: ${current.toFixed(2)}A (Approaching limit)`,
      action: 'WARNING'
    }
  }
  return { status: SAFETY_STATUS.SAFE, message: 'Current Normal' }
}

// Check power safety
export const checkPowerSafety = (power) => {
  if (power > SAFETY_THRESHOLDS.MAX_POWER) {
    return { 
      status: SAFETY_STATUS.CRITICAL, 
      message: `Power Overload: ${power.toFixed(0)}W (Max: ${SAFETY_THRESHOLDS.MAX_POWER}W)`,
      action: 'EMERGENCY_SHUTDOWN'
    }
  }
  if (power > SAFETY_THRESHOLDS.MAX_POWER * 0.8) {
    return { 
      status: SAFETY_STATUS.WARNING, 
      message: `High Power: ${power.toFixed(0)}W (Approaching limit)`,
      action: 'WARNING'
    }
  }
  return { status: SAFETY_STATUS.SAFE, message: 'Power Normal' }
}

// Check temperature safety (if sensor available)
export const checkTemperatureSafety = (temperature) => {
  if (temperature > SAFETY_THRESHOLDS.MAX_TEMPERATURE) {
    return { 
      status: SAFETY_STATUS.CRITICAL, 
      message: `High Temperature: ${temperature.toFixed(1)}°C (Max: ${SAFETY_THRESHOLDS.MAX_TEMPERATURE}°C)`,
      action: 'EMERGENCY_SHUTDOWN'
    }
  }
  if (temperature > SAFETY_THRESHOLDS.MAX_TEMPERATURE * 0.8) {
    return { 
      status: SAFETY_STATUS.WARNING, 
      message: `Elevated Temperature: ${temperature.toFixed(1)}°C`,
      action: 'WARNING'
    }
  }
  return { status: SAFETY_STATUS.SAFE, message: 'Temperature Normal' }
}

// Check device connectivity
export const checkDeviceConnectivity = (lastUpdate) => {
  if (!lastUpdate) return { status: SAFETY_STATUS.OFFLINE, message: 'Device Offline' }
  
  const timeSinceUpdate = Date.now() - lastUpdate.getTime()
  if (timeSinceUpdate > SAFETY_THRESHOLDS.OFFLINE_TIMEOUT) {
    return { 
      status: SAFETY_STATUS.WARNING, 
      message: `Device Offline: ${Math.round(timeSinceUpdate / 1000)}s ago`,
      action: 'WARNING'
    }
  }
  return { status: SAFETY_STATUS.SAFE, message: 'Device Online' }
}

// Get overall safety status
export const getOverallSafetyStatus = (voltage, current, power, temperature, lastUpdate) => {
  const voltageCheck = checkVoltageSafety(voltage)
  const currentCheck = checkCurrentSafety(current)
  const powerCheck = checkPowerSafety(power)
  const temperatureCheck = temperature ? checkTemperatureSafety(temperature) : { status: SAFETY_STATUS.SAFE }
  const connectivityCheck = checkDeviceConnectivity(lastUpdate)

  // Priority: Critical > Danger > Warning > Safe
  const statuses = [voltageCheck, currentCheck, powerCheck, temperatureCheck, connectivityCheck]
  
  if (statuses.some(check => check.status === SAFETY_STATUS.CRITICAL)) {
    return {
      status: SAFETY_STATUS.CRITICAL,
      message: 'CRITICAL SAFETY ALERT',
      alerts: statuses.filter(check => check.status === SAFETY_STATUS.CRITICAL),
      action: 'EMERGENCY_SHUTDOWN'
    }
  }
  
  if (statuses.some(check => check.status === SAFETY_STATUS.WARNING)) {
    return {
      status: SAFETY_STATUS.WARNING,
      message: 'Safety Warning',
      alerts: statuses.filter(check => check.status === SAFETY_STATUS.WARNING),
      action: 'WARNING'
    }
  }

  if (statuses.some(check => check.status === SAFETY_STATUS.OFFLINE)) {
    return {
      status: SAFETY_STATUS.OFFLINE,
      message: 'Device Offline',
      alerts: statuses.filter(check => check.status === SAFETY_STATUS.OFFLINE),
      action: 'WARNING'
    }
  }

  return {
    status: SAFETY_STATUS.SAFE,
    message: 'All Systems Safe',
    alerts: [],
    action: 'NONE'
  }
}

// Get safety status color
export const getSafetyStatusColor = (status) => {
  switch (status) {
    case SAFETY_STATUS.SAFE:
      return '#4CAF50' // Green
    case SAFETY_STATUS.WARNING:
      return '#FF9800' // Orange
    case SAFETY_STATUS.DANGER:
      return '#F44336' // Red
    case SAFETY_STATUS.CRITICAL:
      return '#D32F2F' // Dark Red
    case SAFETY_STATUS.OFFLINE:
      return '#757575' // Gray
    default:
      return '#757575'
  }
}

// Get safety status icon
export const getSafetyStatusIcon = (status) => {
  switch (status) {
    case SAFETY_STATUS.SAFE:
      return 'check-circle'
    case SAFETY_STATUS.WARNING:
      return 'alert-circle'
    case SAFETY_STATUS.DANGER:
      return 'alert'
    case SAFETY_STATUS.CRITICAL:
      return 'alert-octagon'
    case SAFETY_STATUS.OFFLINE:
      return 'wifi-off'
    default:
      return 'help-circle'
  }
}

// Emergency shutdown command
export const getEmergencyShutdownCommand = () => {
  return {
    type: 'EMERGENCY_SHUTDOWN',
    timestamp: new Date().toISOString(),
    reason: 'Safety Critical - Emergency Shutdown',
    devices: {
      device1: 'off',
      device2: 'off',
      device3: 'off',
      device4: 'off'
    }
  }
}

// Safety recommendations
export const getSafetyRecommendations = (safetyStatus) => {
  const recommendations = []
  
  if (safetyStatus.status === SAFETY_STATUS.CRITICAL) {
    recommendations.push({
      priority: 'HIGH',
      message: 'IMMEDIATE ACTION REQUIRED - Emergency shutdown activated',
      action: 'Contact electrician immediately'
    })
  }
  
  if (safetyStatus.alerts.some(alert => alert.message.includes('Overvoltage'))) {
    recommendations.push({
      priority: 'HIGH',
      message: 'Check voltage supply and voltage stabilizer',
      action: 'Install voltage stabilizer if not present'
    })
  }
  
  if (safetyStatus.alerts.some(alert => alert.message.includes('Overload'))) {
    recommendations.push({
      priority: 'MEDIUM',
      message: 'Reduce connected load or upgrade wiring',
      action: 'Distribute load across multiple circuits'
    })
  }
  
  if (safetyStatus.alerts.some(alert => alert.message.includes('High Temperature'))) {
    recommendations.push({
      priority: 'MEDIUM',
      message: 'Improve ventilation around electrical panel',
      action: 'Ensure proper air circulation'
    })
  }
  
  if (safetyStatus.status === SAFETY_STATUS.SAFE) {
    recommendations.push({
      priority: 'LOW',
      message: 'All systems operating normally',
      action: 'Continue regular monitoring'
    })
  }
  
  return recommendations
}
