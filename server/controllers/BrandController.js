/**
 * Brand Controller - Brand Management
 */

const Brand = require("../models/Brand");
const { AppError } = require("../middleware/errorHandler");

const createBrand = async (req, res, next) => {
  try {
    const { name, description, logo } = req.body;

    const existingBrand = await Brand.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existingBrand) {
      throw new AppError("Brand already exists", 400, "DUPLICATE_ERROR");
    }

    const brand = await Brand.create({
      name,
      description,
      logo,
      createdBy: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: brand.name,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(
        new AppError("Brand name already exists", 400, "DUPLICATE_ERROR"),
      );
    }
    next(error);
  }
};

const getAllBrands = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const query = includeInactive ? {} : { isActive: true };

    const brands = await Brand.find(query)
      .sort({ name: 1 })
      .select("name description logo isActive")
      .lean();

    res.status(200).json({
      success: true,
      data: brands.map((b) => b.name),
    });
  } catch (error) {
    next(error);
  }
};

const updateBrand = async (req, res, next) => {
  try {
    const { brandId } = req.params;
    const { name, description, logo, isActive } = req.body;

    const brand = await Brand.findById(brandId);
    if (!brand) {
      throw new AppError("Brand not found", 404, "NOT_FOUND");
    }

    if (name && name.toUpperCase() !== brand.name) {
      const existingBrand = await Brand.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: brandId },
      });
      if (existingBrand) {
        throw new AppError("Brand name already exists", 400, "DUPLICATE_ERROR");
      }
      brand.name = name.toUpperCase();
    }

    if (description) brand.description = description;
    if (logo) brand.logo = logo;
    if (isActive !== undefined) brand.isActive = isActive;

    await brand.save();

    res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

const deleteBrand = async (req, res, next) => {
  try {
    const { brandId } = req.params;

    const brand = await Brand.findById(brandId);
    if (!brand) {
      throw new AppError("Brand not found", 404, "NOT_FOUND");
    }

    await Brand.findByIdAndDelete(brandId);

    res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBrand,
  getAllBrands,
  updateBrand,
  deleteBrand,
};
