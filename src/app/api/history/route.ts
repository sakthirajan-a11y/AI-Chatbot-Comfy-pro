import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 })
    }

    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { lastMessageAt: "desc" },
      select: {
        id: true,
        title: true,
        mood: true,
        lastMessageAt: true,
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            content: true
          }
        }
      }
    })

    return NextResponse.json({ 
      success: true,
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.title,
        mood: s.mood,
        lastMessage: s.messages[0]?.content || "",
        timestamp: s.lastMessageAt.getTime()
      }))
    })
  } catch (error: any) {
    console.error("History error:", error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}
