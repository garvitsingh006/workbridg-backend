import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

const submitHelpRequest = asyncHandler(async (req, res) => {
    const { email, domain, problem } = req.body;
    const user = req.user;

    if (!email || !domain || !problem) {
        throw new ApiError(400, "Email, domain, and problem description are required");
    }

    // Build HTML
    const html = `
        <h2>New Help Request</h2>
        <p><strong>From:</strong> ${user.fullName} (${user.username})</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>User Type:</strong> ${user.role}</p>
        <p><strong>Problem Domain:</strong> ${domain}</p>
        <p><strong>Problem Description:</strong></p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
            ${problem.replace(/\n/g, '<br>')}
        </div>
        <p><strong>Submitted At:</strong> ${new Date().toLocaleString()}</p>
    `;

    try {
        await resend.emails.send({
            from: "support@workbridg.xyz",
            to: "garvitsingh006@gmail.com",
            subject: `Help Request - ${domain}`,
            html,
        });

        res.status(200).json(
            new ApiResponse(200, null, "Help request submitted successfully")
        );
    } catch (error) {
        console.error("Resend email error:", error);
        throw new ApiError(500, "Failed to send help request");
    }
});

export { submitHelpRequest };