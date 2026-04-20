/**
 * Price Calculator Utility
 * Dual-Pricing System for Auto-parts Marketplace
 * DRY Principle - Reusable across Product, Cart, and Order Controllers
 */

const getPriceForUser = (product, user) => {
  if (!product || !product.pricing) {
    throw new Error('Invalid product data');
  }

  const { publicPrice, wholesalePrice, discountPercent } = product.pricing;

  const canAccessWholesale = user && 
    ['seller', 'garage', 'admin'].includes(user.role) && 
    user.isVerified === true && 
    user.isActive !== false;

  const basePrice = canAccessWholesale ? wholesalePrice : publicPrice;

  let finalPrice = basePrice;
  if (discountPercent && discountPercent > 0) {
    finalPrice = basePrice * (1 - discountPercent / 100);
  }

  return {
    basePrice: Math.round(basePrice * 100) / 100,
    finalPrice: Math.round(finalPrice * 100) / 100,
    discountPercent,
    priceType: canAccessWholesale ? 'wholesale' : 'retail',
    canAccessWholesale
  };
};

const getPriceForUsers = (products, user) => {
  if (!Array.isArray(products)) {
    return getPriceForUser(products, user);
  }

  return products.map(product => ({
    productId: product._id || product.id,
    ...getPriceForUser(product, user)
  }));
};

const getCartTotal = (cartItems, user) => {
  if (!cartItems || cartItems.length === 0) {
    return {
      items: [],
      subtotal: 0,
      total: 0,
      itemCount: 0,
      priceType: 'retail'
    };
  }

  const items = cartItems.map(item => {
    const priceInfo = getPriceForUser(item.product || item, user);
    const quantity = item.quantity || 1;
    const lineTotal = priceInfo.finalPrice * quantity;

    return {
      productId: item.product?._id || item.productId || item._id,
      title: item.product?.title || item.title,
      quantity,
      unitPrice: priceInfo.finalPrice,
      priceType: priceInfo.priceType,
      lineTotal: Math.round(lineTotal * 100) / 100
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const priceType = items[0]?.priceType || 'retail';

  return {
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(subtotal * 100) / 100,
    itemCount: items.length,
    priceType
  };
};

const getOrderItemPrice = (product, user) => {
  const priceInfo = getPriceForUser(product, user);
  return priceInfo.finalPrice;
};

const canAccessWholesalePricing = (user) => {
  if (!user) return false;
  return ['seller', 'garage', 'admin'].includes(user.role) && 
         user.isVerified === true && 
         user.isActive !== false;
};

const formatPrice = (price, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(price);
};

module.exports = {
  getPriceForUser,
  getPriceForUsers,
  getCartTotal,
  getOrderItemPrice,
  canAccessWholesalePricing,
  formatPrice
};