/**
 * Base Controller - Modular Monolith Pattern
 * Provides common methods for all controllers
 */

const { AppError } = require('../middleware/errorHandler');

class BaseController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res, next) {
    try {
      const { page = 1, limit = 20, sort = '-createdAt' } = req.query;
      const skip = (page - 1) * limit;

      const [documents, total] = await Promise.all([
        this.model.find().sort(sort).skip(skip).limit(parseInt(limit)),
        this.model.countDocuments()
      ]);

      res.status(200).json({
        success: true,
        data: documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const document = await this.model.findById(req.params.id);
      if (!document) {
        throw new AppError(`${this.model.modelName} not found`, 404, 'NOT_FOUND');
      }

      res.status(200).json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const document = await this.model.create(req.body);
      res.status(201).json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const document = await this.model.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      if (!document) {
        throw new AppError(`${this.model.modelName} not found`, 404, 'NOT_FOUND');
      }

      res.status(200).json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const document = await this.model.findByIdAndDelete(req.params.id);
      if (!document) {
        throw new AppError(`${this.model.modelName} not found`, 404, 'NOT_FOUND');
      }

      res.status(200).json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BaseController;