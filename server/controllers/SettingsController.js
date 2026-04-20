/**
 * Settings Controller - Global Site Configuration
 */

const Settings = require("../models/Settings");
const SystemLog = require("../models/SystemLog");

const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({
        siteName: "GearBazar",
        contactEmail: "support@gearbazar.com",
        contactPhone: "+1-800-GEARBAZAR",
      });
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const {
      maintenanceMode,
      siteLogo,
      siteName,
      contactEmail,
      contactPhone,
      address,
      shippingCharges,
      taxSettings,
      socialLinks,
      currency,
      timezone,
    } = req.body;

    let settings = await Settings.findOne();

    if (settings) {
      if (maintenanceMode !== undefined)
        settings.maintenanceMode = maintenanceMode;
      if (siteLogo !== undefined) settings.siteLogo = siteLogo;
      if (siteName !== undefined) settings.siteName = siteName;
      if (contactEmail !== undefined) settings.contactEmail = contactEmail;
      if (contactPhone !== undefined) settings.contactPhone = contactPhone;
      if (address) settings.address = { ...settings.address, ...address };
      if (shippingCharges)
        settings.shippingCharges = {
          ...settings.shippingCharges,
          ...shippingCharges,
        };
      if (taxSettings)
        settings.taxSettings = { ...settings.taxSettings, ...taxSettings };
      if (socialLinks)
        settings.socialLinks = { ...settings.socialLinks, ...socialLinks };
      if (currency) settings.currency = { ...settings.currency, ...currency };
      if (timezone !== undefined) settings.timezone = timezone;
      settings.updatedBy = req.user._id;
      await settings.save();
    } else {
      settings = await Settings.create({
        maintenanceMode,
        siteLogo,
        siteName,
        contactEmail,
        contactPhone,
        address,
        shippingCharges,
        taxSettings,
        socialLinks,
        currency,
        timezone,
        updatedBy: req.user._id,
      });
    }

    await SystemLog.log({
      adminId: req.user._id,
      adminName: req.user.name || req.user.email,
      action: "SETTINGS_UPDATED",
      targetType: "Settings",
      targetId: settings._id,
      targetName: "Global Settings",
      description: `Updated global settings: ${Object.keys(req.body).join(", ")}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

const toggleMaintenanceMode = async (req, res, next) => {
  try {
    const { enabled } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ maintenanceMode: enabled });
    } else {
      settings.maintenanceMode = enabled;
      settings.updatedBy = req.user._id;
      await settings.save();
    }

    await SystemLog.log({
      adminId: req.user._id,
      adminName: req.user.name || req.user.email,
      action: "SETTINGS_UPDATED",
      targetType: "Settings",
      targetId: settings._id,
      targetName: "Maintenance Mode",
      description: `Maintenance mode ${enabled ? "enabled" : "disabled"}`,
      previousValue: !enabled,
      newValue: enabled,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({
      success: true,
      message: `Maintenance mode ${enabled ? "enabled" : "disabled"}`,
      data: { maintenanceMode: settings.maintenanceMode },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  toggleMaintenanceMode,
};
