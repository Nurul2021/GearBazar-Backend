/**
 * Search Service - Advanced Product Search Engine
 * Supports MongoDB Atlas Search (Lucene) with Regex fallback
 */

const Product = require("../models/Product");
const Category = require("../models/Category");
const mongoose = require("mongoose");

class SearchService {
  constructor() {
    this.useAtlasSearch = process.env.USE_ATLAS_SEARCH === "true";
    this.defaultPageSize = 20;
    this.maxPageSize = 100;
  }

  buildAtlasSearchQuery(filters) {
    const {
      query,
      category,
      brand,
      make,
      model,
      year,
      minPrice,
      maxPrice,
      inStock,
    } = filters;

    const must = [];
    const should = [];
    const filter = [];

    if (query) {
      must.push({
        compound: {
          should: [
            { text: { query, path: "title", fuzziness: "AUTO", boost: 3 } },
            { text: { query, path: "brand", fuzziness: "AUTO", boost: 2 } },
            {
              text: { query, path: "description", fuzziness: "AUTO", boost: 1 },
            },
            { text: { query, path: "tags", fuzziness: "AUTO", boost: 1 } },
          ],
          minimumShouldMatch: 1,
        },
      });
    }

    if (category) {
      filter.push({ equals: { value: category, path: "category" } });
    }

    if (brand) {
      filter.push({ text: { query: brand, path: "brand", fuzziness: "AUTO" } });
    }

    if (make) {
      filter.push({
        text: {
          query: make.toUpperCase(),
          path: "compatibility.make",
          fuzziness: 0,
        },
      });
    }

    if (model) {
      filter.push({
        text: { query: model, path: "compatibility.model", fuzziness: "AUTO" },
      });
    }

    if (year) {
      filter.push({
        wildcard: {
          value: `*${year}*`,
          path: "compatibility.years",
        },
      });
    }

    if (minPrice || maxPrice) {
      const range = {};
      if (minPrice) range.gte = parseFloat(minPrice);
      if (maxPrice) range.lte = parseFloat(maxPrice);
      filter.push({ range: { path: "pricing.publicPrice", value: range } });
    }

    if (inStock === "true") {
      filter.push({
        range: { path: "inventory.stockQuantity", value: { gte: 1 } },
      });
    }

    filter.push({ equals: { value: true, path: "isActive" } });

    return {
      index: "products",
      compound: {
        must: must.length > 0 ? must : [{ matchAll: {} }],
        filter: filter.length > 0 ? filter : [],
      },
      count: { limit: 10000 },
      ...(filters.page && {
        skip:
          (parseInt(filters.page) - 1) *
          (parseInt(filters.limit) || this.defaultPageSize),
      }),
      ...(filters.limit && { limit: parseInt(filters.limit) }),
    };
  }

  buildRegexQuery(filters) {
    const {
      query,
      category,
      brand,
      make,
      model,
      year,
      minPrice,
      maxPrice,
      inStock,
    } = filters;
    const mongoQuery = { isActive: true };

    if (query) {
      mongoQuery.$or = [
        { title: { $regex: query, $options: "i" } },
        { brand: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { partNumber: { $regex: query, $options: "i" } },
        { tags: { $in: [new RegExp(query, "i")] } },
      ];
    }

    if (category) {
      mongoQuery.category = mongoose.isValidObjectId(category)
        ? new mongoose.Types.ObjectId(category)
        : category;
    }

    if (brand) {
      mongoQuery.brand = { $regex: new RegExp(`^${brand}$`, "i") };
    }

    if (make || model || year) {
      mongoQuery["compatibility"] = {};
      if (make)
        mongoQuery["compatibility.make"] = {
          $regex: make.toUpperCase(),
          $options: "i",
        };
      if (model)
        mongoQuery["compatibility.model"] = { $regex: model, $options: "i" };
      if (year)
        mongoQuery["compatibility.years"] = { $regex: year, $options: "i" };
    }

    if (minPrice || maxPrice) {
      mongoQuery["pricing.publicPrice"] = {};
      if (minPrice)
        mongoQuery["pricing.publicPrice"].$gte = parseFloat(minPrice);
      if (maxPrice)
        mongoQuery["pricing.publicPrice"].$lte = parseFloat(maxPrice);
    }

    if (inStock === "true") {
      mongoQuery["inventory.stockQuantity"] = { $gte: 1 };
    }

    return mongoQuery;
  }

  async search(filters) {
    const page = parseInt(filters.page) || 1;
    const limit = Math.min(
      parseInt(filters.limit) || this.defaultPageSize,
      this.maxPageSize,
    );
    const skip = (page - 1) * limit;

    const startTime = Date.now();

    try {
      if (this.useAtlasSearch) {
        return await this.atlasSearch(filters, page, limit, skip, startTime);
      } else {
        return await this.regexSearch(filters, page, limit, skip, startTime);
      }
    } catch (error) {
      console.error("Search error, falling back to regex:", error.message);
      return await this.regexSearch(filters, page, limit, skip, startTime);
    }
  }

  async atlasSearch(filters, page, limit, skip, startTime) {
    const atlasQuery = this.buildAtlasSearchQuery(filters);
    const results = await Product.aggregate([
      { $search: atlasQuery },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          title: 1,
          slug: 1,
          brand: 1,
          description: 1,
          partNumber: 1,
          images: 1,
          pricing: 1,
          inventory: 1,
          category: 1,
          vendorId: 1,
          compatibility: 1,
          totalSold: 1,
          avgRating: 1,
          tags: 1,
          createdAt: 1,
        },
      },
    ]);

