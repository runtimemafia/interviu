import { verifyUser } from "@/utils/middlewareutils";
import { NextRequest, NextResponse } from "next/server";

const GET = async (req: NextRequest) => {
  const verification = await verifyUser(req);

  if (!verification) {
    return NextResponse.json(
      {
        message: "User not verified",
      },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      message: "User verified",
    },
    { status: 200 }
  );
};

export { GET };
