import bcrypt from "bcryptjs";
import User from "../models/userModel.js";
import generateTokenAndSetCookie from "../utils/generateToken.js";
import {
  EMAIL_VERIFIED_SUCCESS_TEMPLATE,
  EMAIL_VERIFY_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE,
  PASSWORD_RESET_TEMPLATE,
  WELCOME_EMAIL_TEMPLATE,
} from "../config/emailTemplate.js";
import transporter from "../config/nodemailer.js";

// User Registration End Point
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.json({ success: false, message: "All fields are required" });
    }

    const userAlreadyExit = await User.findOne({ email });

    if (userAlreadyExit) {
      return res.json({ success: false, message: "User Already Exit" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    generateTokenAndSetCookie(res, user._id);

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Welcome to Developers World",

      html: WELCOME_EMAIL_TEMPLATE.replace("{{email}}", user.email).replace(
        "{{name}}",
        user.name
      ),
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "User Registered Successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// User Login End Point
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({ success: false, message: "Credentials Required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: "Invalid Email" });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.json({ success: false, message: "Invalid Password" });
    }

    generateTokenAndSetCookie(res, user._id);

    res.json({ success: true, message: "User Logged In Successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// User Logout End Point
export const logout = async (req, res) => {
  try {
    res.clearCookie("jwt_token", {
      httpOnly: true,
      secure: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, message: "User Logged out Successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
// Send Verification OTP
export const sendVerifyOtp = async (req, res) => {
  const userId = req.user.userId;
  console.log("userId from send-verify-otp", userId);

  const user = await User.findById(userId);

  if (!user) {
    return res.json({ success: false, message: "User not found" });
  }

  if (user.isAccountVerified) {
    return res.json({ success: false, message: "User Already Verified" });
  }

  try {
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    user.verifyOtp = otp;
    user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "OTP Verification",

      html: EMAIL_VERIFY_TEMPLATE.replace("{{email}}", user.email).replace(
        "{{otp}}",
        otp
      ),
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: "Verification OTP send on email",
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
// Verify Email
export const verifyEmail = async (req, res) => {
  const { otp } = req.body;
  const userId = req.user.userId;

  if (!userId || !otp) {
    return res.json({ success: false, message: "OTP is required" });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.isAccountVerified) {
      return res.json({ success: false, message: "User already verified" });
    }

    if (user.verifyOtp === "" || user.verifyOtp !== otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    if (user.verifyOtpExpireAt < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new OTP.",
      });
    }

    user.isAccountVerified = true;
    user.verifyOtp = "";
    user.verifyOtpExpireAt = 0;

    await user.save();

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Verification OTP done successfully",
      html: EMAIL_VERIFIED_SUCCESS_TEMPLATE,
      text: "Your Email verification done successfully",
    };

    await transporter.sendMail(mailOptions);
    res.json({
      success: true,
      message: "Email verification done successfully",
    });
  } catch (error) {
    res.json({
      success: false,
      message: error.message,
    });
  }
};
// Send Password Reset OTP
export const sendResetOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.json({ success: false, message: "Invalid Email" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 7 * 60 * 60 * 1000;
    await user.save();

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Password Reset OTP Verification",

      html: PASSWORD_RESET_TEMPLATE.replace("{{email}}", user.email).replace(
        "{{otp}}",
        otp
      ),
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: "Password Reset OTP sent on email",
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
// Reset Password
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.json({
      success: false,
      message: "Email, OTP and New Password required",
    });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.json({ success: false, message: "User Not Found" });
  }

  if (user.resetOtp === "" || user.resetOtp !== otp) {
    return res.json({ success: false, message: "Invalid OTP" });
  }

  if (user.resetOtpExpireAt < Date.now()) {
    return res.json({ success: false, message: "OTP Expired" });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetOtp = "";
    user.resetOtpExpireAt = 0;

    await user.save();

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Password Reset Successfully",
      html: PASSWORD_RESET_SUCCESS_TEMPLATE.replace("{{email}}", user.email),
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: "Password Reset Successfully",
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const isAuthenticated = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { jwt_token } = req.cookies;

    if (!userId || !jwt_token) {
      return res.json({ success: false, message: "User unauthenticated" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (!user.isAccountVerified) {
      return res.json({ success: false, message: "Account is not Verified" });
    }

    res.json({ success: true, message: "User Authenticated" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
