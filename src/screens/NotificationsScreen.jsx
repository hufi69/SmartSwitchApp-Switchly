import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native'
import { Text, Appbar, Button, Chip, Divider } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { auth, realtimeDb } from '../config/firebase'
import { ref, onValue, set, remove } from 'firebase/database'
import { Colors, Spacing, BorderRadius, Typography } from '../config/theme'

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([])
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    // Listen to notifications
    const notificationsRef = ref(realtimeDb, `users/${userId}/notifications`)
    const listener = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const notifArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        
        setNotifications(notifArray)
        setUnreadCount(notifArray.filter(n => !n.read).length)
      } else {
        setNotifications([])
        setUnreadCount(0)
      }
    })

    return () => listener()
  }, [])

  const markAllAsRead = async () => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    try {
      const updates = {}
      notifications.forEach(notif => {
        if (!notif.read) {
          updates[`users/${userId}/notifications/${notif.id}/read`] = true
        }
      })
      
      // Update all in Firebase
      await Promise.all(
        Object.keys(updates).map(path => set(ref(realtimeDb, path), true))
      )
      
      console.log('✅ All notifications marked as read')
    } catch (error) {
      console.error('Error marking notifications as read:', error)
    }
  }

  const deleteAllNotifications = async () => {
    const userId = auth.currentUser?.uid
    if (!userId) return

    try {
      await remove(ref(realtimeDb, `users/${userId}/notifications`))
      console.log('🗑️ All notifications deleted')
    } catch (error) {
      console.error('Error deleting notifications:', error)
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'overvoltage':
      case 'undervoltage':
        return { name: 'alert-circle', color: '#FF6B6B' }
      case 'high_power':
        return { name: 'flash-alert', color: '#FFA500' }
      case 'device_offline':
        return { name: 'wifi-off', color: '#FF6B6B' }
      case 'device_online':
        return { name: 'wifi-check', color: '#4CAF50' }
      case 'timer_complete':
        return { name: 'clock-check', color: Colors.primary }
      default:
        return { name: 'information', color: Colors.primary }
    }
  }

  const getTimeAgo = (timestamp) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now - time
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  const filteredNotifications = showUnreadOnly 
    ? notifications.filter(n => !n.read)
    : notifications

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      {/* Header */}
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#FFFFFF" />
        <Appbar.Content title="Notifications" titleStyle={styles.headerTitle} />
        {notifications.length > 0 && (
          <Appbar.Action 
            icon="delete-sweep" 
            onPress={deleteAllNotifications} 
            color="#FFFFFF" 
          />
        )}
      </Appbar.Header>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <View style={styles.filterButtons}>
          <Chip 
            selected={!showUnreadOnly}
            onPress={() => setShowUnreadOnly(false)}
            style={styles.chip}
            textStyle={styles.chipText}
          >
            All ({notifications.length})
          </Chip>
          <Chip 
            selected={showUnreadOnly}
            onPress={() => setShowUnreadOnly(true)}
            style={styles.chip}
            textStyle={styles.chipText}
          >
            Unread ({unreadCount})
          </Chip>
        </View>
        
        {unreadCount > 0 && (
          <Button 
            mode="text" 
            onPress={markAllAsRead}
            textColor={Colors.primary}
            compact
          >
            Mark all as read
          </Button>
        )}
      </View>

      <Divider />

      {/* Notifications List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif, index) => {
            const icon = getNotificationIcon(notif.type)
            return (
              <React.Fragment key={notif.id}>
                <TouchableOpacity
                  style={[styles.notificationItem, !notif.read && styles.unreadItem]}
                  onPress={async () => {
                    // Mark as read when tapped
                    if (!notif.read) {
                      const userId = auth.currentUser?.uid
                      await set(ref(realtimeDb, `users/${userId}/notifications/${notif.id}/read`), true)
                    }
                  }}
                >
                  <View style={[styles.iconContainer, { backgroundColor: icon.color + '20' }]}>
                    <MaterialCommunityIcons 
                      name={icon.name} 
                      size={24} 
                      color={icon.color} 
                    />
                  </View>
                  
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>{notif.title}</Text>
                    <Text style={styles.notificationBody}>{notif.body}</Text>
                    <Text style={styles.notificationTime}>{getTimeAgo(notif.timestamp)}</Text>
                  </View>
                  
                  {!notif.read && (
                    <View style={styles.unreadDot} />
                  )}
                </TouchableOpacity>
                
                {index < filteredNotifications.length - 1 && <Divider />}
              </React.Fragment>
            )
          })
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons 
              name={showUnreadOnly ? "check-all" : "bell-off-outline"} 
              size={64} 
              color={Colors.textLight} 
            />
            <Text style={styles.emptyTitle}>
              {showUnreadOnly ? 'All caught up!' : 'No notifications'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {showUnreadOnly 
                ? "You don't have any unread notifications"
                : "You'll see notifications here when events occur"}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    elevation: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    marginRight: Spacing.xs,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    alignItems: 'flex-start',
  },
  unreadItem: {
    backgroundColor: '#F0F4FF',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.textLight,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginLeft: Spacing.sm,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
  },
})

export default NotificationsScreen

