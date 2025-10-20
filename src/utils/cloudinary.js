import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        })
        // console.log("File Uploaded on Cloudinary Successfully", response.url);
        fs.unlinkSync(localFilePath);
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath);
        return null;
    }
}

// Upload resume from buffer (for direct multer memory storage)
const uploadResumeToCloudinary = async (fileBuffer, userId) => {
    try {
        console.log('🔄 Starting Cloudinary upload...');
        console.log('📊 File buffer size:', fileBuffer?.length || 'undefined');
        console.log('👤 User ID:', userId);
        
        if (!fileBuffer) {
            console.log('❌ No file buffer provided');
            return null;
        }
        
        // Check Cloudinary config
        console.log('🔧 Cloudinary config check:');
        console.log('   - Cloud name:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
        console.log('   - API key:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
        console.log('   - API secret:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');
        
        const uploadOptions = {
            resource_type: 'raw', // Keep as 'raw' for document files
            folder: 'resumes',
            public_id: `resume_${userId}_${Date.now()}`,
            allowed_formats: ['pdf', 'doc', 'docx'],
        };
        
        console.log('⚙️ Upload options:', uploadOptions);
        
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                uploadOptions,
                (error, result) => {
                    if (error) {
                        console.error('❌ Cloudinary upload error:', {
                            message: error.message,
                            http_code: error.http_code,
                            name: error.name,
                            error: error
                        });
                        reject(error);
                    } else {
                        console.log('✅ Cloudinary upload successful!');
                        console.log('📄 Result:', {
                            secure_url: result.secure_url,
                            public_id: result.public_id,
                            bytes: result.bytes,
                            format: result.format
                        });
                        resolve(result);
                    }
                }
            );
            
            console.log('📤 Sending buffer to Cloudinary...');
            uploadStream.end(fileBuffer);
        });

    } catch (error) {
        console.error('💥 Resume upload wrapper error:', error);
        return null;
    }
}

// Delete file from Cloudinary
const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId, { 
            resource_type: 'raw' // Back to 'raw' to match upload
        });
        return result;
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        return null;
    }
}

// Generate different URL types for resumes
const generateResumeUrls = (cloudinaryResult, originalFilename) => {
    const baseUrl = cloudinaryResult.secure_url;
    
    return {
        // For inline viewing - use the direct URL (modern browsers handle PDFs inline)
        viewUrl: baseUrl,
        
        // For downloading - same URL but with download attribute in frontend
        downloadUrl: baseUrl,
        
        // Original secure URL
        originalUrl: baseUrl,
        
        // Additional metadata for frontend handling
        originalFilename: originalFilename
    };
};

export {uploadOnCloudinary, uploadResumeToCloudinary, deleteFromCloudinary, generateResumeUrls};