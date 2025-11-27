import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    await prisma.chatSession.delete({
      where: { id: sessionId }
    })

    return NextResponse.json({ 
      success: true,
      message: "Chat deleted"
    })
  } catch (error: any) {
    console.error("Delete chat error:", error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}
