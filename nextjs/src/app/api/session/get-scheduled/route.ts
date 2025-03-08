import prisma from "@/lib/prisma";
import { verifyUser } from "@/utils/middlewareutils";
import { NextRequest, NextResponse } from "next/server";

const GET = async (req: NextRequest) => {
  const verifcation = await verifyUser(req);

  if (!verifcation) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  console.log(new Date().getTime());

  const upcomingSessions = await prisma.session.findMany({
    where: {
      scheduled_datetime: {
        gte: new Date().getTime(), // Use Date object directly instead of timestamp
      },
      user_interviuId: verifcation.interviuId || "",
    },
  });

  if (!upcomingSessions) {
    return NextResponse.json(
      { message: "Failed to fetch the sessions" },
      { status: 500 }
    );
  }

  // Convert BigInt values to strings before JSON serialization
  const serializedSessions = upcomingSessions.map(session => ({
    ...session,
    // Convert any BigInt properties to strings
    ...Object.fromEntries(
      Object.entries(session).map(([key, value]) => 
        typeof value === 'bigint' ? [key, String(value)] : [key, value]
      )
    )
  }));

  return NextResponse.json({
    message: "Upcoming sessions",
    data: serializedSessions,
  });
};

export {GET};
