/**
 * Category Controller - Admin Category Management
 */

const Category = require('../models/Category');
const Product = require('../models/Product');
const { AppError } = require('../middleware/errorHandler');

const createCategory = async (req, res, next) => {
  try {
    const { name, description, icon, image, parentCategory, displayOrder, metaTitle, metaDescription } = req.body;

    const categoryData = {
      name,
      description,
      icon,
      image,
      parentCategory: parentCategory || null,
      displayOrder: parseInt(displayOrder) || 0,
      metaTitle,
      metaDescription
    };

    const category = await Category.create(categoryData);

    if (parentCategory) {
      await Category.findByIdAndUpdate(parentCategory, {
        $addToSet: { subCategories: category._id }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('Category name already exists', 400, 'DUPLICATE_ERROR'));
    }
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { name, description, icon, image, parentCategory, isActive, isFeatured, displayOrder, metaTitle, metaDescription } = req.body;

    const category = await Category.findById(categoryId);
    if (!category) {
      throw new AppError('Category not found', 404, 'NOT_FOUND');
    }

    if (parentCategory && parentCategory !== category._id.toString()) {
      if (category.parentCategory) {
        await Category.findByIdAndUpdate(category.parentCategory, {
          $pull: { subCategories: category._id }
        });
      }

      await Category.findByIdAndUpdate(parentCategory, {
        $addToSet: { subCategories: category._id }
      });
    }

    const updateFields = {
      description,
      icon,
      image,
      parentCategory: parentCategory || null,
      isActive: isActive !== undefined ? isActive : category.isActive,
      isFeatured: isFeatured !== undefined ? isFeatured : category.isFeatured,
      displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : category.displayOrder,
      metaTitle,
      metaDescription
    };

    if (name && name !== category.name) {
      updateFields.name = name;
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('Category name already exists', 400, 'DUPLICATE_ERROR'));
    }
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findById(categoryId);
    if (!category) {
      throw new AppError('Category not found', 404, 'NOT_FOUND');
    }

    const productCount = await Product.countDocuments({ category: categoryId });
    if (productCount > 0) {
      throw new AppError(`Cannot delete category with ${productCount} associated products`, 400, 'CATEGORY_IN_USE');
    }

    if (category.subCategories && category.subCategories.length > 0) {
      await Category.updateMany(
        { _id: { $in: category.subCategories } },
        { $set: { parentCategory: null } }
      );
    }

    if (category.parentCategory) {
      await Category.findByIdAndUpdate(category.parentCategory, {
        $pull: { subCategories: category._id }
      });
    }

    await Category.findByIdAndDelete(categoryId);

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

const getAllCategories = async (req, res, next) => {
  try {
    const { includeInactive, parentOnly } = req.query;

    const query = {};
    if (!includeInactive) {
      query.isActive = true;
    }
    if (parentOnly === 'true') {
      query.parentCategory = null;
    }

    const categories = await Category.find(query)
      .sort({ displayOrder: 1, name: 1 })
      .populate('subCategories', 'name slug icon')
      .lean();

    const tree = buildCategoryTree(categories);

    res.status(200).json({
      success: true,
      data: tree
    });
  } catch (error) {
    next(error);
  }
};

const getCategoryById = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findById(categoryId)
      .populate('subCategories')
      .populate('parentCategory', 'name slug');

    if (!category) {
      throw new AppError('Category not found', 404, 'NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

const getAllBrands = async (req, res, next) => {
  try {
    const brands = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          name: '$_id',
          productCount: '$count'
        }
      }
    ]);

    const categories = await Category.aggregate([
      { $match: { isActive: true } },
      { $project: { _id: 1, name: 1, slug: 1, icon: 1, image: 1 } },
      { $sort: { displayOrder: 1, name: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        brands,
        categories
      }
    });
  } catch (error) {
    next(error);
  }
};

const toggleFeaturedProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { isFeatured } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    product.isFeatured = isFeatured === true;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product ${isFeatured ? 'featured' : 'unfeatured'} successfully`,
      data: {
        productId: product._id,
        isFeatured: product.isFeatured
      }
    });
  } catch (error) {
    next(error);
  }
};

const getFeaturedProducts = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const products = await Product.find({ isFeatured: true, isActive: true })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('category', 'name slug')
      .populate('vendorId', 'name shopName')
      .lean();

    const enrichedProducts = products.map(product => ({
      _id: product._id,
      title: product.title,
      slug: product.slug,
      brand: product.brand,
      images: product.images,
      pricing: {
        publicPrice: product.pricing.publicPrice,
        discountPercent: product.pricing.discountPercent
      },
      category: product.category
    }));

    res.status(200).json({
      success: true,
      data: enrichedProducts
    });
  } catch (error) {
    next(error);
  }
};

const buildCategoryTree = (categories, parentId = null) => {
  return categories
    .filter(cat => {
      const parentIdStr = cat.parentCategory ? cat.parentCategory.toString() : null;
      return parentIdStr === (parentId ? parentId.toString() : null);
    })
    .map(cat => ({
      ...cat,
      subCategories: cat.subCategories ? buildCategoryTree(categories, cat._id) : []
    }));
};

module.exports = {
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  getAllBrands,
  toggleFeaturedProduct,
  getFeaturedProducts
};