    const countQuery = this.buildAtlasSearchQuery({
      ...filters,
      page: 1,
      limit: 10000,
    });
    countQuery.count = { limit: 10000 };
    delete countQuery.skip;
    delete countQuery.limit;

    const countResult = await Product.aggregate([
      { $search: countQuery },
      { $count: "total" },
    ]);

    const total = countResult[0]?.total || 0;
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      meta: {
        executionTime,
        engine: "atlas_search",
        fuzzy: true,
      },
    };
  }

  async regexSearch(filters, page, limit, skip, startTime) {
    const mongoQuery = this.buildRegexQuery(filters);

    const [results, total] = await Promise.all([
      Product.find(mongoQuery)
        .populate("category", "name slug")
        .populate("vendorId", "name shopName")
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(mongoQuery),
    ]);

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      meta: {
        executionTime,
        engine: "regex",
        fuzzy: false,
      },
    };
  }

  async getSuggestions(query, limit = 10) {
    if (!query || query.length < 2) {
      return { success: true, data: [] };
    }

    const startTime = Date.now();

    try {
      if (this.useAtlasSearch) {
        const results = await Product.aggregate([
          {
            $search: {
              index: "products",
              compound: {
                should: [
                  {
                    text: { query, path: "title", fuzziness: "AUTO", boost: 3 },
                  },
                  {
                    text: { query, path: "brand", fuzziness: "AUTO", boost: 2 },
                  },
                ],
              },
            },
          },
          { $match: { isActive: true } },
          { $limit: limit },
          {
            $project: {
              title: 1,
              brand: 1,
              slug: 1,
              "pricing.publicPrice": 1,
              "images.0": 1,
            },
          },
        ]);

        return {
          success: true,
          data: results.map((p) => ({
            title: p.title,
            brand: p.brand,
            slug: p.slug,
            price: p.pricing?.publicPrice,
            image: p.images?.[0],
          })),
          meta: {
            executionTime: Date.now() - startTime,
            engine: "atlas_search",
          },
        };
      } else {
        const regex = new RegExp(query, "i");
        const results = await Product.find({
          $or: [{ title: { $regex: regex } }, { brand: { $regex: regex } }],
          isActive: true,
        })
          .select("title brand slug pricing.publicPrice images")
          .limit(limit)
          .lean();

        return {
          success: true,
          data: results.map((p) => ({
            title: p.title,
            brand: p.brand,
            slug: p.slug,
            price: p.pricing?.publicPrice,
            image: p.images?.[0],
          })),
          meta: { executionTime: Date.now() - startTime, engine: "regex" },
        };
      }
    } catch (error) {
      const regex = new RegExp(query, "i");
      const results = await Product.find({
        $or: [{ title: { $regex: regex } }, { brand: { $regex: regex } }],
        isActive: true,
      })
        .select("title brand slug pricing.publicPrice images")
        .limit(limit)
        .lean();

      return {
        success: true,
        data: results.map((p) => ({
          title: p.title,
          brand: p.brand,
          slug: p.slug,
          price: p.pricing?.publicPrice,
          image: p.images?.[0],
        })),
        meta: {
          executionTime: Date.now() - startTime,
          engine: "regex_fallback",
        },
      };
    }
  }

  async getPopularSearches(limit = 10) {
    const results = await Product.find({ isActive: true })
      .sort({ totalSold: -1, avgRating: -1 })
      .select("title brand slug pricing.publicPrice images")
      .limit(limit)
      .lean();

    return {
      success: true,
      data: results.map((p) => ({
        title: p.title,
        brand: p.brand,
        slug: p.slug,
        price: p.pricing?.publicPrice,
        image: p.images?.[0],
      })),
    };
  }

  async getFilters() {
    const [brands, categories] = await Promise.all([
      Product.distinct("brand", { isActive: true }),
      Category.find({ isActive: true }).select("name slug").lean(),
    ]);

    const makes = await Product.distinct("compatibility.make", {
      isActive: true,
    });
    const models = await Product.distinct("compatibility.model", {
      isActive: true,
    });

    return {
      success: true,
      data: {
        brands: brands.filter(Boolean).sort(),
        categories,
        makes: makes.filter(Boolean).sort(),
        models: [...new Set(models.filter(Boolean))].sort(),
      },
    };
  }
}

module.exports = new SearchService();
