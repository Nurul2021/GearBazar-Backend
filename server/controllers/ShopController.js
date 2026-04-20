/**
 * Shop Controller - Vendor Shop Management
 */

const Shop = require('../models/Shop');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

const createShop = async (req, res, next) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;

    if (!['seller', 'garage'].includes(userRole)) {
      throw new AppError('Only sellers and garage owners can create a shop', 403, 'FORBIDDEN');
    }

    const existingShop = await Shop.findOne({ ownerId: userId });
    if (existingShop) {
      throw new AppError('You already have a shop profile. Use PUT to update.', 400, 'SHOP_EXISTS');
    }

    const shopData = {
      ...req.body,
      ownerId: userId,
      status: 'inactive'
    };

    const shop = await Shop.create(shopData);

    await User.findByIdAndUpdate(userId, {
      'shopDetails.shopName': shop.shopName,
      'shopDetails.shopDescription': shop.description
    });

    res.status(201).json({
      success: true,
      message: 'Shop profile created successfully',
      data: shop
    });
  } catch (error) {
    next(error);
  }
};

const getShop = async (req, res, next) => {
  try {
    const { shopId } = req.params;
    const userId = req.userId;

    const shop = await Shop.findById(shopId);
    if (!shop) {
      throw new AppError('Shop not found', 404, 'NOT_FOUND');
    }

    const isOwner = shop.ownerId.toString() === userId.toString();
    const isAdmin = req.userRole === 'admin';

    const response = {
      _id: shop._id,
      shopName: shop.shopName,
      slug: shop.slug,
      description: shop.description,
      shopAddress: shop.shopAddress,
      contactNumber: shop.contactNumber,
      contactEmail: shop.contactEmail,
      shopLogo: shop.shopLogo,
      coverImage: shop.coverImage,
      businessRegistration: isOwner || isAdmin ? shop.businessRegistration : null,
      operatingHours: shop.operatingHours,
      status: shop.status,
      isVerified: shop.isVerified,
      rating: shop.rating,
      socialLinks: shop.socialLinks,
      settings: isOwner ? shop.settings : { allowReviews: shop.settings.allowReviews },
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt
    };

    res.status(200).json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
};

const getMyShop = async (req, res, next) => {
  try {
    const userId = req.userId;

    const shop = await Shop.findOne({ ownerId: userId });
    if (!shop) {
      throw new AppError('Shop not found. Please initialize your shop first.', 404, 'NOT_FOUND');
    }

    res.status(200).json({ success: true, data: shop });
  } catch (error) {
    next(error);
  }
};

const updateShop = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { shopId } = req.params;

    const shop = await Shop.findById(shopId);
    if (!shop) {
      throw new AppError('Shop not found', 404, 'NOT_FOUND');
    }

    if (shop.ownerId.toString() !== userId.toString()) {
      throw new AppError('You can only update your own shop', 403, 'FORBIDDEN');
    }

    const allowedFields = [
      'shopName', 'description', 'shopAddress', 'contactNumber', 'contactEmail',
      'shopLogo', 'coverImage', 'operatingHours', 'socialLinks', 'settings'
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedShop = await Shop.findByIdAndUpdate(
      shopId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Shop updated successfully',
      data: updatedShop
    });
  } catch (error) {
    next(error);
  }
};

const updateShopStatus = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { shopId } = req.params;
    const { status, reason } = req.body;

    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400, 'INVALID_STATUS');
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      throw new AppError('Shop not found', 404, 'NOT_FOUND');
    }

    if (shop.ownerId.toString() !== userId.toString() && req.userRole !== 'admin') {
      throw new AppError('Not authorized to update this shop', 403, 'FORBIDDEN');
    }

    const updateData = { status };

    if (status === 'active') {
      updateData.activatedAt = new Date();
      updateData.lastActiveAt = new Date();
    } else if (status === 'suspended') {
      updateData.suspendedAt = new Date();
      updateData.suspendedReason = reason;
      updateData.suspendedBy = req.userRole === 'admin' ? userId : null;
    }

    const updatedShop = await Shop.findByIdAndUpdate(
      shopId,
      { $set: updateData },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Shop status updated to ${status}`,
      data: updatedShop
    });
  } catch (error) {
    next(error);
  }
};

const deleteShop = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { shopId } = req.params;

    const shop = await Shop.findById(shopId);
    if (!shop) {
      throw new AppError('Shop not found', 404, 'NOT_FOUND');
    }

    if (shop.ownerId.toString() !== userId.toString() && req.userRole !== 'admin') {
      throw new AppError('Not authorized to delete this shop', 403, 'FORBIDDEN');
    }

    await Shop.findByIdAndDelete(shopId);

    res.status(200).json({
      success: true,
      message: 'Shop deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createShop,
  getShop,
  getMyShop,
  updateShop,
  updateShopStatus,
  deleteShop
};