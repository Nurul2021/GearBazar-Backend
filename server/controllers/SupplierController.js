/**
 * Supplier Controller - Supplier Management
 */

const Supplier = require("../models/Supplier");
const { AppError } = require("../middleware/errorHandler");

const createSupplier = async (req, res, next) => {
  try {
    const { name, contactPerson, email, phone, address, city, paymentTerms } =
      req.body;

    const existingSupplier = await Supplier.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existingSupplier) {
      throw new AppError("Supplier already exists", 400, "DUPLICATE_ERROR");
    }

    const supplier = await Supplier.create({
      name,
      contactPerson,
      email,
      phone,
      address,
      city,
      paymentTerms,
      createdBy: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: supplier.name,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(
        new AppError("Supplier name already exists", 400, "DUPLICATE_ERROR"),
      );
    }
    next(error);
  }
};

const getAllSuppliers = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const query = includeInactive ? {} : { isActive: true };

    const suppliers = await Supplier.find(query)
      .sort({ name: 1 })
      .select(
        "name contactPerson email phone address city paymentTerms isActive",
      )
      .lean();

    res.status(200).json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    next(error);
  }
};

const updateSupplier = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const {
      name,
      contactPerson,
      email,
      phone,
      address,
      city,
      paymentTerms,
      isActive,
    } = req.body;

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      throw new AppError("Supplier not found", 404, "NOT_FOUND");
    }

    if (name && name !== supplier.name) {
      const existingSupplier = await Supplier.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: supplierId },
      });
      if (existingSupplier) {
        throw new AppError(
          "Supplier name already exists",
          400,
          "DUPLICATE_ERROR",
        );
      }
      supplier.name = name;
    }

    if (contactPerson) supplier.contactPerson = contactPerson;
    if (email) supplier.email = email;
    if (phone) supplier.phone = phone;
    if (address) supplier.address = address;
    if (city) supplier.city = city;
    if (paymentTerms) supplier.paymentTerms = paymentTerms;
    if (isActive !== undefined) supplier.isActive = isActive;

    await supplier.save();

    res.status(200).json({
      success: true,
      message: "Supplier updated successfully",
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

const deleteSupplier = async (req, res, next) => {
  try {
    const { supplierId } = req.params;

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      throw new AppError("Supplier not found", 404, "NOT_FOUND");
    }

    await Supplier.findByIdAndDelete(supplierId);

    res.status(200).json({
      success: true,
      message: "Supplier deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSupplier,
  getAllSuppliers,
  updateSupplier,
  deleteSupplier,
};
