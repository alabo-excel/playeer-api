import multer from 'multer';

// Configure multer to use memory storage
const storage = multer.memoryStorage();

export const upload = multer({ storage: storage }); 