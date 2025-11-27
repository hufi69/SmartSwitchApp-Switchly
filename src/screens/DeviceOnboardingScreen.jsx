import React, { useState, useRef } from "react"
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
  ImageBackground,
} from "react-native"
import { TextInput, Button, Text, Snackbar, Card, ProgressBar } from "react-native-paper"
import { useForm, Controller } from "react-hook-form"
import { LinearGradient } from "expo-linear-gradient"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import LottieView from "lottie-react-native"

const { width, height } = Dimensions.get("window")

const DeviceOnboardingScreen = ({ navigation, setHasDevice }) => {
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState("")
  const [visible, setVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [connectionProgress, setConnectionProgress] = useState(0)
  const [isConnected, setIsConnected] = useState(false)

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current
  const lottieRef = useRef(null)

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
    formState: { errors },
  } = useForm({
    defaultValues: {
      deviceId: "",
    },
  })

  const onSubmit = (data) => {
    setVerifying(true)
   
    setTimeout(() => {
      setVerifying(false)
      if (data.deviceId === "SS-1234-ABCD" || data.deviceId === "123456") {
        setCurrentStep(2)
        startConnectionAnimation()
      } else {
        setError("Invalid device ID. Please check and try again.")
        setVisible(true)
      }
    }, 2000)
  }

  const startConnectionAnimation = () => {
    setLoading(true)

    // Simulate connection progress
    let progress = 0
    const interval = setInterval(() => {
      progress += 0.1
      setConnectionProgress(progress)

      if (progress >= 1) {
        clearInterval(interval)
        setIsConnected(true)
        lottieRef.current?.play()

        // Redirect after showing success message
        setTimeout(() => {
          setHasDevice(true)
        }, 2000)
      }
    }, 300)
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
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, currentStep >= 1 && styles.activeStepDot]} />
                <View style={styles.stepLine} />
                <View style={[styles.stepDot, currentStep >= 2 && styles.activeStepDot]} />
              </View>

              <View style={styles.logoCircle}>
                <MaterialCommunityIcons name="devices" size={48} color="#4361EE" />
              </View>
              <Text style={styles.title}>Connect Your Device</Text>
              <Text style={styles.subtitle}>
                {currentStep === 1
                  ? "Enter your Switchly device ID to connect it to your account"
                  : "Connecting to your Switchly device"}
              </Text>
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
              {currentStep === 1 ? (
                <>
                  <Card style={styles.infoCard}>
                    <Card.Content>
                      <Text style={styles.infoTitle}>Where to find your Device ID:</Text>
                      <View style={styles.infoItem}>
                        <MaterialCommunityIcons name="numeric-1-circle" size={24} color="#4361EE" />
                        <Text style={styles.infoText}>Look at the back of your Switchly device</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <MaterialCommunityIcons name="numeric-2-circle" size={24} color="#4361EE" />
                        <Text style={styles.infoText}>Find the label with "Device ID" or "ID"</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <MaterialCommunityIcons name="numeric-3-circle" size={24} color="#4361EE" />
                        <Text style={styles.infoText}>Enter the code in the format SS-XXXX-XXXX</Text>
                      </View>
                    </Card.Content>
                  </Card>

                  <Controller
                    control={control}
                    rules={{
                      required: "Device ID is required",
                      pattern: {
                        value: /^(SS-[0-9A-Z]{4}-[0-9A-Z]{4}|[0-9]{6})$/,
                        message: "Invalid device ID format. Should be like SS-1234-ABCD or 123456",
                      },
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        label="Device ID"
                        mode="outlined"
                        left={<TextInput.Icon icon="barcode-scan" />}
                        style={styles.input}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        placeholder="SS-1234-ABCD"
                        error={!!errors.deviceId}
                        outlineColor="rgba(255,255,255,0.3)"
                        activeOutlineColor="#4361EE"
                        textColor="#FFFFFF"
                        theme={{ colors: { onSurfaceVariant: "#FFFFFF" } }}
                        disabled={verifying}
                      />
                    )}
                    name="deviceId"
                  />
                  {errors.deviceId && <Text style={styles.errorText}>{errors.deviceId.message}</Text>}

                  <View style={styles.buttonContainer}>
                    <Button mode="text" icon="qrcode-scan" textColor="#4CC9F0" style={styles.scanButton}>
                      Scan QR Code
                    </Button>

                    <Button
                      mode="contained"
                      onPress={handleSubmit(onSubmit)}
                      style={styles.button}
                      loading={verifying}
                      disabled={verifying}
                      buttonColor="#4361EE"
                    >
                      {verifying ? "Verifying..." : "Connect Device"}
                    </Button>
                  </View>
                </>
              ) : (
                <View style={styles.connectionContainer}>
                  {!isConnected ? (
                    <>
                      <Text style={styles.connectionText}>Connecting to your Switchly device...</Text>
                      <ProgressBar progress={connectionProgress} color="#4361EE" style={styles.progressBar} />
                      <View style={styles.connectionSteps}>
                        <Text style={[styles.connectionStep, connectionProgress >= 0.3 && styles.completedStep]}>
                          Authenticating device...
                        </Text>
                        <Text style={[styles.connectionStep, connectionProgress >= 0.6 && styles.completedStep]}>
                          Establishing secure connection...
                        </Text>
                        <Text style={[styles.connectionStep, connectionProgress >= 0.9 && styles.completedStep]}>
                          Syncing device data...
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <LottieView
                        ref={lottieRef}
                        source={require("../../assets/success-animation.json")}
                        style={styles.lottieAnimation}
                        autoPlay={false}
                        loop={false}
                      />
                      <Text style={styles.successText}>Device Connected Successfully!</Text>
                      <Text style={styles.redirectText}>Redirecting to dashboard...</Text>
                    </>
                  )}
                </View>
              )}
            </Animated.View>
          </ScrollView>

          <Snackbar
            visible={visible}
            onDismiss={() => setVisible(false)}
            duration={3000}
            style={styles.snackbar}
            action={{
              label: "Close",
              onPress: () => setVisible(false),
            }}
          >
            {error}
          </Snackbar>
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
  headerContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    width: "50%",
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  activeStepDot: {
    backgroundColor: "#4361EE",
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: 8,
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
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  formContainer: {
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 16,
    padding: 20,
    backdropFilter: "blur(10px)",
  },
  infoCard: {
    backgroundColor: "rgba(67, 97, 238, 0.1)",
    marginBottom: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 15,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoText: {
    color: "rgba(255, 255, 255, 0.8)",
    marginLeft: 10,
    flex: 1,
  },
  input: {
    marginBottom: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  buttonContainer: {
    marginTop: 10,
  },
  scanButton: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  button: {
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectionContainer: {
    alignItems: "center",
    padding: 20,
  },
  connectionText: {
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 20,
    textAlign: "center",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    width: "100%",
    marginBottom: 20,
  },
  connectionSteps: {
    width: "100%",
    alignItems: "flex-start",
  },
  connectionStep: {
    color: "rgba(255, 255, 255, 0.6)",
    marginBottom: 12,
    fontSize: 14,
  },
  completedStep: {
    color: "#4CC9F0",
  },
  lottieAnimation: {
    width: 150,
    height: 150,
  },
  successText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#4CAF50",
    marginTop: 20,
    marginBottom: 10,
  },
  redirectText: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
  },
  errorText: {
    color: "#CF6679",
    marginBottom: 10,
    marginLeft: 5,
  },
  snackbar: {
    marginBottom: 20,
  },
})

export default DeviceOnboardingScreen
