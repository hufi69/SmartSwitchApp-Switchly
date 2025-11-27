import React from 'react'
import { View, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native'
import { Text, Card, Button, IconButton } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'

const { width } = Dimensions.get('window')

const CustomAlert = ({ 
  visible, 
  onDismiss, 
  title = "Switchly", 
  message, 
  type = "info", // info, success, warning, error
  showCancel = false,
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel
}) => {
  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return { icon: 'check-circle', color: '#4CAF50' }
      case 'warning':
        return { icon: 'alert-circle', color: '#FF9800' }
      case 'error':
        return { icon: 'close-circle', color: '#F44336' }
      default:
        return { icon: 'information', color: '#4361EE' }
    }
  }

  const { icon, color } = getIconAndColor()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Card style={styles.alertCard}>
          <Card.Content style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons 
                  name={icon} 
                  size={32} 
                  color={color} 
                />
              </View>
              <Text style={styles.title}>{title}</Text>
            </View>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {showCancel && (
                <Button
                  mode="outlined"
                  onPress={onCancel || onDismiss}
                  style={[styles.button, styles.cancelButton]}
                  labelStyle={styles.cancelButtonText}
                >
                  {cancelText}
                </Button>
              )}
              <Button
                mode="contained"
                onPress={onConfirm || onDismiss}
                style={[styles.button, styles.confirmButton]}
                buttonColor={color}
                labelStyle={styles.confirmButtonText}
              >
                {confirmText}
              </Button>
            </View>
          </Card.Content>
        </Card>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertCard: {
    width: width * 0.85,
    maxWidth: 400,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
  },
  message: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'left',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    minWidth: 80,
  },
  cancelButton: {
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '500',
  },
  confirmButton: {
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
})

export default CustomAlert
