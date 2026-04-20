/**
 * Inventory Controller - Vendor Product Management
 */

const Product = require("../models/Product");
const Brand = require("../models/Brand");
const Warehouse = require("../models/Warehouse");
const Supplier = require("../models/Supplier");
const Category = require("../models/Category");
const { AppError } = require("../middleware/errorHandler");

const createProduct = async (req, res, next) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    if (!["seller", "garage", "admin"].includes(userRole)) {
      throw new AppError(
        "Only sellers and garage owners can add products",
        403,
        "FORBIDDEN",
      );
    }

    const {
      title,
      description,
      brand,
      category,
      compatibility,
      stockQuantity,
      publicPrice,
      wholesalePrice,
      partNumber,
      sku,
      images,
      specifications,
      warehouse,
      supplier,
      newOptions,
    } = req.body;

    if (newOptions) {
      const parsedNewOptions =
        typeof newOptions === "string" ? JSON.parse(newOptions) : newOptions;

      if (parsedNewOptions.brands && parsedNewOptions.brands.length > 0) {
        for (const brandName of parsedNewOptions.brands) {
          const existingBrand = await Brand.findOne({
            name: { $regex: new RegExp(`^${brandName}$`, "i") },
          });
          if (!existingBrand) {
            await Brand.create({
              name: brandName.toUpperCase(),
              createdBy: userId,
            });
          }
        }
      }

      if (
        parsedNewOptions.categories &&
        parsedNewOptions.categories.length > 0
      ) {
        for (const categoryName of parsedNewOptions.categories) {
          const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${categoryName}$`, "i") },
          });
          if (!existingCategory) {
            await Category.create({ name: categoryName, createdBy: userId });
          }
        }
      }

      if (
        parsedNewOptions.warehouses &&
        parsedNewOptions.warehouses.length > 0
      ) {
        for (const warehouseName of parsedNewOptions.warehouses) {
          const existingWarehouse = await Warehouse.findOne({
            name: { $regex: new RegExp(`^${warehouseName}$`, "i") },
          });
          if (!existingWarehouse) {
            await Warehouse.create({ name: warehouseName, createdBy: userId });
          }
        }
      }

      if (parsedNewOptions.suppliers && parsedNewOptions.suppliers.length > 0) {
        for (const supplierName of parsedNewOptions.suppliers) {
          const existingSupplier = await Supplier.findOne({
            name: { $regex: new RegExp(`^${supplierName}$`, "i") },
          });
          if (!existingSupplier) {
            await Supplier.create({ name: supplierName, createdBy: userId });
          }
        }
      }
    }

    const productData = {
      sellerId: userId,
      name: title,
      description,
      brand,
      category: category || "accessories",
      vehicleCompatibility: compatibility || [],
      inventory: {
        quantity: stockQuantity || 0,
        trackInventory: true,
        allowBackorder: false,
        reorderLevel: 10,
        warehouse: warehouse || "",
        storageLocation: sku || "",
      },
      pricing: {
        publicPrice: parseFloat(publicPrice),
        wholesalePrice: parseFloat(wholesalePrice),
        currency: "USD",
        discountPercent: 0,
        minOrderQty: 1,
      },
      partNumber,
      sku,
      images: images || [],
      specifications: specifications || {},
      isActive: stockQuantity > 0,
      isFeatured: false,
    };

    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

const getMyProducts = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, search, status, sort } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { sellerId: userId };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { partNumber: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      if (status === "in_stock") {
        query["inventory.quantity"] = { $gt: 0 };
      } else if (status === "out_of_stock") {
        query["inventory.quantity"] = { $lte: 0 };
      } else if (status === "active") {
        query.isActive = true;
      } else if (status === "inactive") {
        query.isActive = false;
      }
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { "pricing.publicPrice": 1 };
    else if (sort === "price_desc") sortOption = { "pricing.publicPrice": -1 };
    else if (sort === "stock_asc") sortOption = { "inventory.quantity": 1 };
    else if (sort === "stock_desc") sortOption = { "inventory.quantity": -1 };
    else if (sort === "name") sortOption = { name: 1 };

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(query),
    ]);

    const summary = await Product.aggregate([
      { $match: { sellerId: userId } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: "$inventory.quantity" },
          activeProducts: { $sum: { $cond: ["$isActive", 1, 0] } },
          outOfStock: {
            $sum: { $cond: [{ $lte: ["$inventory.quantity", 0] }, 1, 0] },
          },
          totalInventoryValue: {
            $sum: {
              $multiply: ["$inventory.quantity", "$pricing.publicPrice"],
            },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: products,
      summary: summary[0] || {
        totalProducts: 0,
        totalStock: 0,
        activeProducts: 0,
        outOfStock: 0,
        totalInventoryValue: 0,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateStockAndPrice = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;
    const { stockQuantity, publicPrice, wholesalePrice } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    if (
      product.sellerId.toString() !== userId.toString() &&
      req.userRole !== "admin"
    ) {
      throw new AppError(
        "You can only update your own products",
        403,
        "FORBIDDEN",
      );
    }

    const updates = {};

    if (stockQuantity !== undefined) {
      const newQuantity = parseInt(stockQuantity);
      if (isNaN(newQuantity) || newQuantity < 0) {
        throw new AppError(
          "Stock quantity must be a non-negative number",
          400,
          "VALIDATION_ERROR",
        );
      }
      updates["inventory.quantity"] = newQuantity;
      updates.isActive = newQuantity > 0;
    }

    if (publicPrice !== undefined) {
      const newPrice = parseFloat(publicPrice);
      if (isNaN(newPrice) || newPrice <= 0) {
        throw new AppError(
          "Public price must be a positive number",
          400,
          "VALIDATION_ERROR",
        );
      }
      updates["pricing.publicPrice"] = newPrice;
    }

    if (wholesalePrice !== undefined) {
      const newPrice = parseFloat(wholesalePrice);
      if (isNaN(newPrice) || newPrice <= 0) {
        throw new AppError(
          "Wholesale price must be a positive number",
          400,
          "VALIDATION_ERROR",
        );
      }
      updates["pricing.wholesalePrice"] = newPrice;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $set: updates },
      { new: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
};

const bulkUpdateStock = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new AppError("Updates array is required", 400, "VALIDATION_ERROR");
    }

    const results = await Promise.all(
      updates.map(async (item) => {
        try {
          const product = await Product.findById(item.productId);
          if (!product) {
            return {
              productId: item.productId,
              success: false,
              message: "Product not found",
            };
          }

          if (product.sellerId.toString() !== userId.toString()) {
            return {
              productId: item.productId,
              success: false,
              message: "Not authorized",
            };
          }

          const updateFields = {};
          if (item.stockQuantity !== undefined) {
            updateFields["inventory.quantity"] = parseInt(item.stockQuantity);
            updateFields.isActive = parseInt(item.stockQuantity) > 0;
          }
          if (item.publicPrice !== undefined) {
            updateFields["pricing.publicPrice"] = parseFloat(item.publicPrice);
          }
          if (item.wholesalePrice !== undefined) {
            updateFields["pricing.wholesalePrice"] = parseFloat(
              item.wholesalePrice,
            );
          }

          await Product.findByIdAndUpdate(item.productId, {
            $set: updateFields,
          });
          return { productId: item.productId, success: true };
        } catch (err) {
          return {
            productId: item.productId,
            success: false,
            message: err.message,
          };
        }
      }),
    );

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    res.status(200).json({
      success: true,
      message: `Updated ${successCount} products. ${failCount} failed.`,
      results,
    });
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    if (
      product.sellerId.toString() !== userId.toString() &&
      req.userRole !== "admin"
    ) {
      throw new AppError(
        "You can only view your own products",
        403,
        "FORBIDDEN",
      );
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    if (
      product.sellerId.toString() !== userId.toString() &&
      req.userRole !== "admin"
    ) {
      throw new AppError(
        "You can only delete your own products",
        403,
        "FORBIDDEN",
      );
    }

    await Product.findByIdAndDelete(productId);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getMyProducts,
  updateStockAndPrice,
  bulkUpdateStock,
  getProductById,
  deleteProduct,
};
