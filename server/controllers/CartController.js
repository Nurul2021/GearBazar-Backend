/**
 * Cart Controller - Shopping Cart System
 */

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

const determinePriceType = (user) => {
  if (!user) return { priceType: 'retail', useWholesale: false };
  
  const allowedRoles = ['seller', 'garage', 'admin'];
  const hasRole = allowedRoles.includes(user.role);
  const isVerified = user.isVerified === true;
  const isActive = user.isActive !== false;

  if (hasRole && isVerified && isActive) {
    return { priceType: 'wholesale', useWholesale: true };
  }
  
  return { priceType: 'retail', useWholesale: false };
};

const addToCart = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      throw new AppError('Product ID is required', 400, 'VALIDATION_ERROR');
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 999) {
      throw new AppError('Quantity must be between 1 and 999', 400, 'VALIDATION_ERROR');
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    if (!product.isActive) {
      throw new AppError('Product is not available', 400, 'PRODUCT_UNAVAILABLE');
    }

    if (product.inventory.trackInventory) {
      if (product.inventory.stockQuantity < parsedQuantity) {
        if (!product.inventory.allowBackorder && product.inventory.stockQuantity === 0) {
          throw new AppError('Product is out of stock', 400, 'OUT_OF_STOCK');
        }
        if (parsedQuantity > product.inventory.stockQuantity && !product.inventory.allowBackorder) {
          throw new AppError(`Only ${product.inventory.stockQuantity} items available`, 400, 'INSUFFICIENT_STOCK');
        }
      }
    }

    const user = await User.findById(userId);
    const { priceType, useWholesale } = determinePriceType(user);

    const selectedPrice = useWholesale 
      ? product.pricing.wholesalePrice 
      : (product.pricing.discountPercent > 0 
          ? product.pricing.publicPrice * (1 - product.pricing.discountPercent / 100)
          : product.pricing.publicPrice);

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      const newQuantity = cart.items[existingItemIndex].quantity + parsedQuantity;
      
      if (product.inventory.trackInventory && !product.inventory.allowBackorder) {
        if (newQuantity > product.inventory.stockQuantity) {
          throw new AppError(`Total quantity exceeds available stock (${product.inventory.stockQuantity})`, 400, 'INSUFFICIENT_STOCK');
        }
      }

      cart.items[existingItemIndex].quantity = Math.min(newQuantity, 999);
      cart.items[existingItemIndex].selectedPrice = selectedPrice;
      cart.items[existingItemIndex].priceType = priceType;
    } else {
      cart.items.push({
        product: productId,
        vendorId: product.vendorId,
        quantity: parsedQuantity,
        selectedPrice: Math.round(selectedPrice * 100) / 100,
        priceType
      });
    }

    cart.calculateTotals();
    await cart.save();

    await cart.populate([
      { path: 'items.product', select: 'title slug brand images pricing.inventory stockQuantity' },
      { path: 'items.vendorId', select: 'name shopName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: {
        cart: {
          _id: cart._id,
          items: cart.items,
          totalItems: cart.totalItems,
          subtotal: cart.subtotal,
          estimatedSavings: cart.estimatedSavings
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateCartItem = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined) {
      throw new AppError('Quantity is required', 400, 'VALIDATION_ERROR');
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 999) {
      throw new AppError('Quantity must be between 1 and 999', 400, 'VALIDATION_ERROR');
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new AppError('Cart not found', 404, 'NOT_FOUND');
    }

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      throw new AppError('Item not found in cart', 404, 'NOT_FOUND');
    }

    const product = await Product.findById(productId);
    if (product && product.inventory.trackInventory && !product.inventory.allowBackorder) {
      if (parsedQuantity > product.inventory.stockQuantity) {
        throw new AppError(`Only ${product.inventory.stockQuantity} items available`, 400, 'INSUFFICIENT_STOCK');
      }
    }

    cart.items[itemIndex].quantity = parsedQuantity;
    cart.calculateTotals();
    await cart.save();

    await cart.populate([
      { path: 'items.product', select: 'title slug brand images pricing.inventory.stockQuantity' },
      { path: 'items.vendorId', select: 'name shopName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      data: {
        cart: {
          _id: cart._id,
          items: cart.items,
          totalItems: cart.totalItems,
          subtotal: cart.subtotal
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new AppError('Cart not found', 404, 'NOT_FOUND');
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(
      item => item.product.toString() !== productId
    );

    if (cart.items.length === initialLength) {
      throw new AppError('Item not found in cart', 404, 'NOT_FOUND');
    }

    cart.calculateTotals();
    await cart.save();

    await cart.populate([
      { path: 'items.product', select: 'title slug brand images' },
      { path: 'items.vendorId', select: 'name shopName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: {
        cart: {
          _id: cart._id,
          items: cart.items,
          totalItems: cart.totalItems,
          subtotal: cart.subtotal
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getCart = async (req, res, next) => {
  try {
    const userId = req.userId;

    let cart = await Cart.findOne({ user: userId })
      .populate([
        { path: 'items.product', select: 'title slug brand images pricing inventory stockQuantity isActive' },
        { path: 'items.vendorId', select: 'name shopName email' }
      ])
      .lean();

    if (!cart) {
      cart = { user: userId, items: [], totalItems: 0, subtotal: 0, estimatedSavings: 0 };
    }

    const invalidItems = [];
    const validItems = [];

    for (const item of cart.items) {
      const product = item.product;
      
      if (!product || !product.isActive) {
        invalidItems.push({
          productId: item.product,
          reason: !product ? 'Product not found' : 'Product is no longer available'
        });
        continue;
      }

      if (product.inventory.trackInventory && product.inventory.stockQuantity === 0 && !product.inventory.allowBackorder) {
        invalidItems.push({
          productId: item.product._id,
          title: product.title,
          reason: 'Product is out of stock'
        });
        continue;
      }

      if (product.inventory.trackInventory && item.quantity > product.inventory.stockQuantity && !product.inventory.allowBackorder) {
        invalidItems.push({
          productId: item.product._id,
          title: product.title,
          reason: `Only ${product.inventory.stockQuantity} available`
        });
        continue;
      }

      validItems.push(item);
    }

    const subtotal = validItems.reduce((sum, item) => sum + (item.selectedPrice * item.quantity), 0);

    res.status(200).json({
      success: true,
      data: {
        cart: {
          _id: cart._id,
          items: validItems,
          totalItems: validItems.reduce((sum, item) => sum + item.quantity, 0),
          subtotal: Math.round(subtotal * 100) / 100
        },
        invalidItems: invalidItems.length > 0 ? invalidItems : undefined
      }
    });
  } catch (error) {
    next(error);
  }
};

const clearCart = async (req, res, next) => {
  try {
    const userId = req.userId;

    await Cart.findOneAndUpdate(
      { user: userId },
      { items: [], totalItems: 0, subtotal: 0, estimatedSavings: 0 },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Cart cleared'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addToCart,
  updateCartItem,
  removeFromCart,
  getCart,
  clearCart
};