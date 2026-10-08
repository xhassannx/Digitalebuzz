import multer from "multer";
import path from "path";
import fs from "fs";

// Memory storage for WhatsApp Business API uploads (temporary)
export const upload = multer({ storage: multer.memoryStorage() });

// Disk storage for gallery files (organization-based)
const galleryStorage = multer.diskStorage({
  destination: (req: any, file, cb) => {
    const organizationId = req.context?.organizationId || req.query.organizationId || req.body.organizationId;
    if (!organizationId) {
      return cb(new Error('Organization ID is required'), '');
    }
    
    const uploadPath = path.join(process.cwd(), 'uploads', organizationId, 'gallery');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req: any, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

export const galleryUpload = multer({ storage: galleryStorage });

// Disk storage for website-builder images (organization-based)
const websiteBuilderStorage = multer.diskStorage({
  destination: (req: any, _file, cb) => {
    const organizationId = req.context?.organizationId || req.query.organizationId;
    if (!organizationId) {
      return cb(new Error('Organization ID is required'), '');
    }
    const uploadPath = path.join(process.cwd(), 'uploads', organizationId, 'website-builder');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.png';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_') || 'image';
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});

export const websiteBuilderUpload = multer({ storage: websiteBuilderStorage });

// Disk storage for profile avatars (user-based, authenticated)
const profileAvatarStorage = multer.diskStorage({
  destination: (req: any, _file, cb) => {
    const userId = req.user?.claims?.sub || req.user?.id;
    if (!userId) {
      return cb(new Error('Unauthorized'), '');
    }
    const uploadPath = path.join(process.cwd(), 'uploads', 'profile');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req: any, file, cb) => {
    const userId = req.user?.claims?.sub || req.user?.id;
    if (!userId) {
      return cb(new Error('Unauthorized'), '');
    }
    const ext = path.extname(file.originalname) || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext.toLowerCase()) ? ext : '.jpg';
    cb(null, `${userId}${safeExt}`);
  },
});

export const profileAvatarUpload = multer({
  storage: profileAvatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, !!allowed);
  },
});
