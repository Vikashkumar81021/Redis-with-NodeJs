import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/RedisPratical");
    console.log("database connection successfully");
  } catch (error) {
    console.log("database connection failed", error.message);
  }
};
