import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native'
import {
  Text,
  TextInput,
  Button,
  Appbar,
  Card,
  ActivityIndicator,
} from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Colors, Spacing, BorderRadius } from '../config/theme'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SupportChatbotScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: 'Hello! I\'m the Switchly support chatbot. I can help you with questions about:\n\n• Current power consumption\n• Voltage readings\n• Energy usage\n• Cost tracking\n• Device consumption\n\nHow can I assist you today?',
      isBot: true,
      timestamp: new Date(),
    },
  ])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollViewRef = useRef(null)

  // Initialize Gemini AI client
  const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY
  if (!geminiApiKey) {
    console.warn(' GEMINI_API_KEY not found in env variables')
  }
  const genAI = new GoogleGenerativeAI(geminiApiKey || '')
  
  // System prompt with guardrails
  const systemPrompt = `You are a helpful support chatbot for Switchly, a smart switch and energy monitoring app. 

Your role is to ONLY answer questions related to:
- Current power consumption and usage
- Voltage readings and electrical parameters
- Energy consumption tracking
- Cost calculations and electricity bills
- Device power consumption
- Smart switch functionality
- Timer scheduling features
- Energy saving tips related to the app

IMPORTANT RULES:
1. If a user asks about anything NOT related to Switchly app, power, voltage, energy, cost, or device consumption, politely decline and redirect them back to app-related topics.
2. Do NOT answer questions about:
   - General knowledge
   - Other apps or services
   - Personal advice unrelated to energy
   - Topics outside the app's scope
3. Always be helpful and friendly, but stay within the app's context.
4. If unsure if a question is app-related, ask for clarification.

Keep responses concise and helpful (max 100 words).`

  // Default model
  const getModel = (modelName = 'gemini-2.5-flash-lite') => {
    return genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.7,
      },
    })
  }

  // Check if question is app-related
  const isAppRelated = (question) => {
    const appKeywords = [
      'power', 'voltage', 'energy', 'cost', 'consumption', 'electricity',
      'switch', 'device', 'timer', 'schedule', 'watt', 'kwh', 'bill',
      'charging', 'battery', 'safety', 'relay', 'current', 'amperage',
      'switchly', 'app', 'monitoring', 'tracking', 'usage'
    ]
    const lowerQuestion = question.toLowerCase()
    return appKeywords.some(keyword => lowerQuestion.includes(keyword))
  }

  const sendMessage = async () => {
    if (!inputText.trim() || loading) return

    const userMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isBot: false,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setLoading(true)

    // Check if question is app-related
    if (!isAppRelated(userMessage.text)) {
      const botResponse = {
        id: (Date.now() + 1).toString(),
        text: 'I can only help you with questions related to Switchly app, such as:\n\n• Power consumption and voltage\n• Energy usage and cost tracking\n• Device consumption\n• Timer and scheduling features\n• Smart switch functionality\n\nPlease ask me something about the app!',
        isBot: true,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, botResponse])
      setLoading(false)
      return
    }

    try {
      // Updated valid Gemini model chain
      const modelNames = [
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.5-pro'
      ]

      let success = false
      let lastError = null
      
      for (const modelName of modelNames) {
        try {
          const model = getModel(modelName)
          const prompt = userMessage.text
          
          const result = await model.generateContent(prompt)
          const response = await result.response
          const responseText = response.text()

          const botResponse = {
            id: (Date.now() + 1).toString(),
            text: responseText || 'I apologize, but I couldn\'t generate a response. Please try again.',
            isBot: true,
            timestamp: new Date(),
          }

          setMessages(prev => [...prev, botResponse])
          success = true
          break
        } catch (modelError) {
          lastError = modelError
          console.log(`Model ${modelName} failed, trying next...`)
          continue
        }
      }
      
      if (!success) {
        throw lastError || new Error('No available models found. Please check your API key permissions.')
      }
      
    } catch (error) {
      console.error('Gemini API Error:', error)
      const errorMessage = error.message?.includes('404') 
        ? 'Model not found. Please check API key permissions or try again later.'
        : error.message || 'Unknown error occurred'
        
      const errorResponse = {
        id: (Date.now() + 1).toString(),
        text: `Sorry, I encountered an error: ${errorMessage}`,
        isBot: true,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorResponse])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }, [messages])

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#FFFFFF" />
        <Appbar.Content 
          title="Switchly" 
          subtitle="Chatbot Screen"
          titleStyle={styles.headerTitle}
          subtitleStyle={styles.headerSubtitle}
        />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageWrapper,
                message.isBot ? styles.botMessageWrapper : styles.userMessageWrapper,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  message.isBot ? styles.botMessageBubble : styles.userMessageBubble,
                ]}
              >
                {message.isBot && (
                  <MaterialCommunityIcons
                    name="robot"
                    size={18}
                    color={Colors.primary}
                    style={styles.botIcon}
                  />
                )}
                <Text style={[
                  styles.messageText,
                  message.isBot ? styles.botMessageText : styles.userMessageText,
                ]}>
                  {message.text}
                </Text>
              </View>
            </View>
          ))}
          
          {loading && (
            <View style={styles.botMessageWrapper}>
              <View style={[styles.messageBubble, styles.botMessageBubble]}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about power, voltage, energy, cost..."
            mode="outlined"
            multiline
            maxLength={500}
            disabled={loading}
            right={
              <TextInput.Icon
                icon="send"
                onPress={sendMessage}
                disabled={!inputText.trim() || loading}
                color={inputText.trim() && !loading ? Colors.primary : Colors.textLight}
              />
            }
            onSubmitEditing={sendMessage}
          />
        </View>
      </KeyboardAvoidingView>
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
  headerSubtitle: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.9,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  messageWrapper: {
    marginBottom: 12,
    width: '100%',
  },
  botMessageWrapper: {
    alignItems: 'flex-start',
  },
  userMessageWrapper: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  botMessageBubble: {
    backgroundColor: '#F5F5F5',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  userMessageBubble: {
    backgroundColor: Colors.primary,
  },
  botIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  botMessageText: {
    color: '#212121',
    fontWeight: '400',
  },
  userMessageText: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  loadingText: {
    marginLeft: 8,
    color: '#666666',
    fontSize: 14,
  },
  inputContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    backgroundColor: Colors.surface,
  },
})

export default SupportChatbotScreen
