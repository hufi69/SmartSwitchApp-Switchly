import React, { useEffect, useRef } from "react"
import { View, StyleSheet, Animated, Dimensions } from "react-native"
import { Text } from "react-native-paper"
import { MaterialCommunityIcons } from "@expo/vector-icons"

const { width } = Dimensions.get("window")

const Toast = ({ visible, message, type = "error", duration = 3000, onDismiss }) => {
  const slideAnim = useRef(new Animated.Value(-100)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start()

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [visible])

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) onDismiss()
    })
  }

  const getToastConfig = () => {
    switch (type) {
      case "success":
        return {
          icon: "check-circle",
          iconColor: "#FFFFFF",
          textColor: "#FFFFFF",
          backgroundColor: "#4361EE",
          iconBackground: "rgba(255, 255, 255, 0.2)",
        }
      case "error":
        return {
          icon: "alert-circle",
          iconColor: "#FFFFFF",
          textColor: "#FFFFFF",
          backgroundColor: "#1E3A8A",
          iconBackground: "rgba(255, 255, 255, 0.2)",
        }
      case "warning":
        return {
          icon: "alert",
          iconColor: "#FFFFFF",
          textColor: "#FFFFFF",
          backgroundColor: "#1E3A8A",
          iconBackground: "rgba(255, 255, 255, 0.2)",
        }
      case "info":
        return {
          icon: "toggle-switch",
          iconColor: "#FFFFFF",
          textColor: "#FFFFFF",
          backgroundColor: "#4361EE",
          iconBackground: "rgba(255, 255, 255, 0.2)",
        }
      default:
        return {
          icon: "toggle-switch",
          iconColor: "#FFFFFF",
          textColor: "#FFFFFF",
          backgroundColor: "#1E3A8A",
          iconBackground: "rgba(255, 255, 255, 0.2)",
        }
    }
  }

  if (!visible) return null

  const config = getToastConfig()

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: config.iconBackground }]}>
          <MaterialCommunityIcons name={config.icon} size={20} color={config.iconColor} />
        </View>
        <Text style={[styles.message, { color: config.textColor }]}>{message}</Text>
      </View>
      <MaterialCommunityIcons
        name="close"
        size={20}
        color={config.textColor}
        onPress={hideToast}
        style={styles.closeIcon}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    zIndex: 9999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  message: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    lineHeight: 20,
  },
  closeIcon: {
    marginLeft: 12,
    padding: 4,
  },
})

export default Toast
