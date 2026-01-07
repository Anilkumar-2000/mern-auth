import User from "../models/userModel.js";

export const userData = async (req, res) => {
  const userId = req.user.userId;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.json({
        success: false,
        message: "Unauthenticated user. Login Again",
      });
    }

    res.json({
      success: true,
      userData: {
        name: user.name,
        isAccountVerified: user.isAccountVerified,
      },
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
