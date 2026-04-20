/**
 * Cloudinary Upload Service
 * Advanced image upload, resize, and delete utilities
 */

const cloudinary = require("cloudinary").v2;
const { PassThrough } = require("stream");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IMAGE_PRESETS = {
  product: { width: 800, height: 800, crop: "limit" },
  thumbnail: { width: 400, height: 400, crop: "fill" },
  logo: { width: 200, height: 200, crop: "fill" },
  banner: { width: 1920, height: 600, crop: "limit" },
  avatar: { width: 300, height: 300, crop: "fill" },
  original: { width: 2000, height: 2000, crop: "limit" },
};

const buildTransformation = (preset, customOptions = {}) => {
  const baseTransform = IMAGE_PRESETS[preset] || IMAGE_PRESETS.product;
  return [
    { ...baseTransform, ...customOptions },
    { quality: "auto:good" },
    { fetch_format: "auto" },
  ];
};

const uploadToCloudinary = (fileBuffer, options = {}) => {
  const {
    folder = "gearbazar/products",
    preset = "product",
    publicId = null,
    tags = [],
    context = null,
  } = options;

  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
      transformation: buildTransformation(preset, options.resize),
      tags,
      context,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
      uploadOptions.overwrite = true;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url,
            url: result.url,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            createdAt: result.created_at,
          });
        }
      },
    );

    uploadStream.end(fileBuffer);
  });
};

const uploadMultipleImages = async (files, options = {}) => {
  const {
    folder = "gearbazar/products",
    preset = "product",
    maxConcurrent = 5,
  } = options;

  const chunkedFiles = [];
  for (let i = 0; i < files.length; i += maxConcurrent) {
    chunkedFiles.push(files.slice(i, i + maxConcurrent));
  }

  const results = [];
  for (const chunk of chunkedFiles) {
    const chunkResults = await Promise.all(
      chunk.map((fileBuffer, index) =>
        uploadToCloudinary(fileBuffer, {
          ...options,
          folder: `${folder}/${Date.now()}`,
          publicId: options.publicIds?.[i + index] || null,
        }).catch((error) => ({ error: error.message, success: false })),
      ),
    );
    results.push(...chunkResults);
  }

  return results.map((result, index) => ({
    index,
    success: !result.error,
    data: result.success ? result : null,
    error: result.error || null,
  }));
};

const uploadBase64Image = (base64String, options = {}) => {
  return new Promise((resolve, reject) => {
    const { preset = "product", folder = "gearbazar/uploads" } = options;

    cloudinary.uploader.upload(
      base64String,
      {
        folder,
        resource_type: "image",
        transformation: buildTransformation(preset, options.resize),
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url,
            url: result.url,
            format: result.format,
            width: result.width,
            height: result.height,
          });
        }
      },
    );
  });
};

const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return {
      success: result.result === "ok",
      publicId,
      message: result.result,
    };
  } catch (error) {
    return {
      success: false,
      publicId,
      error: error.message,
    };
  }
};

const deleteMultipleImages = async (publicIds) => {
  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    return [];
  }

  const results = await Promise.all(
    publicIds.map((id) => deleteFromCloudinary(id)),
  );

  return {
    total: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
};

const deleteImagesByPrefix = async (prefix) => {
  try {
    const result = await cloudinary.api.resources_by_tag(prefix, {
      type: "uploaded",
    });

    if (!result.resources || result.resources.length === 0) {
      return { deleted: 0, message: "No images found with this prefix" };
    }

    const publicIds = result.resources.map((r) => r.public_id);
    return await deleteMultipleImages(publicIds);
  } catch (error) {
    return { deleted: 0, error: error.message };
  }
};

const getImageDetails = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      url: result.url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      version: result.version,
    };
  } catch (error) {
    throw new Error(`Failed to get image details: ${error.message}`);
  }
};

const createUploadSignature = (
  folder,
  timestamp = Math.round(Date.now() / 1000),
) => {
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder: `gearbazar/${folder}`,
    },
    cloudinary.config().api_secret,
  );

  return {
    signature,
    timestamp,
    cloudName: cloudinary.config().cloud_name,
    apiKey: cloudinary.config().api_key,
    folder: `gearbazar/${folder}`,
  };
};

module.exports = {
  cloudinary,
  IMAGE_PRESETS,
  uploadToCloudinary,
  uploadMultipleImages,
  uploadBase64Image,
  deleteFromCloudinary,
  deleteMultipleImages,
  deleteImagesByPrefix,
  getImageDetails,
  createUploadSignature,
  buildTransformation,
};
