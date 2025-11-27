import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    // Create a test user
    const user = await prisma.user.create({
      data: {
        name: "Test User",
        email: `test_${Date.now()}@example.com`
      }
    })

    // Create a test session
    const session = await prisma.chatSession.create({
      data: {
        userId: user.id,
        title: "Test Chat",
        mood: "happy"
      }
    })

    // Create a test message
    const message = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: "Test message"
      }
    })

    return NextResponse.json({ 
      success: true,
      user,
      session,
      message
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
