import prisma from "@/lib/prisma";
import { verifyUser } from "@/utils/middlewareutils";
import { NextRequest, NextResponse } from "next/server";

const POST = async (req: NextRequest) => {
  const verification = await verifyUser(req);

  if (!verification) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (!body.sessionId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const user = await prisma.user.findFirst({
    where: {
      interviuId: verification.interviuId,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const sessionData = await prisma.session.findFirst({
    where: {
      session_id: body.sessionId,
      user_interviuId: user.interviuId,
    },
  });

  if (!sessionData) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  
  // Convert sessionData to a plain object with BigInt values converted to strings
  const serializedData = JSON.parse(
    JSON.stringify(sessionData, (_, value) => 
      typeof value === 'bigint' ? value.toString() : value
    )
  );

  return NextResponse.json({ sessionData: serializedData }, { status: 200 });
};

export { POST };
