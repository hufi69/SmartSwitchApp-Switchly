
// Based on NOAA Solar Calculator algorithm
const calculateSunriseSunset = (latitude, longitude, date = new Date()) => {
  // Convert to radians
  const lat = latitude * Math.PI / 180
  const lng = longitude * Math.PI / 180
  
  // Calculate day of year
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date - start) / (1000 * 60 * 60 * 24))
  
  // Solar declination
  const declination = 23.45 * Math.sin((360 * (284 + dayOfYear) / 365) * Math.PI / 180) * Math.PI / 180
  
  // Hour angle
  const hourAngle = Math.acos(-Math.tan(lat) * Math.tan(declination))
  
  // Time correction
  const timeCorrection = 4 * (lng * 180 / Math.PI) + (dayOfYear - 81) * 0.25
  
  // Sunrise and sunset times
  const sunriseTime = 12 - (hourAngle * 12 / Math.PI) - timeCorrection / 60
  const sunsetTime = 12 + (hourAngle * 12 / Math.PI) - timeCorrection / 60
  
  // Convert to hours and minutes
  const sunriseHour = Math.floor(sunriseTime)
  const sunriseMinute = Math.floor((sunriseTime - sunriseHour) * 60)
  const sunsetHour = Math.floor(sunsetTime)
  const sunsetMinute = Math.floor((sunsetTime - sunsetHour) * 60)
  
  return {
    sunrise: {
      hour: sunriseHour,
      minute: sunriseMinute,
      time: new Date(date.getFullYear(), date.getMonth(), date.getDate(), sunriseHour, sunriseMinute)
    },
    sunset: {
      hour: sunsetHour,
      minute: sunsetMinute,
      time: new Date(date.getFullYear(), date.getMonth(), date.getDate(), sunsetHour, sunsetMinute)
    }
  }
}

// Default location (Lahore, Pakistan)
const DEFAULT_LOCATION = {
  latitude: 31.5204,
  longitude: 74.3587
}

export const getSunriseSunset = (latitude = DEFAULT_LOCATION.latitude, longitude = DEFAULT_LOCATION.longitude, date = new Date()) => {
  return calculateSunriseSunset(latitude, longitude, date)
}

export const getSunriseTime = (latitude = DEFAULT_LOCATION.latitude, longitude = DEFAULT_LOCATION.longitude, date = new Date()) => {
  const { sunrise } = calculateSunriseSunset(latitude, longitude, date)
  return sunrise.time
}

export const getSunsetTime = (latitude = DEFAULT_LOCATION.latitude, longitude = DEFAULT_LOCATION.longitude, date = new Date()) => {
  const { sunset } = calculateSunriseSunset(latitude, longitude, date)
  return sunset.time
}

export const formatTime = (date) => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export const isDaytime = (latitude = DEFAULT_LOCATION.latitude, longitude = DEFAULT_LOCATION.longitude, date = new Date()) => {
  const { sunrise, sunset } = calculateSunriseSunset(latitude, longitude, date)
  const currentTime = date.getHours() + date.getMinutes() / 60
  
  return currentTime >= sunrise.hour + sunrise.minute / 60 && 
         currentTime <= sunset.hour + sunset.minute / 60
}

export const getDaylightDuration = (latitude = DEFAULT_LOCATION.latitude, longitude = DEFAULT_LOCATION.longitude, date = new Date()) => {
  const { sunrise, sunset } = calculateSunriseSunset(latitude, longitude, date)
  const sunriseMinutes = sunrise.hour * 60 + sunrise.minute
  const sunsetMinutes = sunset.hour * 60 + sunset.minute
  
  return sunsetMinutes - sunriseMinutes 
}
