import React, { useState, useEffect } from "react"
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Image } from "react-native"
import { Text, Avatar, Button, Divider, List, TextInput, ActivityIndicator } from "react-native-paper"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { auth, realtimeDb } from "../config/firebase"
import { ref, set, onValue } from "firebase/database"
import { clearUserCredentials } from "../utils/storage"
import { signOut, updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from "firebase/auth"
import CustomAlert from "../components/CustomAlert"

const ProfileScreen = ({ navigation, setIsAuthenticated }) => {
  const [user, setUser] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [updating, setUpdating] = useState(false)
  const [userMetadata, setUserMetadata] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [sendingResetEmail, setSendingResetEmail] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = () => {
    // Get current user from Firebase
    const currentUser = auth.currentUser
    if (currentUser) {
      const userData = {
        name: currentUser.displayName || "User",
        email: currentUser.email,
        photoURL: currentUser.photoURL,
      }
      setUser(userData)
      setNewName(userData.name)
      
   
      setUserMetadata({
        uid: currentUser.uid,
        createdAt: currentUser.metadata.creationTime,
        lastSignIn: currentUser.metadata.lastSignInTime,
        emailVerified: currentUser.emailVerified,
      })

  
      const userId = currentUser.uid
      const userProfileRef = ref(realtimeDb, `users/${userId}/userProfile`)
      set(userProfileRef, {
        name: currentUser.displayName || "User",
        email: currentUser.email,
        uid: currentUser.uid,
        createdAt: currentUser.metadata.creationTime,
        lastSignIn: currentUser.metadata.lastSignInTime,
      }).catch(err => console.error('Error saving user profile:', err))

    
      const profilePicRef = ref(realtimeDb, `users/${userId}/profilePicture`)
      onValue(profilePicRef, (snapshot) => {
        const base64Image = snapshot.val()
        if (base64Image) {
          setUser(prev => ({ ...prev, photoURL: base64Image }))
        }
      })
    }
  }

  const handleEditProfile = () => {
    setSelectedImage(user?.photoURL)
    setShowEditModal(true)
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert("Error", "Please fill in all fields")
      return
    }

    if (newPassword.length < 8) {
      Alert.alert("Error", "New password must be at least 8 characters")
      return
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert("Error", "New passwords do not match")
      return
    }

    setChangingPassword(true)
    try {
      const currentUser = auth.currentUser
      const email = currentUser?.email

      if (!email) {
        throw new Error("No email found")
      }

      // Reauthenticate user with current password
      const credential = EmailAuthProvider.credential(email, currentPassword)
      await reauthenticateWithCredential(currentUser, credential)

      // Update to new password
      await updatePassword(currentUser, newPassword)

      // Clear fields and close modal
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
      setShowChangePasswordModal(false)

      Alert.alert("Success", "Password changed successfully!")
    } catch (error) {
      console.error("Change password error:", error)
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        Alert.alert("Error", "Current password is incorrect")
      } else {
        Alert.alert("Error", "Failed to change password. Please try again.")
      }
    } finally {
      setChangingPassword(false)
    }
  }

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos to upload a profile picture.')
        return
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      })

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri
        
        // Show loading
        setUploadingImage(true)
        
        try {
          // Upload to Firebase Storage
          const uploadedUrl = await uploadImageToFirebase(imageUri)
          setSelectedImage(uploadedUrl)
          setUploadingImage(false)
          
          console.log('✅ Image uploaded to Firebase Storage')
        } catch (uploadError) {
          console.error('Error uploading to Firebase:', uploadError)
          setUploadingImage(false)
          Alert.alert('Upload Error', 'Failed to upload image. Please try again.')
        }
      }
    } catch (error) {
      console.error('Error picking image:', error)
      setUploadingImage(false)
      Alert.alert('Error', 'Failed to pick image')
    }
  }

  const uploadImageToFirebase = async (imageUri) => {
    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('No user ID')

      // Convert image to base64
      console.log('📤 Converting image to base64...')
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      // Add data URI prefix
      const base64Image = `data:image/jpeg;base64,${base64}`
      
      // Save to Realtime Database
      console.log('💾 Saving to Realtime Database...')
      const profilePicRef = ref(realtimeDb, `users/${userId}/profilePicture`)
      await set(profilePicRef, base64Image)

      console.log('✅ Profile picture saved to Firebase!')
      return base64Image
    } catch (error) {
      console.error('Firebase save error:', error)
      throw error
    }
  }

  const handleSaveProfile = async () => {
    if (!newName.trim()) {
      Alert.alert("Error", "Name cannot be empty")
      return
    }

    setUpdating(true)
    try {
      const currentUser = auth.currentUser
      if (currentUser) {
        // Update display name in Firebase Auth
        await updateProfile(currentUser, {
          displayName: newName.trim(),
        })

 
        const userId = currentUser.uid
        const userProfileRef = ref(realtimeDb, `users/${userId}/userProfile`)
        await set(userProfileRef, {
          name: newName.trim(),
          email: currentUser.email,
          uid: userId,
          createdAt: currentUser.metadata.creationTime,
          lastSignIn: currentUser.metadata.lastSignInTime,
          lastUpdated: new Date().toISOString(),
        })

      
        loadUserData()
        setShowEditModal(false)
        Alert.alert("Success", "Profile updated successfully!")
      }
    } catch (error) {
      console.error("Update profile error:", error)
      Alert.alert("Error", "Failed to update profile. Please try again.")
    } finally {
      setUpdating(false)
    }
  }

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear saved credentials
              await clearUserCredentials()
              // Sign out from Firebase
              await signOut(auth)
              console.log("User logged out successfully")
              // Set authentication to false to show login screen
              if (setIsAuthenticated) {
                setIsAuthenticated(false)
              }
            } catch (error) {
              console.error("Logout error:", error)
              Alert.alert("Error", "Failed to logout. Please try again.")
            }
          },
        },
      ],
      { cancelable: true }
    )
  }

  const getInitials = (name) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {user?.photoURL ? (
              <Avatar.Image size={100} source={{ uri: user.photoURL }} />
            ) : (
              <Avatar.Text size={100} label={getInitials(user?.name)} style={styles.avatar} />
            )}
          </View>

          <Text style={styles.userName}>{user?.name || "User"}</Text>
          <Text style={styles.userEmail}>{user?.email || "email@example.com"}</Text>

          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <MaterialCommunityIcons name="pencil" size={16} color="#4361EE" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>

          <List.Item
            title="Personal Information"
            description="View your account details"
            left={(props) => <List.Icon {...props} icon="account" color="#4361EE" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setShowInfoModal(true)}
            style={styles.listItem}
          />

          <Divider />

          <List.Item
            title="Change Password"
            description="Update your password"
            left={(props) => <List.Icon {...props} icon="lock" color="#4361EE" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setShowChangePasswordModal(true)}
            style={styles.listItem}
          />

          <Divider />

          <List.Item
            title="Reset Password"
            description="Send password reset email"
            left={(props) => <List.Icon {...props} icon="lock-reset" color="#4361EE" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => setShowResetConfirm(true)}
            style={styles.listItem}
          />

          <Divider />

          {/* <List.Item
            title="Notifications"
            description="Manage notifications"
            left={(props) => <List.Icon {...props} icon="bell" color="#4361EE" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {}}
            style={styles.listItem}
          /> */}
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>

          <List.Item
            title="Privacy & Security"
            description="Manage your privacy"
            left={(props) => <List.Icon {...props} icon="shield-check" color="#4361EE" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => navigation.navigate("Settings")}
            style={styles.listItem}
          />
          
          <Divider />
          
          <List.Item
            title="Smart Charging"
            description="Battery-based charging optimizer"
            left={(props) => <List.Icon {...props} icon="battery-charging-80" color="#4361EE" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => navigation.navigate("SmartCharging")}
            style={styles.listItem}
          />

          <Divider />

          <List.Item
            title="Help & Support"
            description="Get help and support"
            left={(props) => <List.Icon {...props} icon="help-circle" color="#4361EE" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {}}
            style={styles.listItem}
          />

          <Divider />

          <List.Item
            title="About"
            description="App version 1.0.0"
            left={(props) => <List.Icon {...props} icon="information" color="#4361EE" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {}}
            style={styles.listItem}
          />
        </View>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <Button
            mode="contained"
            onPress={handleLogout}
            style={styles.logoutButton}
            buttonColor="#F44336"
            icon="logout"
            contentStyle={{ paddingVertical: 8 }}
          >
            Logout
          </Button>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Personal Information Modal */}
      <Modal
        visible={showInfoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Personal Information</Text>
              <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#212121" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.infoContainer}>
              {/* Avatar / Profile Picture */}
              <View style={styles.infoAvatarContainer}>
                {user?.photoURL ? (
                  <Image 
                    source={{ uri: user.photoURL }} 
                    style={styles.profileImage}
                  />
                ) : (
                  <Avatar.Text
                    size={80}
                    label={getInitials(user?.name)}
                    style={styles.infoAvatar}
                  />
                )}
              </View>

              {/* Full Name */}
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="account" size={22} color="#4361EE" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Full Name</Text>
                  <Text style={styles.infoValue}>{user?.name || 'Not set'}</Text>
                </View>
              </View>

              {/* Email */}
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="email" size={22} color="#4361EE" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Email Address</Text>
                  <Text style={styles.infoValue}>{user?.email || 'Not set'}</Text>
                </View>
              </View>

              {/* Date Joined */}
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="calendar-check" size={22} color="#4361EE" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Date Joined</Text>
                  <Text style={styles.infoValue}>
                    {userMetadata?.createdAt 
                      ? new Date(userMetadata.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'Unknown'}
                  </Text>
                </View>
              </View>

              {/* Last Sign In */}
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="login" size={22} color="#4361EE" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Last Sign In</Text>
                  <Text style={styles.infoValue}>
                    {userMetadata?.lastSignIn 
                      ? new Date(userMetadata.lastSignIn).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })
                      : 'Unknown'}
                  </Text>
                </View>
              </View>

              {/* User ID */}
              <View style={[styles.infoItem, { borderBottomWidth: 0 }]}>
                <MaterialCommunityIcons name="identifier" size={22} color="#4361EE" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>User ID</Text>
                  <Text style={styles.infoValueSmall} numberOfLines={1} ellipsizeMode="middle">
                    {userMetadata?.uid || 'Unknown'}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                mode="contained"
                onPress={() => setShowInfoModal(false)}
                style={styles.closeModalButton}
                buttonColor="#4361EE"
              >
                Close
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Password Confirmation */}
      <CustomAlert
        visible={showResetConfirm}
        onDismiss={() => setShowResetConfirm(false)}
        title="Reset Password"
        message={`Send password reset email to:\n\n${user?.email}\n\nYou'll receive an email with instructions to reset your password.`}
        type="info"
        showCancel={true}
        confirmText={sendingResetEmail ? "Sending..." : "Send Email"}
        cancelText="Cancel"
        onConfirm={async () => {
          const email = auth.currentUser?.email
          if (!email) {
            Alert.alert('Error', 'No email found')
            return
          }

          setSendingResetEmail(true)
          try {
            await sendPasswordResetEmail(auth, email)
            setShowResetConfirm(false)
            setSendingResetEmail(false)
            
            // Show success alert
            setTimeout(() => {
              Alert.alert(
                ' Email Sent!',
                `Password reset email sent to ${email}\n\nCheck your inbox and follow the instructions to reset your password.`,
                [{ text: 'OK' }]
              )
            }, 300)
          } catch (error) {
            console.error('Error sending reset email:', error)
            setSendingResetEmail(false)
            setShowResetConfirm(false)
            
            setTimeout(() => {
              Alert.alert('Error', 'Failed to send password reset email. Please try again.')
            }, 300)
          }
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowChangePasswordModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#212121" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                label="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                mode="outlined"
                secureTextEntry={!showCurrentPassword}
                right={
                  <TextInput.Icon 
                    icon={showCurrentPassword ? "eye-off" : "eye"} 
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  />
                }
                style={styles.modalInput}
                activeOutlineColor="#4361EE"
                left={<TextInput.Icon icon="lock" />}
              />

              <TextInput
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                mode="outlined"
                secureTextEntry={!showNewPassword}
                right={
                  <TextInput.Icon 
                    icon={showNewPassword ? "eye-off" : "eye"} 
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  />
                }
                style={styles.modalInput}
                activeOutlineColor="#4361EE"
                left={<TextInput.Icon icon="lock-plus" />}
              />

              <TextInput
                label="Confirm New Password"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                mode="outlined"
                secureTextEntry={!showConfirmPassword}
                right={
                  <TextInput.Icon 
                    icon={showConfirmPassword ? "eye-off" : "eye"} 
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                }
                style={styles.modalInput}
                activeOutlineColor="#4361EE"
                left={<TextInput.Icon icon="lock-check" />}
              />

              <Text style={styles.modalHint}>
                Password must be at least 8 characters long
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <Button
                mode="outlined"
                onPress={() => {
                  setCurrentPassword("")
                  setNewPassword("")
                  setConfirmNewPassword("")
                  setShowChangePasswordModal(false)
                }}
                style={styles.modalCancelButton}
                textColor="#757575"
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleChangePassword}
                style={styles.modalSaveButton}
                buttonColor="#4361EE"
                loading={changingPassword}
                disabled={changingPassword}
              >
                Save Changes
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#212121" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Profile Picture Upload */}
              <View style={styles.profilePictureSection}>
                {selectedImage ? (
                  <Image 
                    source={{ uri: selectedImage }} 
                    style={styles.profileImage}
                  />
                ) : (
                  <Avatar.Text
                    size={80}
                    label={getInitials(newName || user?.name)}
                    style={styles.editAvatar}
                  />
                )}
                <TouchableOpacity 
                  style={styles.changePictureButton}
                  onPress={pickImage}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="#4361EE" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="camera" size={20} color="#4361EE" />
                      <Text style={styles.changePictureText}>Change Picture</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TextInput
                label="Name"
                value={newName}
                onChangeText={setNewName}
                mode="outlined"
                style={styles.modalInput}
                activeOutlineColor="#4361EE"
                left={<TextInput.Icon icon="account" />}
              />

              <Text style={styles.modalHint}>
                This name will be displayed on your profile
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <Button
                mode="outlined"
                onPress={() => setShowEditModal(false)}
                style={styles.modalCancelButton}
                textColor="#757575"
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveProfile}
                style={styles.modalSaveButton}
                buttonColor="#4361EE"
                loading={updating}
                disabled={updating}
              >
                Save
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#212121",
  },
  content: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: "#4361EE",
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#212121",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#757575",
    marginBottom: 16,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4361EE",
  },
  editButtonText: {
    fontSize: 14,
    color: "#4361EE",
    fontWeight: "600",
    marginLeft: 4,
  },
  section: {
    backgroundColor: "#FFFFFF",
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#212121",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F5F5F5",
  },
  listItem: {
    backgroundColor: "#FFFFFF",
  },
  logoutContainer: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  logoutButton: {
    borderRadius: 12,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#212121",
  },
  modalBody: {
    padding: 20,
  },
  modalInput: {
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 12,
    color: "#757575",
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  modalCancelButton: {
    flex: 1,
    marginRight: 8,
    borderColor: "#E0E0E0",
  },
  modalSaveButton: {
    flex: 1,
    marginLeft: 8,
  },
  infoContainer: {
    marginVertical: 20,
  },
  infoAvatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  infoAvatar: {
    backgroundColor: '#4361EE',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: '#212121',
    fontWeight: '500',
  },
  infoValueSmall: {
    fontSize: 13,
    color: '#212121',
    fontWeight: '400',
  },
  profilePictureSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  editAvatar: {
    backgroundColor: '#4361EE',
    marginBottom: 12,
  },
  changePictureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4361EE',
    backgroundColor: '#FFFFFF',
  },
  changePictureText: {
    fontSize: 14,
    color: '#4361EE',
    fontWeight: '600',
    marginLeft: 6,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  profileImageDisplay: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
})

export default ProfileScreen
