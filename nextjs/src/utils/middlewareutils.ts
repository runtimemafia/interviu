import prisma from "@/lib/prisma";
import { NextRequest } from "next/server";
import jwt from "njwt";

const verifyUser = async (req: NextRequest) => {
  let token = req.headers.get("Authorization");

  interface ITokenBody {
    body: {
      interviuId: string;
    };
  }

  if (!token) {
    console.error("No auth Token found");
    return false;
  }
  token = token.replace("Bearer ", "");

  let verification: ITokenBody | boolean | undefined = false;

  try {
    verification = jwt.verify(
      token,
      process.env.JWT_SECRET,
      "HS256"
    ) as unknown as ITokenBody;
  } catch (e) {
    console.error(e);
    verification = false;
  }

  if (!verification) {
    console.error("Token verification failed");
    return false;
  }

  const user = await prisma.user.findFirst({
    where: {
      interviuId: verification.body.interviuId,
    },
  });

  if (!user) {
    console.error("User not found");
    return false;
  }

  return {
    interviuId: user.interviuId,
  };
};

export { verifyUser };
