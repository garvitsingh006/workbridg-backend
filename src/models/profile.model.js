import mongoose, {Schema} from "mongoose";

const profileSchema = new Schema
(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },
        location: {
            type: String,
            trim: true
        },
        workField: {
            type: String,
            required: true,
            trim: true
        },
        workExperience: [
            {
                title: {type: String, required: true, trim: true},
                company: {type: String},
                years: {type: Number, required: true, default: 0},
                description: {type: String, trim: true}
            }
        ],
        skills: {
            type: [String],
            set: (skills) => [...new Set(skills.map(s => s.trim().toLowerCase()))]
        },
        linkedIn: {
            type: String,
            trim: true
        },
        github: {
            type: String,
            trim: true
        },
        preferredRole: {
            type: String,
            trim: true
        },
        resume: {
            type: String // cloudinary url
        },
        bio: {
            type: String,
            maxLength: 500
        },
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        ratingCount: {
            type: Number,
            default: 0
        },
        completedProjects: {
            type: Number,
            default: 0
        },
        earnings: {
            type: Number,
            default: 0
        }
    },
    {timestamps: true}
)

profileSchema.methods.addExperience = async function (exp) {
  this.workExperience.push(exp);
  return await this.save();
};

profileSchema.methods.updateRating = async function (newRating) {
  this.rating = ((this.rating * this.ratingCount) + newRating) / (this.ratingCount + 1);
  this.ratingCount += 1;
  return await this.save();
};

profileSchema.methods.incrementCompletedProjects = async function () {
    this.completedProjects += 1;
    return await this.save();
};

profileSchema.statics.getTopProfiles = async function (limit = 10) {
  return await this.find().sort({ rating: -1, earnings: -1 }).limit(limit);
};

profileSchema.index({ skills: 1 });
profileSchema.index({ workField: 1 });
profileSchema.index({ rating: -1, earnings: -1 });


export const Profile = mongoose.model("Profile", profileSchema);