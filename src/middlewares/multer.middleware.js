import multer from 'multer';
import crypto from 'crypto';
import path from 'path';

// Disk storage for general uploads
const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/temp')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = crypto.randomBytes(4).toString('hex'); // 8 characters
        cb(null, file.originalname + '-' + uniqueSuffix);
    }
});

// Memory storage for direct cloud uploads (resumes)
const memoryStorage = multer.memoryStorage();

// File filter for resume uploads
const resumeFileFilter = (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
    }
};

// General upload middleware (existing functionality)
export const upload = multer({ storage: diskStorage });

// Resume upload middleware (new functionality)
export const resumeUpload = multer({
    storage: memoryStorage,
    fileFilter: resumeFileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
});