export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { messages, mood, sessionId, userId } = await req.json();

    // -------------------------------------------------
    // DEBUG LOGS
    // -------------------------------------------------
    console.log("=== CHAT API CALLED ===");
    console.log("userId:", userId);
    console.log("sessionId:", sessionId);
    console.log("messages count:", messages.length);

    // -------------------------------------------------
    // 1. GET OR CREATE USER (Temporary – replaced by Clerk later)
    // -------------------------------------------------
    let user = await prisma.user.findFirst({
      where: { id: userId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          name: "Guest User",
          email: `${userId}@comfy.app`,
        },
      });
    }

    // -------------------------------------------------
    // 2. GET OR CREATE CHAT SESSION
    // -------------------------------------------------
    let session;

    if (sessionId) {
      session = await prisma.chatSession.findUnique({
        where: {
          id: sessionId,
          userId: user.id, // Only fetch if session belongs to user
        },
      });
    }

    if (!session) {
      // Create new session
      const userMessage = messages[messages.length - 1]?.content || "New Chat"
      const title = userMessage.slice(0, 50).trim() || "Untitled Chat"
      
      session = await prisma.chatSession.create({
        data: {
          userId: user.id,
          title,
          mood: mood || "neutral"
        }
      })
    }

    // -------------------------------------------------
    // 3. SAVE USER MESSAGE
    // -------------------------------------------------
    const lastUserMessage = messages[messages.length - 1];

    if (lastUserMessage) {
      await prisma.message.create({
        data: {
          sessionId: session.id,
          role: "user",
          content: lastUserMessage.content,
        },
      });
    }

    // -------------------------------------------------
    // 4. CALL GROQ API
    // -------------------------------------------------
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error("❌ Missing GROQ_API_KEY");
      return NextResponse.json(
        { error: "Missing GROQ_API_KEY" },
        { status: 500 }
      );
    }

    const groqMessages = [
      {
        role: "system",
        content: `You are Comfy — a warm, caring, emotional AI friend. User mood: ${
          mood || "neutral"
        }. You are a clean, structured chatbot.
        ALWAYS format your responses using:
        - Short paragraphs
        - Bullet points
        - Headings
        - Code blocks for code.`,
      },
      ...messages.slice(-10), // Only last 10 messages
    ];

    const groqStream = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: groqMessages,
          temperature: 0.6,
          max_tokens: 300,
          stream: true,
        }),
      }
    );

    if (!groqStream.ok) {
      const errorText = await groqStream.text();
      console.error("Groq API error:", groqStream.status, errorText);

      return NextResponse.json(
        {
          error: `Groq API error: ${groqStream.status}. Message: ${errorText.slice(
            0,
            100
          )}`,
        },
        { status: groqStream.status }
      );
    }

    if (!groqStream.body) {
      return NextResponse.json(
        { error: "No response body from Groq" },
        { status: 500 }
      );
    }

    // -------------------------------------------------
    // 5. STREAM RESPONSE + SAVE TO DB
    // -------------------------------------------------
    let fullAssistantResponse = "";
    let finalSaveAttempted = false;

    const stream = new ReadableStream({
      async start(controller) {
        const reader = groqStream.body!.getReader();
        const decoder = new TextDecoder();

        const finalizeAndSave = async () => {
          if (finalSaveAttempted) return;
          finalSaveAttempted = true;

          if (fullAssistantResponse.trim()) {
            console.log("Saving assistant message to DB...");

            await prisma.message.create({
              data: {
                sessionId: session.id,
                role: "assistant",
                content: fullAssistantResponse,
              },
            });

            await prisma.chatSession.update({
              where: { id: session.id },
              data: {
                lastMessageAt: new Date(),
              },
            });
            

            console.log("DB save complete.");
          }

          controller.close();
        };

        try {
          while (true) {
            const { value, done } = await reader.read();

            if (done) {
              await finalizeAndSave();
              break;
            }

            const text = decoder.decode(value);
            const lines = text.split("\n");

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;

              const json = line.replace("data: ", "").trim();

              if (json === "[DONE]") {
                await finalizeAndSave();
                return;
              }

              try {
                const parsed = JSON.parse(json);
                const delta =
                  parsed.choices?.[0]?.delta?.content;

                if (delta) {
                  fullAssistantResponse += delta;
                  controller.enqueue(
                    new TextEncoder().encode(delta)
                  );
                }
              } catch {
                continue; // skip partial chunks
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
          await finalizeAndSave();
        } finally {
          if (!finalSaveAttempted) controller.close();
        }
      },
    });

    // -------------------------------------------------
    // 6. RETURN STREAM
    // -------------------------------------------------
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Session-Id": session.id,
        "X-User-Id": user.id,
      },
    });
  } catch (error) {
    console.error("Unexpected error in POST handler:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
