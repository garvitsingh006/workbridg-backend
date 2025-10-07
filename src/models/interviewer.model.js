import mongoose, { Schema } from "mongoose";

const interviewerSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  department: {
    type: String,
    enum: ["Tech", "Design", "Marketing", "Finance", "HR", "Other"],
    default: "Other"
  },
  expertiseAreas: [
    {
      type: String,
      trim: true
    }
  ],
  totalInterviews: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  bio: {
    type: String,
    trim: true
  },
  availability: [
    {
      date: Date,
      timeSlots: [String] // e.g., ["10:00-10:30", "11:00-11:30"]
    }
  ]
}, { timestamps: true });

export const Interviewer = mongoose.model("Interviewer", interviewerSchema);
