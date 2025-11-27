"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Send, Plus, MessageCircle, Sparkles, Trash2, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { UserButton, SignInButton, useUser } from "@clerk/nextjs"

// --- INTERFACE DEFINITIONS ---
interface Message {
  role: "user" | "assistant"
  content: string
}

interface ChatSession {
  id: string
  title: string
  mood: string
  lastMessage: string
  timestamp: number
}

// --- CONSTANTS ---
const MOODS = [
  { name: "Excited", emoji: "🔥", color: "border-red-500", greeting: "YAY! Let's crush today! 🔥" },
  { name: "Chill", emoji: "😎", color: "border-blue-500", greeting: "Perfect calm vibes. What's up? 😎" },
  { name: "Focused", emoji: "🎯", color: "border-purple-500", greeting: "Locked in. Let's get productive. 🎯" },
  { name: "Tired", emoji: "😴", color: "border-gray-500", greeting: "Take it easy. I'm right here for you. 😴" },
  { name: "Curious", emoji: "🤔", color: "border-green-500", greeting: "Ooh, I love curiosity! Ask me anything! 🤔" }
]

const USER_ID_STORAGE_KEY = "comfy_user_id"

// --- UTILITIES ---
const generateUserId = () => `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export default function Home() {

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("DEBUG: sending to /api/upload/");

    console.log("DEBUG: handleFileUpload called");
    console.log("DEBUG: file list:", e.target.files);
    const file = e.target.files?.[0];
    if (!file) return;
  
    // Temporary feedback message
    updateMessages(prev => [
      ...prev,
      { role: "assistant", content: `📄 Uploading **${file.name}**...` }
    ]);
  
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", user?.id || userId);
  
    try {
      const res = await fetch("/api/upload/", {
        method: "POST",
        body: formData,
      });
  
      const data = await res.json();
  
      updateMessages(prev => [
        ...prev,
        { role: "assistant", content: data.message }
      ]);
    } catch (err) {
      console.error("Upload failed:", err);
      updateMessages(prev => [
        ...prev,
        { role: "assistant", content: "❌ Upload failed. Try again!" }
      ]);
    }
  };
  
  // Clerk user
  const { user } = useUser()

  // --- STATE ---
  const [messages, setMessages] = useState<Message[]>([])
  const messagesRef = useRef<Message[]>(messages) // keep stable reference for streaming
  const updateMessages = (next: (prev: Message[]) => Message[]) => {
    setMessages(prev => {
      const newState = next(prev)
      messagesRef.current = newState
      return newState
    })
  }

  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [chats, setChats] = useState<ChatSession[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>("")
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isSending, setIsSending] = useState(false)

  // --- REFS ---
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortControllers = useRef<Record<string, AbortController>>({})

  // keep messagesRef in sync with state
  useEffect(() => { messagesRef.current = messages }, [messages])

  // --- SMOOTH SCROLL: scroll to bottom if near bottom ---
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollTop, clientHeight, scrollHeight } = el
    if (scrollHeight - scrollTop - clientHeight < 100) {
      el.scrollTo({ top: scrollHeight, behavior: "smooth" })
    }
  }, [messages, isTyping])

  // === LOAD CHAT HISTORY helper ===
  const loadChatHistory = useCallback(async (uid: string) => {
    if (!uid) return
    setIsLoadingHistory(true)
    const controller = new AbortController()
    abortControllers.current.loadHistory = controller

    try {
      const res = await fetch(`/api/history?${new URLSearchParams({ userId: uid })}`, {
        signal: controller.signal
      })
      if (!res.ok) throw new Error(`Failed to load history: ${res.status}`)
      const data = await res.json()
      setChats(data.sessions || [])
    } catch (err) {
      if ((err as any).name === 'AbortError') return
      console.error("Failed to load history:", err)
    } finally {
      setIsLoadingHistory(false)
      delete abortControllers.current.loadHistory
    }
  }, [])

  // === Load / initialize userId and watch Clerk user ===
  useEffect(() => {
    // If Clerk provides a user, prefer that user id (persisted server-side)
    if (user?.id) {
      setUserId(user.id)
      // load history for authenticated user
      void loadChatHistory(user.id)
      return
    }

    // Else fallback to guest/localStorage id
    let id = localStorage.getItem(USER_ID_STORAGE_KEY)
    if (!id) {
      id = generateUserId()
      try { localStorage.setItem(USER_ID_STORAGE_KEY, id) } catch (e) { /* ignore */ }
    }
    setUserId(id)
    void loadChatHistory(id)

    return () => {
      // abort outstanding requests on unmount
      Object.values(abortControllers.current).forEach(c => c.abort())
    }
  }, [user, loadChatHistory])

  // === LOAD SPECIFIC CHAT ===
  const loadChat = useCallback(async (chat: ChatSession) => {
    if (currentChatId === chat.id) return
    setIsLoadingHistory(true)
    const controller = new AbortController()
    abortControllers.current[`load_${chat.id}`] = controller
    try {
      const res = await fetch(`/api/load-chat?${new URLSearchParams({ sessionId: chat.id })}`, { signal: controller.signal })
      if (!res.ok) throw new Error(`Load chat failed: ${res.status}`)
      const data = await res.json()
      setMessages(data.messages || [])
      setCurrentChatId(chat.id)
      setSelectedMood(data.mood || null)
    } catch (err) {
      if ((err as any).name === 'AbortError') return
      console.error("Failed to load chat:", err)
    } finally {
      setIsLoadingHistory(false)
      delete abortControllers.current[`load_${chat.id}`]
    }
  }, [currentChatId])

  // === DELETE CHAT ===
  const deleteChat = useCallback(async (chatId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!confirm("Are you sure you want to delete this chat? This action cannot be undone.")) return
    try {
      const res = await fetch(`/api/delete-chat?${new URLSearchParams({ sessionId: chatId })}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
      setChats(prev => prev.filter(c => c.id !== chatId))
      if (currentChatId === chatId) {
        newChat()
      }
    } catch (err) {
      console.error("Failed to delete chat:", err)
    }
  }, [currentChatId])

  // === NEW CHAT ===
  const newChat = useCallback(() => {
    setMessages([])
    setInput("")
    setCurrentChatId(null)
  }, [])

  // === START CHAT (MOOD SELECTION) ===
  const startChat = useCallback((moodName: string) => {
    const mood = MOODS.find(m => m.name === moodName)
    if (!mood) return
    setMessages([{ role: "assistant", content: mood.greeting }])
    setSelectedMood(mood.name)
    setCurrentChatId(null)
  }, [])

  // === SEND MESSAGE ===
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isSending || !userId) return
    const userMsg = input.trim()
    setInput("")

    // Optimistic UI update
    updateMessages(prev => [...prev, { role: "user", content: userMsg }])
    setIsTyping(true)
    setIsSending(true)

    // snapshot of messages to send
    const messagesToSend = [...messagesRef.current, { role: "user", content: userMsg }]

    const controller = new AbortController()
    const key = `send_${Date.now()}`
    abortControllers.current[key] = controller

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesToSend, mood: selectedMood, sessionId: currentChatId, userId }),
        signal: controller.signal
      })

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "")
        throw new Error(`API Error: ${res.status} ${txt}`)
      }

      const newSessionId = res.headers.get("X-Session-Id")

      // add placeholder assistant message to show streaming
      updateMessages(prev => [...prev, { role: "assistant", content: "" }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let aiReply = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        aiReply += chunk

        // update last assistant message
        updateMessages(prev => {
          if (prev.length === 0 || prev[prev.length - 1].role !== 'assistant') {
            return [...prev, { role: 'assistant', content: aiReply }]
          }
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: aiReply }
          return copy
        })
      }

      // finalize session id (if new)
      if (newSessionId && !currentChatId) setCurrentChatId(newSessionId)

      // refresh chat list after sending
      if (userId) loadChatHistory(userId)

    } catch (err) {
      if ((err as any).name === 'AbortError') {
        console.log('Send aborted')
      } else {
        console.error(err)
        updateMessages(prev => [...prev, { role: "assistant", content: "Oops, something went wrong... try again!" }])
      }
    } finally {
      setIsTyping(false)
      setIsSending(false)
      delete abortControllers.current[key]
    }
  }, [input, isSending, userId, currentChatId, selectedMood, loadChatHistory])

  // memoized current chat
  const currentChat = useMemo(() => chats.find(c => c.id === currentChatId) || null, [chats, currentChatId])

  // handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  // --- UI ---
  if (!selectedMood) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-8">
        <div className="text-center space-y-12 max-w-lg mx-auto">
          <div className="flex justify-center mb-8">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-full">
              <MessageCircle className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white">Comfy by Instapreps AI</h1>
          <p className="text-xl text-gray-400">your confidence companion</p>
          <p className="text-lg text-gray-300">How do you feel today?</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {MOODS.map(m => (
              <Button
                key={m.name}
                variant="outline"
                className={`h-28 w-full text-sm font-medium border-2 rounded-xl flex flex-col justify-center ${m.color} bg-transparent hover:bg-gray-100 text-white`}
                onClick={() => startChat(m.name)}
              >
                <span className="text-3xl">{m.emoji}</span>
                <span className="mt-1">{m.name}</span>
              </Button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Made with <Sparkles className="inline w-4 h-4 text-purple-500" /> by Sakthi
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col border-r border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-left hover:bg-gray-700 text-white"
            onClick={newChat}
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>
        <div className="flex-1 p-2 overflow-y-auto">
          {isLoadingHistory ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            </div>
          ) : chats.length === 0 ? (
            <p className="text-gray-400 text-sm text-center p-4">No chat history yet</p>
          ) : (
            <div className="space-y-1">
              {[...chats].sort((a, b) => b.timestamp - a.timestamp).map((chat) => (
                <div
                  key={chat.id}
                  className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer ${currentChatId === chat.id ? "bg-gray-700" : ""}`}
                  onClick={() => loadChat(chat)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{chat.title || 'Untitled Chat'}</p>
                    <p className="text-xs text-gray-400 truncate">{chat.lastMessage}</p>
                  </div>
                  <button
                    onClick={(e) => deleteChat(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-opacity"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar footer: User profile or login CTA */}
        <div className="p-3 border-t border-gray-700">
          {user?.id ? (
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {/* small avatar button in sidebar */}
                <UserButton afterSignOutUrl="/" />

              </div>
              <div className="text-sm text-gray-200">
                {user.fullName || (user.username ?? "Your Account")}
              </div>
            </div>
          ) : (
            <SignInButton mode="modal">
              <Button className="w-full bg-purple-600 text-white">Login to Save Chats</Button>
            </SignInButton>
          )}
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col bg-gray-900">
        <div className="border-b border-gray-700 px-6 py-4 bg-gray-800 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-purple-400" />
              <h1 className="text-lg font-semibold text-white">Comfy by Instapreps AI • {currentChat?.mood || selectedMood || "Unknown Mood"}</h1>
            </div>

            {/* TOP-RIGHT: LOGIN / USER */}
            <div>
              {user?.id ? (
                <UserButton afterSignOutUrl="/" />
              ) : (
                <SignInButton mode="modal">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">
                    Login
                  </Button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-md px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-100 border border-gray-700"}`}>
                  <p>{msg.content}</p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-800 px-4 py-3 rounded-2xl border border-gray-700">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}

            {isLoadingHistory && currentChatId !== null && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-700 p-4 bg-gray-800">
          <div className="max-w-2xl mx-auto flex gap-3 items-center">

            {/* File Upload Button */}
            <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-white px-3 py-3 rounded-xl border border-gray-600">
              📎
              <input
                type="file"
                accept=".pdf,image/*,.txt"
                className="hidden"
                onChange={(e) => handleFileUpload(e)}
              />
            </label>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Comfy..."
              className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-xl border border-gray-600 focus:border-purple-500 focus:outline-none text-sm placeholder-gray-400 disabled:opacity-50"
              disabled={isSending}
            />
            <Button
              onClick={() => void sendMessage()}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4"
              size="sm"
              disabled={!input.trim() || isSending}
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
