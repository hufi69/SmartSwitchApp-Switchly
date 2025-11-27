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
} from "react-native"
import { TextInput, Button, Text, Checkbox } from "react-native-paper"
import { useForm, Controller } from "react-hook-form"
import { LinearGradient } from "expo-linear-gradient"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"
import { auth } from "../config/firebase"
import Toast from "../components/Toast"
import { saveUserCredentials, getSavedCredentials } from "../utils/storage"

const { width, height } = Dimensions.get("window")

const LoginScreen = ({ navigation, setIsAuthenticated }) => {
  const [secureTextEntry, setSecureTextEntry] = useState(true)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: "", type: "error" })
  const [rememberMe, setRememberMe] = useState(false)
  const [forgotPasswordModal, setForgotPasswordModal] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetLoading, setResetLoading] = useState(false)

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current
  const logoRotate = useRef(new Animated.Value(0)).current
  const logoPulse = useRef(new Animated.Value(1)).current

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

    // Logo rotation animation (continuous loop)
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start()

    // Logo pulse animation (continuous loop)
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const showToast = (message, type = "error") => {
    setToast({ visible: true, message, type })
  }

  const hideToast = () => {
    setToast({ visible: false, message: "", type: "error" })
  }

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      // Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password)
      const user = userCredential.user
      console.log("User logged in:", user.email)

      // Save credentials if Remember Me is checked
      await saveUserCredentials(data.email, data.password, rememberMe)

      setLoading(false)
      showToast("Login successful! Welcome back", "success")
      setTimeout(() => {
        setIsAuthenticated(true)
      }, 1000)
    } catch (error) {
      setLoading(false)
      let errorMessage = "Login failed. Please try again."

      // Handle specific Firebase errors
      switch (error.code) {
        case "auth/invalid-email":
          errorMessage = "Invalid email address"
          break
        case "auth/user-disabled":
          errorMessage = "This account has been disabled"
          break
        case "auth/user-not-found":
          errorMessage = "No account found with this email"
          break
        case "auth/wrong-password":
          errorMessage = "Incorrect password"
          break
        case "auth/invalid-credential":
          errorMessage = "Invalid email or password"
          break
        case "auth/too-many-requests":
          errorMessage = "Too many failed attempts. Please try again later"
          break
        default:
          errorMessage = error.message
      }

      showToast(errorMessage, "error")
    }
  }

  // Handle Forgot Password - 
  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      showToast("Please enter your email address", "error")
      return
    }

    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
    if (!emailRegex.test(resetEmail)) {
      showToast("Please enter a valid email address", "error")
      return
    }

    setResetLoading(true)
    try {
      // Use Firebase's sendPasswordResetEmail 
      await sendPasswordResetEmail(auth, resetEmail)
      
      showToast(`Password reset email sent to ${resetEmail}`, "success")
      setForgotPasswordModal(false)
      setResetEmail("")
      
    } catch (error) {
      console.error("Error sending reset email:", error)
      let errorMessage = "Failed to send password reset email. Please try again."
      
      // Handle specific Firebase errors
      switch (error.code) {
        case "auth/user-not-found":
          errorMessage = "No account found with this email address"
          break
        case "auth/invalid-email":
          errorMessage = "Invalid email address"
          break
        case "auth/too-many-requests":
          errorMessage = "Too many requests. Please try again later"
          break
        default:
          errorMessage = error.message || errorMessage
      }
      
      showToast(errorMessage, "error")
    } finally {
      setResetLoading(false)
    }
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
                styles.logoContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.logoCircle,
                  {
                    transform: [
                      { scale: logoPulse },
                      {
                        rotate: logoRotate.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "360deg"],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <MaterialCommunityIcons name="toggle-switch" size={48} color="#4361EE" />
              </Animated.View>
              <Text style={styles.title}>Switchly</Text>
              <Text style={styles.subtitle}>Control your devices, anywhere</Text>
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
              <Controller
                control={control}
                rules={{
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address",
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

              <Controller
                control={control}
                rules={{
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
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
                    value={value}
                    secureTextEntry={secureTextEntry}
                    error={!!errors.password}
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

              <View style={styles.rememberMeContainer}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <Checkbox
                    status={rememberMe ? "checked" : "unchecked"}
                    onPress={() => setRememberMe(!rememberMe)}
                    color="#4361EE"
                    uncheckedColor="rgba(255,255,255,0.6)"
                  />
                  <Text style={styles.rememberMeText}>Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.forgotPassword}
                  onPress={() => setForgotPasswordModal(true)}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <Button
                mode="contained"
                onPress={handleSubmit(onSubmit)}
                style={styles.button}
                loading={loading}
                disabled={loading}
                buttonColor="#4361EE"
              >
                Login
              </Button>


              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
                  <Text style={styles.link}>Sign up</Text>
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

          {/* Forgot Password Modal */}
          {forgotPasswordModal && (
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Reset Password</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setForgotPasswordModal(false)
                      setResetEmail("")
                    }}
                  >
                    <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalSubtitle}>
                  Enter your email address and we'll send you a verification code.
                </Text>

                <TextInput
                  label="Email"
                  placeholder="Enter your email"
                  mode="outlined"
                  left={<TextInput.Icon icon="email" />}
                  style={styles.modalInput}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
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

                <View style={styles.modalButtons}>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      setForgotPasswordModal(false)
                      setResetEmail("")
                    }}
                    style={[styles.modalButton, styles.cancelButton]}
                    textColor="#FFFFFF"
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleForgotPassword}
                    style={[styles.modalButton, styles.sendButton]}
                    loading={resetLoading}
                    disabled={resetLoading}
                    buttonColor="#4361EE"
                  >
                    Send Code
                  </Button>
                </View>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
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
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
  input: {
    marginBottom: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  rememberMeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rememberMeText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    marginLeft: 4,
  },
  forgotPassword: {
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: "#4CC9F0",
    fontSize: 14,
  },
  button: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 3,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContainer: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    marginBottom: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 8,
  },
  cancelButton: {
    borderColor: "rgba(255,255,255,0.3)",
  },
  sendButton: {
    elevation: 3,
  },
})

export default LoginScreen
