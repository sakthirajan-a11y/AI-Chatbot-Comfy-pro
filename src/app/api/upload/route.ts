// src/app/api/upload/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dynamically import pdf-parse and handle both ESM/CJS shapes
    const pdfParseModule: any = await import("pdf-parse");
    const pdfParseFn = pdfParseModule?.default ?? pdfParseModule;

    // Ensure it's callable
    if (typeof pdfParseFn !== "function") {
      console.error("pdf-parse import shape unexpected:", pdfParseModule);
      return NextResponse.json({ message: "PDF parser not available" }, { status: 500 });
    }

    // parse the PDF buffer
    const pdfData = await pdfParseFn(buffer);
    const extractedText = pdfData?.text ?? "";

    console.log("API: Extracted pdf length:", extractedText.length);

    return NextResponse.json({
      message: `✅ Uploaded ${file.name} and processed successfully!`,
      contentPreview: extractedText.slice(0, 1000), // send a preview
    });
  } catch (err) {
    console.error("Upload / parse error:", err);
    return NextResponse.json({ message: "❌ Error processing file." }, { status: 500 });
  }
}
