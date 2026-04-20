/**
 * Shop Middleware - Owner Verification
 */

const Shop = require('../models/Shop');
const { AppError } = require('./errorHandler');

const isOwner = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { shopId } = req.params;

    if (!shopId) {
      throw new AppError('Shop ID is required', 400, 'VALIDATION_ERROR');
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      throw new AppError('Shop not found', 404, 'NOT_FOUND');
    }

    if (shop.ownerId.toString() !== userId.toString()) {
      throw new AppError('You are not authorized to perform this action', 403, 'FORBIDDEN');
    }

    req.shop = shop;
    next();
  } catch (error) {
    next(error);
  }
};

const isShopActive = async (req, res, next) => {
  try {
    const shop = req.shop || await Shop.findById(req.params.shopId);
    
    if (!shop) {
      throw new AppError('Shop not found', 404, 'NOT_FOUND');
    }

    if (shop.status === 'suspended') {
      throw new AppError('Shop is suspended. Contact support for assistance.', 403, 'SHOP_SUSPENDED');
    }

    if (shop.status !== 'active') {
      throw new AppError('Shop is not active', 403, 'SHOP_INACTIVE');
    }

    next();
  } catch (error) {
    next(error);
  }
};

const canAccessShop = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { shopId } = req.params;

    const shop = await Shop.findById(shopId);
    if (!shop) {
      throw new AppError('Shop not found', 404, 'NOT_FOUND');
    }

    const isOwner = shop.ownerId.toString() === userId.toString();
    const isPublic = shop.status === 'active';

    if (!isOwner && !isPublic && req.userRole !== 'admin') {
      throw new AppError('Shop is not accessible', 403, 'SHOP_NOT_ACCESSIBLE');
    }

    req.shop = shop;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  isOwner,
  isShopActive,
  canAccessShop
};