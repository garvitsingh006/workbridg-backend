import mongoose from "mongoose";
const { Schema } = mongoose;

/* ------------------ FREELANCER SCHEMA ------------------ */
const freelancerSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        location: { type: String, trim: true },
        workField: { type: String, required: true, trim: true },
        workExperience: [
            {
                title: { type: String, required: true, trim: true },
                company: { type: String },
                years: { type: Number, required: true, default: 0 },
                description: { type: String, trim: true },
            },
        ],
        skills: {
            type: [String],
            set: (skills) => [
                ...new Set(skills.map((s) => s.trim().toLowerCase())),
            ],
        },
        linkedIn: { type: String, trim: true },
        github: { type: String, trim: true },
        preferredRole: { type: String, trim: true },
        resume: { type: String, required: true },
        bio: { type: String, maxLength: 500 },
        ratingDetails: {
            technical: { type: Number, default: 0, min: 0, max: 5 },
            communication: { type: Number, default: 0, min: 0, max: 5 },
            professionalism: { type: Number, default: 0, min: 0, max: 5 },
            speed: { type: Number, default: 0, min: 0, max: 5 },
            pastWork: { type: Number, default: 0, min: 0, max: 5 },
        },
        rating: { type: Number, default: 0, min: 0, max: 5 },
        ratingCount: { type: Number, default: 0 },
        completedProjects: { type: Number, default: 0 },
        earnings: { type: Number, default: 0 },
        pay_per_hour: { type: Number, default: 0 },
        isInterviewed: { type: Boolean, default: false },
        hasSeenProjectsOnboarding: { type: Boolean, default: false },
    },
    { timestamps: true }
);


/* Freelancer instance methods */
freelancerSchema.methods.addExperience = async function (exp) {
    this.workExperience.push(exp);
    return await this.save();
};

freelancerSchema.methods.updateRating = async function (newRating) {
    this.rating =
        (this.rating * this.ratingCount + newRating) / (this.ratingCount + 1);
    this.ratingCount += 1;
    return await this.save();
};

freelancerSchema.methods.incrementCompletedProjects = async function () {
    this.completedProjects += 1;
    return await this.save();
};

/* Freelancer static methods */
freelancerSchema.statics.getTopProfiles = async function (limit = 10) {
    return await this.find().sort({ rating: -1, earnings: -1 }).limit(limit);
};

/* Indexes */
freelancerSchema.index({ skills: 1 });
freelancerSchema.index({ workField: 1 });
freelancerSchema.index({ rating: -1, earnings: -1 });

/* ------------------ CLIENT SCHEMA ------------------ */
const clientSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        companyName: { type: String, required: true, trim: true },
        companyDescription: { type: String, trim: true },
        companySize: { type: String, trim: true },
        industry: { type: String, trim: true },
        location: { type: String, trim: true },
        projectTypes: {
            type: [String],
            set: (arr) => [...new Set(arr.map((p) => p.trim().toLowerCase()))],
        },
        website: { type: String, trim: true },
        linkedIn: { type: String, trim: true },
        hasSeenProjectsOnboarding: { type: Boolean, default: false },
    },
    { timestamps: true }
);

/* Client instance methods */
// Clients don’t have experience/rating, but you could add helper methods if needed
clientSchema.methods.addProjectType = async function (type) {
    if (!this.projectTypes.includes(type.toLowerCase())) {
        this.projectTypes.push(type.toLowerCase());
    }
    return await this.save();
};

/* Client static methods */
clientSchema.statics.getClientsByIndustry = async function (
    industry,
    limit = 10
) {
    return await this.find({ industry: industry }).limit(limit);
};

/* ------------------ EXPORT MODELS ------------------ */
export const FreelancerProfile = mongoose.model(
    "FreelancerProfile",
    freelancerSchema
);
export const ClientProfile = mongoose.model("ClientProfile", clientSchema);
