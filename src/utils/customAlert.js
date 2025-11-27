import { Alert } from 'react-native'

// This will be used as a fallback for now
// We'll replace all alert() calls with CustomAlert component usage

export const showCustomAlert = (message, options = {}) => {
  const {
    title = "Switchly",
    type = "info",
    showCancel = false,
    confirmText = "OK",
    cancelText = "Cancel",
    onConfirm,
    onCancel
  } = options

  // For now, we'll use the native alert but with better styling
  // In the actual implementation, this will be replaced with CustomAlert component
  Alert.alert(title, message, [
    ...(showCancel ? [{
      text: cancelText,
      style: 'cancel',
      onPress: onCancel
    }] : []),
    {
      text: confirmText,
      style: type === 'error' ? 'destructive' : 'default',
      onPress: onConfirm
    }
  ])
}

export const showSuccessAlert = (message, options = {}) => {
  showCustomAlert(message, { ...options, type: 'success' })
}

export const showErrorAlert = (message, options = {}) => {
  showCustomAlert(message, { ...options, type: 'error' })
}

export const showWarningAlert = (message, options = {}) => {
  showCustomAlert(message, { ...options, type: 'warning' })
}

export const showConfirmAlert = (message, onConfirm, options = {}) => {
  showCustomAlert(message, {
    ...options,
    showCancel: true,
    onConfirm,
    confirmText: 'Yes',
    cancelText: 'No'
  })
}
