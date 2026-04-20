/**
 * Warehouse Controller - Warehouse Management
 */

const Warehouse = require("../models/Warehouse");
const { AppError } = require("../middleware/errorHandler");

const createWarehouse = async (req, res, next) => {
  try {
    const { name, location, capacity } = req.body;

    const existingWarehouse = await Warehouse.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existingWarehouse) {
      throw new AppError("Warehouse already exists", 400, "DUPLICATE_ERROR");
    }

    const warehouse = await Warehouse.create({
      name,
      location,
      capacity,
      createdBy: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: "Warehouse created successfully",
      data: warehouse.name,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(
        new AppError("Warehouse name already exists", 400, "DUPLICATE_ERROR"),
      );
    }
    next(error);
  }
};

const getAllWarehouses = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const query = includeInactive ? {} : { isActive: true };

    const warehouses = await Warehouse.find(query)
      .sort({ name: 1 })
      .select("name location capacity currentStock isActive")
      .lean();

    res.status(200).json({
      success: true,
      data: warehouses,
    });
  } catch (error) {
    next(error);
  }
};

const updateWarehouse = async (req, res, next) => {
  try {
    const { warehouseId } = req.params;
    const { name, location, capacity, isActive } = req.body;

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) {
      throw new AppError("Warehouse not found", 404, "NOT_FOUND");
    }

    if (name && name !== warehouse.name) {
      const existingWarehouse = await Warehouse.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: warehouseId },
      });
      if (existingWarehouse) {
        throw new AppError(
          "Warehouse name already exists",
          400,
          "DUPLICATE_ERROR",
        );
      }
      warehouse.name = name;
    }

    if (location) warehouse.location = location;
    if (capacity !== undefined) warehouse.capacity = capacity;
    if (isActive !== undefined) warehouse.isActive = isActive;

    await warehouse.save();

    res.status(200).json({
      success: true,
      message: "Warehouse updated successfully",
      data: warehouse,
    });
  } catch (error) {
    next(error);
  }
};

const deleteWarehouse = async (req, res, next) => {
  try {
    const { warehouseId } = req.params;

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) {
      throw new AppError("Warehouse not found", 404, "NOT_FOUND");
    }

    await Warehouse.findByIdAndDelete(warehouseId);

    res.status(200).json({
      success: true,
      message: "Warehouse deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWarehouse,
  getAllWarehouses,
  updateWarehouse,
  deleteWarehouse,
};
