# Resume Upload Implementation Guide

## Overview
This document provides a complete implementation guide for the resume upload feature in the WorkBridg platform. The implementation includes:

- **Frontend**: React components with animations and progress tracking
- **Backend**: Node.js/Express endpoints with Cloudinary integration
- **File Validation**: Client and server-side validation
- **User Experience**: Smooth animations and real-time feedback

## Frontend Implementation

### 1. File Upload Component (`FileUpload.tsx`)
A reusable component with the following features:
- Drag & drop file upload
- File validation (type, size)
- Upload progress animation
- File preview with remove option
- Error handling with user-friendly messages

### 2. Upload Service (`uploadService.ts`)
Handles all file upload operations:
- API communication with backend
- Progress tracking
- File validation
- Error handling

### 3. Custom Hook (`useFileUpload.ts`)
Provides state management for file uploads:
- File selection and validation
- Upload progress tracking
- Error state management
- Success callbacks

### 4. Integration in SetDetailsPage
The resume upload is integrated into the freelancer profile setup flow with:
- Optional immediate upload
- Automatic upload on form submission
- Proper form validation

## Backend Requirements

### 1. Required Dependencies
```bash
npm install multer cloudinary express-rate-limit helmet
```

### 2. Cloudinary Configuration
```javascript
// config/cloudinary.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
```

### 3. Multer Configuration
```javascript
// middleware/upload.js
const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.doc', '.docx'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

module.exports = upload;
```

### 4. Upload Route
```javascript
// routes/upload.js
const express = require('express');
const cloudinary = require('../config/cloudinary');
const upload = require('../middleware/upload');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many upload attempts, please try again later.',
});

// Upload resume endpoint
router.post('/resume', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'resumes',
          public_id: `resume_${req.user.id}_${Date.now()}`,
          allowed_formats: ['pdf', 'doc', 'docx'],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed. Please try again.'
    });
  }
});

// Delete resume endpoint
router.delete('/resume/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

module.exports = router;
```

### 5. Authentication Middleware
```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

module.exports = authenticateToken;
```

## Environment Variables

Add these to your `.env` file:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# JWT Secret
JWT_SECRET=your_jwt_secret
```

## Usage Flow

### 1. File Selection
- User selects a file via drag & drop or file picker
- Client-side validation occurs immediately
- File preview is shown with upload option

### 2. Upload Process
- User can upload immediately or wait for form submission
- Progress bar shows upload status with animations
- Success/error feedback is provided

### 3. Form Submission
- If file is selected but not uploaded, automatic upload occurs
- Resume URL is included in the profile data
- Form submission continues after successful upload

## Features

### ✅ Implemented Features
- **Drag & Drop Upload**: Intuitive file selection
- **File Validation**: Type and size validation
- **Progress Tracking**: Real-time upload progress
- **Animations**: Smooth transitions and feedback
- **Error Handling**: User-friendly error messages
- **File Preview**: Show selected file details
- **Optional Upload**: Upload now or later
- **Auto Upload**: Upload on form submission if needed

### 🎨 Animation Features
- **File Drop Animation**: Scale and rotate effects on drag over
- **Progress Bar**: Smooth progress animation
- **State Transitions**: Fade in/out between upload states
- **Button Interactions**: Hover and click animations
- **Error Messages**: Slide in error notifications

### 🔒 Security Features
- **File Type Validation**: Only PDF, DOC, DOCX allowed
- **File Size Limits**: 10MB maximum
- **Rate Limiting**: Prevent upload abuse
- **Authentication**: Protected endpoints
- **Secure URLs**: Cloudinary secure URLs

## Testing

### Frontend Testing
1. Test file selection via drag & drop
2. Test file selection via file picker
3. Test file validation (wrong type, too large)
4. Test upload progress animation
5. Test error handling
6. Test file removal
7. Test form submission with/without upload

### Backend Testing
1. Test upload endpoint with valid files
2. Test upload endpoint with invalid files
3. Test file size limits
4. Test rate limiting
5. Test authentication
6. Test delete endpoint

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure backend CORS is configured for file uploads
2. **File Size Limits**: Check both frontend and backend limits match
3. **Cloudinary Errors**: Verify API credentials and folder permissions
4. **Authentication**: Ensure JWT tokens are properly included in requests

### Debug Tips

1. Check browser network tab for upload requests
2. Verify Cloudinary dashboard for uploaded files
3. Check backend logs for detailed error messages
4. Test with different file types and sizes

## Performance Considerations

1. **File Size**: Limit to reasonable sizes (10MB recommended)
2. **Progress Tracking**: Use throttled progress updates
3. **Error Recovery**: Implement retry mechanisms
4. **Cleanup**: Delete old files when new ones are uploaded
5. **CDN**: Leverage Cloudinary's CDN for fast file delivery

This implementation provides a complete, production-ready file upload solution with excellent user experience and robust error handling.
