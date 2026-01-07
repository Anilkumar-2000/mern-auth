import jwt from "jsonwebtoken";

export const userAuth = async (req, res, next) => {
  const { jwt_token } = req.cookies;

  try {
    if (!jwt_token) {
      return res.json({ success: false, message: "Token not available" });
    }

    const decodedToken = jwt.verify(jwt_token, process.env.JWT_SECRET);

    if (!decodedToken) {
      return res.json({ success: false, message: "Invalid token" });
    } else {
      req.user = { userId: decodedToken.userId };
      console.log("userId from middleware", req.user.userId);
    }

    next();
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
