import multer from 'multer';
import crypto from 'crypto';

const storage =  multer.diskStorage({
    destination: function (req, file, cb) {
        cb (null, './public/temp')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = crypto.randomBytes(4).toString('hex'); // 8 characters
        cb(null, file.originalname + '-' + uniqueSuffix);
    }
})

export const upload = multer({storage: storage});