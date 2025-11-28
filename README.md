🚀 Comfy Pro – AI Emotional Support & Productivity Chatbot

AI-driven companion for students with mood-based conversations, memory, and persistent chat history.
Built using Next.js 14, Clerk Auth, Groq LLaMA, Prisma, Supabase, TailwindCSS.

✨ Features

🧠 Mood-based conversational AI (5 emotional states)

⚡ Ultra-fast streaming responses using Groq LLaMA 3.3

🔒 Authentication with Clerk (login/sign-up + user profile)

💾 Persistent chat history for logged-in users

👤 Guest mode support using local identifiers

📄 File upload support (PDFs, notes) — RAG ready

🗂️ Sidebar with chat sessions & delete option

🌓 Modern UI built with TailwindCSS + shadcn/ui

📱 Fully responsive design (mobile-friendly)

🚀 Deployed on Vercel


📦 Project Structure
/src
 ├── app
 │   ├── api
 │   │   ├── chat/route.ts
 │   │   ├── upload/route.ts
 │   │   ├── history/route.ts
 │   │   ├── load-chat/route.ts
 │   │   ├── delete-chat/route.ts
 │   │   └── view-chats/route.ts
 │   ├── sign-in
 │   ├── sign-up
 │   └── page.tsx         # Main chatbot UI
 ├── components/ui        # Reusable UI elements
 ├── lib/prisma.ts
 └── middleware.ts         # Clerk middleware


⚙️ Environment Variables

Create .env.local:

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-key-here
CLERK_SECRET_KEY=your-secret-key-here

# Database
DATABASE_URL=your-supabase-postgres-url

# Groq API
GROQ_API_KEY=your-groq-api-key


🚀 Deployment

Deployed on Vercel.
Every git push to main triggers a new deployment.


🧩 Future Enhancements

Full RAG pipeline (PDF → embeddings → vector search)

Pinecone or Supabase Vector integration

AI personas (Study Coach, Confidence Buddy, Focus Mode)

Analytics dashboard for user insights

Chat widget embeddable in any website


✨ Author

Sakthi Rajan
AI Engineer
