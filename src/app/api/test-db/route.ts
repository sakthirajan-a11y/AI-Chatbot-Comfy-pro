import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User"
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: "Database connected!",
      user 
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
