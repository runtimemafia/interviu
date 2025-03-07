import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const POST = async (req: NextRequest) => {
  const body = await req.json();

  const { action } = body;

  if (action === "saved") {
    const { sessionId, chunkNumber, startTime } = body;

    const chunk = await prisma.chunks.create({
      data: {
        chunk_number: parseInt(chunkNumber),
        start_time: String(startTime),
        session_id: sessionId,
        date_created: new Date(),
        status: "active",
      },
    });

    if (!chunk) {
      return NextResponse.json(
        { success: false, message: "Failed to save chunk" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Chunk saved" },
      { status: 200 }
    );
  }
};

export { POST };
