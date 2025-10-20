import express from 'express';
import multer from 'multer';
import { uploadResumeToCloudinary, deleteFromCloudinary, generateResumeUrls } from '../utils/cloudinary.js';
import {v2 as cloudinary} from 'cloudinary';
import { resumeUpload } from '../middlewares/multer.middleware.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/user.model.js';

const router = express.Router();

// Test Cloudinary connection
router.get('/test-cloudinary', verifyJWT, asyncHandler(async (req, res) => {
  try {
    console.log('🧪 Testing Cloudinary connection...');
    
    // Check environment variables
    const configStatus = {
      cloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: !!process.env.CLOUDINARY_API_KEY,
      apiSecret: !!process.env.CLOUDINARY_API_SECRET
    };
    
    console.log('🔧 Config status:', configStatus);
    
    // Try a simple API call to test connectivity
    const testResult = await cloudinary.api.ping();
    console.log('✅ Cloudinary ping successful:', testResult);
    
    return res.status(200).json(
      new ApiResponse(200, {
        status: 'connected',
        config: configStatus,
        ping: testResult
      }, 'Cloudinary connection test successful')
    );
    
  } catch (error) {
    console.error('❌ Cloudinary test failed:', error);
    return res.status(500).json(
      new ApiResponse(500, {
        status: 'failed',
        error: error.message
      }, 'Cloudinary connection test failed')
    );
  }
}));

// Get current user's resume info
router.get('/resume/info', verifyJWT, asyncHandler(async (req, res) => {
  try {
    console.log('📄 Getting resume info for user:', req.user._id);
    
    const user = await User.findById(req.user._id).select('resume');
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    const resumeInfo = {
      hasResume: !!user.resume,
      resumeUrl: user.resume || null
    };
    
    console.log('📋 Resume info:', resumeInfo);
    
    return res.status(200).json(
      new ApiResponse(200, resumeInfo, 'Resume info retrieved successfully')
    );
    
  } catch (error) {
    console.error('❌ Error getting resume info:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(500, 'Failed to get resume info');
  }
}));

// Rate limiting middleware (will be added when express-rate-limit is installed)
// const uploadLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // limit each IP to 5 requests per windowMs
//   message: 'Too many upload attempts, please try again later.',
// });

// Upload resume endpoint
router.post('/resume', 
  // uploadLimiter, // Uncomment when express-rate-limit is installed
  (req, res, next) => {
    console.log('🔐 Auth middleware passed');
    next();
  },
  verifyJWT,
  (req, res, next) => {
    console.log('👤 User authenticated:', req.user?._id);
    next();
  },
  resumeUpload.single('file'),
  (req, res, next) => {
    console.log('📁 Multer middleware passed, file:', req.file ? 'Present' : 'Missing');
    next();
  },
  asyncHandler(async (req, res) => {
    try {
      console.log('🚀 Resume upload request received');
      console.log('👤 User:', req.user?._id || 'No user');
      console.log('📁 File info:', {
        originalname: req.file?.originalname,
        mimetype: req.file?.mimetype,
        size: req.file?.size,
        bufferLength: req.file?.buffer?.length
      });
      
      if (!req.file) {
        console.log('❌ No file in request');
        throw new ApiError(400, 'No file uploaded');
      }

      console.log('📤 Starting Cloudinary upload...');
      // Upload to Cloudinary
      const result = await uploadResumeToCloudinary(req.file.buffer, req.user._id);
      console.log("📋 Upload result:", result)
      
      if (!result) {
        console.log('❌ No result from Cloudinary upload');
        throw new ApiError(500, 'Failed to upload file to cloud storage');
      }

      // Generate different URL types for viewing and downloading
      const resumeUrls = generateResumeUrls(result, req.file.originalname);
      
      console.log('✅ Preparing response with data:', {
        urls: resumeUrls,
        publicId: result.public_id,
        originalName: req.file.originalname,
        size: req.file.size
      });

      // Update user's resume field with the view URL (for inline display)
      console.log('💾 Updating user resume field...');
      try {
        await User.findByIdAndUpdate(
          req.user._id,
          { 
            resume: resumeUrls.viewUrl // Use viewUrl for inline display
          },
          { new: true }
        );
        console.log('✅ User resume field updated successfully');
      } catch (updateError) {
        console.error('⚠️ Failed to update user resume field:', updateError);
        // Don't fail the upload if user update fails, just log it
      }

      const response = new ApiResponse(200, {
        viewUrl: resumeUrls.viewUrl,        // For inline viewing/display
        downloadUrl: resumeUrls.downloadUrl, // For downloading with original filename
        originalUrl: resumeUrls.originalUrl, // Fallback URL
        publicId: result.public_id,
        originalName: req.file.originalname,
        size: req.file.size
      }, 'File uploaded successfully');

      console.log('📤 Sending response:', response);
      
      return res.status(200).json(response);

    } catch (error) {
      console.error('💥 Upload route error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        http_code: error.http_code || 'N/A',
        isApiError: error instanceof ApiError
      });
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle specific Cloudinary errors
      if (error.http_code === 503) {
        throw new ApiError(503, 'Cloudinary service temporarily unavailable. Please try again later.');
      }
      
      if (error.name === 'UnexpectedResponse') {
        throw new ApiError(502, 'Cloud storage service error. Please check your configuration.');
      }
      
      throw new ApiError(500, 'Upload failed. Please try again.');
    }
  })
);

// Delete resume endpoint
router.delete('/resume/:publicId', 
  verifyJWT,
  asyncHandler(async (req, res) => {
    try {
      const { publicId } = req.params;
      
      if (!publicId) {
        throw new ApiError(400, 'Public ID is required');
      }
      
      console.log('🗑️ Deleting file from Cloudinary:', publicId);
      const result = await deleteFromCloudinary(publicId);
      
      if (!result) {
        throw new ApiError(500, 'Failed to delete file');
      }
      
      console.log('✅ File deleted from Cloudinary successfully');
      
      // Update user's resume field to null
      console.log('💾 Removing resume URL from user profile...');
      try {
        await User.findByIdAndUpdate(
          req.user._id,
          { 
            resume: null 
          },
          { new: true }
        );
        console.log('✅ User resume field cleared successfully');
      } catch (updateError) {
        console.error('⚠️ Failed to clear user resume field:', updateError);
        // Don't fail the delete if user update fails, just log it
      }
      
      return res.status(200).json(
        new ApiResponse(200, null, 'File deleted successfully')
      );
      
    } catch (error) {
      console.error('Delete error:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(500, 'Failed to delete file');
    }
  })
);

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  console.log('🚨 Upload router error middleware triggered:', {
    name: error.name,
    message: error.message,
    code: error.code,
    isMulterError: error instanceof multer.MulterError
  });
  
  if (error instanceof multer.MulterError) {
    console.log('📁 Multer error details:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json(
        new ApiResponse(400, null, 'File size too large. Maximum size is 10MB.')
      );
    }
    return res.status(400).json(
      new ApiResponse(400, null, error.message)
    );
  }
  
  if (error.message.includes('Invalid file type')) {
    console.log('❌ File type validation error:', error.message);
    return res.status(400).json(
      new ApiResponse(400, null, error.message)
    );
  }
  
  console.log('⚠️ Unhandled upload error, passing to next middleware');
  next(error);
});

export default router;
