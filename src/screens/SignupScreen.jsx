import React, { useState, useRef } from "react"
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
  ImageBackground,
  Modal,
  TextInput as RNTextInput,
} from "react-native"
import { TextInput, Button, Text, ProgressBar } from "react-native-paper"
import { useForm, Controller } from "react-hook-form"
import { LinearGradient } from "expo-linear-gradient"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { auth } from "../config/firebase"
import Toast from "../components/Toast"

const { width, height } = Dimensions.get("window")

const SignupScreen = ({ navigation, setIsAuthenticated }) => {
  const [secureTextEntry, setSecureTextEntry] = useState(true)
  const [confirmSecureTextEntry, setConfirmSecureTextEntry] = useState(true)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: "", type: "error" })
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [currentStep, setCurrentStep] = useState(1)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [userName, setUserName] = useState("")
  const [passwordKey, setPasswordKey] = useState(0)
  const [confirmPasswordKey, setConfirmPasswordKey] = useState(0)

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current
  const successIconScale = useRef(new Animated.Value(0)).current
  const successIconRotate = useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    resetField,
    trigger,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const password = watch("password")

  // Clear password fields when moving to step 2
  React.useEffect(() => {
    if (currentStep === 2) {
      // Force clear password fields and reset keys to force re-render
      resetField("password", { defaultValue: "" })
      resetField("confirmPassword", { defaultValue: "" })
      setValue("password", "", { shouldValidate: false, shouldDirty: false, shouldTouch: false })
      setValue("confirmPassword", "", { shouldValidate: false, shouldDirty: false, shouldTouch: false })
      // Force re-render by changing keys
      setPasswordKey(prev => prev + 1)
      setConfirmPasswordKey(prev => prev + 1)
    }
  }, [currentStep, resetField, setValue])

  // Calculate password strength
  React.useEffect(() => {
    if (!password) {
      setPasswordStrength(0)
      return
    }

    let strength = 0

    // Length check
    if (password.length >= 8) strength += 0.25

    // Contains uppercase
    if (/[A-Z]/.test(password)) strength += 0.25

    // Contains number
    if (/[0-9]/.test(password)) strength += 0.25

    // Contains special character
    if (/[^A-Za-z0-9]/.test(password)) strength += 0.25

    setPasswordStrength(strength)
  }, [password])

  const getStrengthColor = () => {
    if (passwordStrength < 0.25) return "#CF6679"
    if (passwordStrength < 0.5) return "#FB8C00"
    if (passwordStrength < 0.75) return "#FFC107"
    return "#4CAF50"
  }

  const getStrengthText = () => {
    if (passwordStrength < 0.25) return "Weak"
    if (passwordStrength < 0.5) return "Fair"
    if (passwordStrength < 0.75) return "Good"
    return "Strong"
  }

  const showToast = (message, type = "error") => {
    setToast({ visible: true, message, type })
  }

  const hideToast = () => {
    setToast({ visible: false, message: "", type: "error" })
  }

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      // Create user with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password)
      const user = userCredential.user

      // Update user profile with full name
      await updateProfile(user, {
        displayName: data.fullName,
      })

      console.log("User created:", user.email)
      setLoading(false)
      setUserName(data.fullName)

      // Show success modal instead of auto-login
      setShowSuccessModal(true)
    } catch (error) {
      setLoading(false)
      
      // Console logging to identify the error
      console.error(" Firebase Auth Error Details:")
      console.error("Error Code:", error.code)
      console.error("Error Message:", error.message)
      console.error("Full Error Object:", JSON.stringify(error, null, 2))
      if (error.stack) {
        console.error("Error Stack:", error.stack)
      }
      
      let errorMessage = "Sign up failed. Please try again."

      // Handle specific Firebase errors
      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage = "This email is already registered"
          break
        case "auth/invalid-email":
          errorMessage = "Invalid email address"
          break
        case "auth/operation-not-allowed":
          errorMessage = "Email/password accounts are not enabled"
          break
        case "auth/weak-password":
          errorMessage = "Password is too weak. Use at least 6 characters"
          break
        case "auth/network-request-failed":
          errorMessage = " Network Error: Please check your internet connection and try again"
          console.error(" Network issue detected. Check:")
          console.error("1. Internet connection is active")
          console.error("2. Firebase project is properly configured")
          console.error("3. No firewall blocking Firebase requests")
          break
        case "auth/too-many-requests":
          errorMessage = "Too many requests. Please wait a moment and try again"
          break
        case "auth/internal-error":
          errorMessage = "Internal error. Please try again in a moment"
          break
        default:
          // Check if it's a network-related error by message
          if (error.message && (
            error.message.includes("network") || 
            error.message.includes("Network") ||
            error.message.includes("timeout") ||
            error.message.includes("connection") ||
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("ENOTFOUND") ||
            error.message.includes("Network request failed")
          )) {
            errorMessage = " Network Error: Please check your internet connection and try again"
            console.error(" Network issue detected from error message")
          } else {
            errorMessage = error.message || "Sign up failed. Please try again."
          }
      }

      showToast(errorMessage, "error")
    }
  }

  React.useEffect(() => {
    if (showSuccessModal) {
      // Animate success icon
      Animated.sequence([
        Animated.spring(successIconScale, {
          toValue: 1,
          tension: 50,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.timing(successIconRotate, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      successIconScale.setValue(0)
      successIconRotate.setValue(0)
    }
  }, [showSuccessModal])

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false)
    // Navigate to login screen
    navigation.navigate("Login")
  }

  return (
    <ImageBackground
      source={{ uri: "https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?q=80&w=2070" }}
      style={styles.backgroundImage}
      blurRadius={5}
    >
      <LinearGradient colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.8)"]} style={styles.gradient}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <Animated.View
              style={[
                styles.headerContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate("Login")}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Sign up to control your smart devices</Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.formContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, currentStep >= 1 && styles.activeStepDot]} />
                <View style={styles.stepLine} />
                <View style={[styles.stepDot, currentStep >= 2 && styles.activeStepDot]} />
              </View>

              {currentStep === 1 ? (
                <>
                  <Text style={styles.stepTitle}>Personal Information</Text>

                  <Controller
                    control={control}
                    rules={{
                      required: "Full name is required",
                      minLength: {
                        value: 3,
                        message: "Name must be at least 3 characters",
                      },
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        label="Full Name"
                        placeholder="Enter your full name"
                        mode="outlined"
                        left={<TextInput.Icon icon="account" />}
                        style={styles.input}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        error={!!errors.fullName}
                        outlineColor="rgba(255,255,255,0.3)"
                        activeOutlineColor="#4361EE"
                        textColor="#FFFFFF"
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        theme={{
                          colors: {
                            onSurfaceVariant: "#FFFFFF",
                            placeholder: "rgba(255,255,255,0.5)",
                            background: "transparent",
                            surfaceVariant: "rgba(0, 0, 0, 0.6)",
                            primary: "#FFFFFF",
                          },
                        }}
                      />
                    )}
                    name="fullName"
                  />
                  {errors.fullName && <Text style={styles.errorText}>{errors.fullName.message}</Text>}

                  <Controller
                    control={control}
                    rules={{
                      required: "Email is required",
                      validate: (value) => {
                        if (!value) return "Email is required"
                        if (!value.includes("@")) {
                          return "Email must contain @ symbol"
                        }
                        if (!value.includes(".")) {
                          return "Email must contain a dot (.)"
                        }
                        const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
                        if (!emailRegex.test(value)) {
                          return "Invalid email address format"
                        }
                        return true
                      },
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        label="Email"
                        placeholder="Enter your email"
                        mode="outlined"
                        left={<TextInput.Icon icon="email" />}
                        style={styles.input}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        error={!!errors.email}
                        outlineColor="rgba(255,255,255,0.3)"
                        activeOutlineColor="#4361EE"
                        textColor="#FFFFFF"
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        theme={{
                          colors: {
                            onSurfaceVariant: "#FFFFFF",
                            placeholder: "rgba(255,255,255,0.5)",
                            background: "transparent",
                            surfaceVariant: "rgba(0, 0, 0, 0.6)",
                            primary: "#FFFFFF",
                          },
                        }}
                      />
                    )}
                    name="email"
                  />
                  {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}

                  <Button
                    mode="contained"
                    onPress={async () => {
                      // Trigger validation for all fields
                      const fullNameValue = watch("fullName")
                      const emailValue = watch("email")
                      
                      // Check if fields are filled
                      if (!fullNameValue || !emailValue) {
                        showToast("Please fill in all fields", "warning")
                        return
                      }
                      
                      // Trigger react-hook-form validation - this will validate both @ and . automatically
                      const isFullNameValid = await trigger("fullName")
                      const isEmailValid = await trigger("email")
                      
                      // If validation fails, trigger() returns false
                      if (!isFullNameValid || !isEmailValid) {
                        // The error message will be shown in the error text below the input
                        // Just show a general toast
                        showToast("Please Enter Valid Email and Full Name", "warning")
                        return
                      }
                      
                      // If we reach here, validation passed
                      setCurrentStep(2)
                    }}
                    style={styles.button}
                    buttonColor="#4361EE"
                  >
                    Continue
                  </Button>
                </>
              ) : (
                <>
                  <Text style={styles.stepTitle}>Create Password</Text>

                  <Controller
                    control={control}
                    rules={{
                      required: "Password is required",
                      minLength: {
                        value: 8,
                        message: "Password must be at least 8 characters",
                      },
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        key={`password-${currentStep}-${passwordKey}`}
                        label="Password"
                        placeholder="Enter 8 digit password"
                        mode="outlined"
                        left={<TextInput.Icon icon="lock" />}
                        right={
                          <TextInput.Icon
                            icon={secureTextEntry ? "eye" : "eye-off"}
                            onPress={() => setSecureTextEntry(!secureTextEntry)}
                          />
                        }
                        style={styles.input}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value === undefined || value === null ? "" : String(value)}
                        secureTextEntry={secureTextEntry}
                        error={!!errors.password}
                        autoComplete="off"
                        autoCorrect={false}
                        autoCapitalize="none"
                        textContentType="newPassword"
                        keyboardType="default"
                        outlineColor="rgba(255,255,255,0.3)"
                        activeOutlineColor="#4361EE"
                        textColor="#FFFFFF"
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        theme={{
                          colors: {
                            onSurfaceVariant: "#FFFFFF",
                            placeholder: "rgba(255,255,255,0.5)",
                            background: "transparent",
                            surfaceVariant: "rgba(0, 0, 0, 0.6)",
                            primary: "#FFFFFF",
                          },
                        }}
                      />
                    )}
                    name="password"
                  />
                  {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}

                  {password && (
                    <View style={styles.strengthContainer}>
                      <ProgressBar progress={passwordStrength} color={getStrengthColor()} style={styles.strengthBar} />
                      <Text style={[styles.strengthText, { color: getStrengthColor() }]}>{getStrengthText()}</Text>
                    </View>
                  )}

                  <Controller
                    control={control}
                    rules={{
                      required: "Please confirm your password",
                      validate: (value) => value === password || "Passwords do not match",
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        key={`confirmPassword-${currentStep}-${confirmPasswordKey}`}
                        label="Confirm Password"
                        placeholder="Confirm your password"
                        mode="outlined"
                        left={<TextInput.Icon icon="lock-check" />}
                        right={
                          <TextInput.Icon
                            icon={confirmSecureTextEntry ? "eye" : "eye-off"}
                            onPress={() => setConfirmSecureTextEntry(!confirmSecureTextEntry)}
                          />
                        }
                        style={styles.input}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value === undefined || value === null ? "" : String(value)}
                        secureTextEntry={confirmSecureTextEntry}
                        error={!!errors.confirmPassword}
                        autoComplete="off"
                        autoCorrect={false}
                        autoCapitalize="none"
                        textContentType="newPassword"
                        keyboardType="default"
                        outlineColor="rgba(255,255,255,0.3)"
                        activeOutlineColor="#4361EE"
                        textColor="#FFFFFF"
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        theme={{
                          colors: {
                            onSurfaceVariant: "#FFFFFF",
                            placeholder: "rgba(255,255,255,0.5)",
                            background: "transparent",
                            surfaceVariant: "rgba(0, 0, 0, 0.6)",
                            primary: "#FFFFFF",
                          },
                        }}
                      />
                    )}
                    name="confirmPassword"
                  />
                  {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>}

                  <View style={styles.buttonRow}>
                    <Button
                      mode="outlined"
                      onPress={() => {
                        setCurrentStep(1)
                      }}
                      style={[styles.button, styles.backBtn]}
                      textColor="#FFFFFF"
                    >
                      Back
                    </Button>
                    <Button
                      mode="contained"
                      onPress={handleSubmit(onSubmit)}
                      style={[styles.button, styles.nextBtn]}
                      loading={loading}
                      disabled={loading}
                      buttonColor="#4361EE"
                    >
                      Sign Up
                    </Button>
                  </View>
                </>
              )}

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                  <Text style={styles.link}>Login</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>

          <Toast
            visible={toast.visible}
            message={toast.message}
            type={toast.type}
            onDismiss={hideToast}
          />
        </KeyboardAvoidingView>

        {/* Success Modal */}
        <Modal
          visible={showSuccessModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleSuccessModalClose}
        >
          <View style={styles.modalOverlay}>
            <Animated.View style={styles.modalContent}>
              <Animated.View
                style={[
                  styles.successIconContainer,
                  {
                    transform: [
                      { scale: successIconScale },
                      {
                        rotate: successIconRotate.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "360deg"],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <MaterialCommunityIcons name="toggle-switch" size={60} color="#FFFFFF" />
              </Animated.View>

              <Text style={styles.successTitle}>Welcome to Switchly!</Text>
              <Text style={styles.successMessage}>
                Hi {userName}! Your account has been created successfully.
              </Text>
              <Text style={styles.successSubMessage}>
                Please login to start controlling your smart devices
              </Text>

              <Button
                mode="contained"
                onPress={handleSuccessModalClose}
                style={styles.successButton}
                buttonColor="#4361EE"
                contentStyle={{ paddingVertical: 8 }}
              >
                Go to Login
              </Button>
            </Animated.View>
          </View>
        </Modal>
      </LinearGradient>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  headerContainer: {
    marginBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
  },
  formContainer: {
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 20,
    padding: 24,
    backdropFilter: "blur(10px)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  activeStepDot: {
    backgroundColor: "#4361EE",
    borderColor: "#4361EE",
    transform: [{ scale: 1.1 }],
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: 10,
    borderRadius: 2,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    marginBottom: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  strengthContainer: {
    marginBottom: 16,
  },
  strengthBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  strengthText: {
    fontSize: 12,
    textAlign: "right",
  },
  button: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 3,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  backBtn: {
    flex: 1,
    marginRight: 8,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  nextBtn: {
    flex: 2,
    marginLeft: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  footerText: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  link: {
    color: "#4CC9F0",
    fontWeight: "bold",
  },
  errorText: {
    color: "#CF6679",
    marginBottom: 10,
    marginLeft: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  successIconContainer: {
    marginBottom: 24,
    backgroundColor: "#4361EE",
    borderRadius: 60,
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4361EE",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#212121",
    marginBottom: 12,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 16,
    color: "#424242",
    marginBottom: 8,
    textAlign: "center",
    lineHeight: 22,
  },
  successSubMessage: {
    fontSize: 14,
    color: "#757575",
    marginBottom: 24,
    textAlign: "center",
  },
  successButton: {
    width: "100%",
    borderRadius: 12,
    elevation: 3,
  },
})

export default SignupScreen
