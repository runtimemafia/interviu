function decodeJwt(token: string) {
    try {
      // JWT consists of 3 parts: header.payload.signature
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid JWT token format");
      }
  
      // Decode the payload (Base64Url)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  
      return {
        email: payload.email || "No email",
        name: payload.name || "No name",
        picture: payload.picture || "",
        userId: payload.sub || "No ID",
      };
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  }

export { decodeJwt };