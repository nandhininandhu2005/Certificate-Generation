import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema({
  certificateNo: String,
  studentName: String,
  regNo: String,
  Department: String,
  course: String,
  college: String,
  trainingType: String,
  startDate: String,
  endDate: String,
  company: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Certificate", certificateSchema);